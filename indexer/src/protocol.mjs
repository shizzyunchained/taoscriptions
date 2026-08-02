import { blake2AsHex, decodeAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";

export const INDEXER_VERSION = "0.1.0";
const ALLOWED_KEYS = new Set([
  "p", "v", "op", "netuid", "subnet_generation", "name", "media_type",
  "body", "content_uri", "content_hash",
]);
const TRANSFER_KEYS = new Set(["p", "v", "op", "artifact", "to", "nonce"]);

function strictJsonScan(text) {
  let cursor = 0;
  const whitespace = () => { while (/\s/.test(text[cursor] ?? "")) cursor += 1; };
  const fail = (message) => { throw new Error(`INVALID_JSON:${message} at byte ${cursor}`); };

  function string() {
    if (text[cursor] !== '"') fail("expected string");
    const start = cursor++;
    while (cursor < text.length) {
      if (text[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (text[cursor] === '"') {
        cursor += 1;
        try { return JSON.parse(text.slice(start, cursor)); } catch { fail("invalid string escape"); }
      }
      if (text.charCodeAt(cursor) < 0x20) fail("control character in string");
      cursor += 1;
    }
    fail("unterminated string");
  }

  function value() {
    whitespace();
    const token = text[cursor];
    if (token === '"') { string(); return; }
    if (token === "{") { object(); return; }
    if (token === "[") { array(); return; }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, cursor)) { cursor += literal.length; return; }
    }
    const number = text.slice(cursor).match(/^-?(?:0|[1-9]\d*)/);
    if (number) {
      cursor += number[0].length;
      if (/[.eE]/.test(text[cursor] ?? "")) fail("floating-point numbers are forbidden");
      return;
    }
    fail("unexpected token");
  }

  function array() {
    cursor += 1;
    whitespace();
    if (text[cursor] === "]") { cursor += 1; return; }
    while (cursor < text.length) {
      value();
      whitespace();
      if (text[cursor] === "]") { cursor += 1; return; }
      if (text[cursor] !== ",") fail("expected array separator");
      cursor += 1;
    }
    fail("unterminated array");
  }

  function object() {
    cursor += 1;
    const keys = new Set();
    whitespace();
    if (text[cursor] === "}") { cursor += 1; return; }
    while (cursor < text.length) {
      whitespace();
      const key = string();
      if (keys.has(key)) fail(`duplicate key ${key}`);
      keys.add(key);
      whitespace();
      if (text[cursor] !== ":") fail("expected key separator");
      cursor += 1;
      value();
      whitespace();
      if (text[cursor] === "}") { cursor += 1; return; }
      if (text[cursor] !== ",") fail("expected object separator");
      cursor += 1;
    }
    fail("unterminated object");
  }

  whitespace();
  value();
  whitespace();
  if (cursor !== text.length) fail("trailing data");
}

export function parseMintPayload(bytes) {
  const { payload, text, payloadHex, payloadHash } = parseProtocolPayload(bytes);
  if (Object.keys(payload).some((key) => !ALLOWED_KEYS.has(key))) throw new Error("UNKNOWN_FIELD");
  if (payload.p !== "bittensor-relics" || payload.v !== 1 || payload.op !== "mint") throw new Error("UNSUPPORTED_PROTOCOL");
  if (!Number.isInteger(payload.netuid) || payload.netuid <= 0 || payload.netuid > 65_535) throw new Error("INVALID_NETUID");
  if (!Number.isSafeInteger(payload.subnet_generation) || payload.subnet_generation < 0) throw new Error("INVALID_SUBNET_GENERATION");
  if (typeof payload.name !== "string" || Array.from(payload.name.trim()).length < 1 || Array.from(payload.name.trim()).length > 80) throw new Error("INVALID_NAME");
  if (typeof payload.media_type !== "string" || payload.media_type.length < 1 || payload.media_type.length > 255) throw new Error("INVALID_MEDIA_TYPE");
  const inline = typeof payload.body === "string";
  const external = typeof payload.content_uri === "string" && typeof payload.content_hash === "string";
  if (inline === external) throw new Error("INVALID_CONTENT_FORM");
  if (inline && (Array.from(payload.body.trim()).length < 1 || Array.from(payload.body.trim()).length > 1_024)) throw new Error("INVALID_BODY");
  if (external && !/^sha256:[0-9a-f]{64}$/.test(payload.content_hash)) throw new Error("INVALID_CONTENT_HASH");
  if (external && !/^ipfs:\/\/[a-zA-Z0-9]+(?:\/.*)?$/.test(payload.content_uri)) throw new Error("INVALID_CONTENT_URI");
  return { payload, text, payloadHex, payloadHash };
}

export function parseProtocolPayload(bytes) {
  if (bytes.length > 2_048) throw new Error("PAYLOAD_TOO_LARGE");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  strictJsonScan(text);
  const payload = JSON.parse(text);
  if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new Error("PAYLOAD_NOT_OBJECT");
  if (payload.p !== "bittensor-relics" || payload.v !== 1 || typeof payload.op !== "string") throw new Error("UNSUPPORTED_PROTOCOL");
  return { payload, text, payloadHex: u8aToHex(bytes), payloadHash: blake2AsHex(bytes, 256) };
}

export function parseTransferPayload(bytes) {
  const decoded = parseProtocolPayload(bytes);
  const { payload } = decoded;
  if (Object.keys(payload).some((key) => !TRANSFER_KEYS.has(key))) throw new Error("UNKNOWN_FIELD");
  if (payload.op !== "transfer") throw new Error("UNSUPPORTED_OPERATION");
  if (typeof payload.artifact !== "string" || !/^br1:0x[0-9a-f]{64}:\d+:\d+$/.test(payload.artifact)) throw new Error("INVALID_ARTIFACT_ID");
  if (typeof payload.to !== "string") throw new Error("INVALID_TRANSFER_DESTINATION");
  try { accountHex(payload.to); } catch { throw new Error("INVALID_TRANSFER_DESTINATION"); }
  if (!Number.isSafeInteger(payload.nonce) || payload.nonce < 1) throw new Error("INVALID_OWNERSHIP_NONCE");
  return decoded;
}

export function accountHex(value) {
  return u8aToHex(decodeAddress(value.toString()));
}

export function findProtocolRemark(call) {
  if (call.section === "system" && call.method === "remarkWithEvent") {
    const bytes = call.args[0].toU8a(true);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    let decodedProtocol = false;
    try { decodedProtocol = JSON.parse(text)?.p === "bittensor-relics"; } catch {}
    return decodedProtocol || text.includes("bittensor-relics") ? bytes : null;
  }
  if (call.section === "utility" && ["batch", "batchAll", "forceBatch"].includes(call.method)) {
    for (const inner of call.args[0]) {
      const found = findProtocolRemark(inner);
      if (found) return found;
    }
  }
  return null;
}

export function validateMint({ api, extrinsic, eventRecords, subnetGeneration }) {
  if (!extrinsic.isSigned) throw new Error("UNSIGNED_EXTRINSIC");
  const outer = extrinsic.method;
  if (outer.section !== "utility" || outer.method !== "batchAll") throw new Error("INVALID_OUTER_CALL");
  const calls = Array.from(outer.args[0]);
  if (calls.length !== 2) throw new Error("INVALID_INNER_CALL_COUNT");
  const [burnCall, remarkCall] = calls;
  if (burnCall.section !== "subtensorModule" || burnCall.method !== "addStakeBurn") throw new Error("INVALID_BURN_CALL");
  if (remarkCall.section !== "system" || remarkCall.method !== "remarkWithEvent") throw new Error("INVALID_REMARK_CALL");

  const [hotkey, netuidCodec, amountCodec, limitOption] = burnCall.args;
  const netuid = Number(netuidCodec.toString());
  const taoSpentRao = BigInt(amountCodec.toString());
  if (netuid <= 0 || taoSpentRao <= 0n || !limitOption.isSome) throw new Error("INVALID_BURN_ARGUMENTS");
  const limitPriceRao = BigInt(limitOption.unwrap().toString());
  if (limitPriceRao <= 0n) throw new Error("INVALID_LIMIT_PRICE");

  const bytes = remarkCall.args[0].toU8a(true);
  const decoded = parseMintPayload(bytes);
  if (decoded.payload.netuid !== netuid) throw new Error("NETUID_MISMATCH");
  if (BigInt(decoded.payload.subnet_generation) !== BigInt(subnetGeneration)) throw new Error("SUBNET_GENERATION_MISMATCH");

  const signer = accountHex(extrinsic.signer);
  const hotkeyHex = accountHex(hotkey);
  const hasSuccess = eventRecords.some(({ event }) => api.events.system.ExtrinsicSuccess.is(event));
  const hasBatch = eventRecords.some(({ event }) => api.events.utility.BatchCompleted.is(event));
  if (!hasSuccess || !hasBatch) throw new Error("ATOMIC_BATCH_FAILED");

  const feePaid = eventRecords.find(({ event }) => api.events.transactionPayment.TransactionFeePaid.is(event));
  if (!feePaid) throw new Error("MISSING_TRANSACTION_FEE_EVENT");
  const [feeSigner, actualFee, tip] = feePaid.event.data;
  const transactionFeeRao = BigInt(actualFee.toString());
  const transactionTipRao = BigInt(tip.toString());
  if (accountHex(feeSigner) !== signer || transactionFeeRao <= 0n || transactionTipRao > transactionFeeRao) {
    throw new Error("TRANSACTION_FEE_EVENT_MISMATCH");
  }

  const stakeBurn = eventRecords.find(({ event }) => api.events.subtensorModule.AddStakeBurn.is(event));
  if (!stakeBurn) throw new Error("MISSING_ADD_STAKE_BURN_EVENT");
  const [eventNetuid, eventHotkey, eventAmount, eventAlpha] = stakeBurn.event.data;
  const alphaBurnedRao = BigInt(eventAlpha.toString());
  if (Number(eventNetuid.toString()) !== netuid || accountHex(eventHotkey) !== hotkeyHex || BigInt(eventAmount.toString()) !== taoSpentRao || alphaBurnedRao <= 0n) throw new Error("ADD_STAKE_BURN_EVENT_MISMATCH");

  const alphaBurn = eventRecords.find(({ event }) => api.events.subtensorModule.AlphaBurned.is(event));
  if (!alphaBurn) throw new Error("MISSING_ALPHA_BURNED_EVENT");
  const [eventSigner, burnedHotkey, burnedAlpha, burnedNetuid] = alphaBurn.event.data;
  if (accountHex(eventSigner) !== signer || accountHex(burnedHotkey) !== hotkeyHex || BigInt(burnedAlpha.toString()) !== alphaBurnedRao || Number(burnedNetuid.toString()) !== netuid) throw new Error("ALPHA_BURNED_EVENT_MISMATCH");

  const remarkHash = blake2AsHex(bytes, 256);
  const remarked = eventRecords.find(({ event }) => api.events.system.Remarked.is(event));
  if (!remarked || accountHex(remarked.event.data[0]) !== signer || remarked.event.data[1].toHex() !== remarkHash) throw new Error("REMARK_EVENT_MISMATCH");

  return {
    ...decoded, netuid, taoSpentRao, alphaBurnedRao, limitPriceRao,
    transactionFeeRao, transactionTipRao, creatorHex: signer, hotkeyHex,
  };
}

export function validateTransfer({ api, extrinsic, eventRecords }) {
  if (!extrinsic.isSigned) throw new Error("UNSIGNED_EXTRINSIC");
  const call = extrinsic.method;
  if (call.section !== "system" || call.method !== "remarkWithEvent") throw new Error("INVALID_TRANSFER_CALL");
  const bytes = call.args[0].toU8a(true);
  const decoded = parseTransferPayload(bytes);
  const signerHex = accountHex(extrinsic.signer);
  const destinationHex = accountHex(decoded.payload.to);
  if (signerHex === destinationHex) throw new Error("TRANSFER_TO_CURRENT_OWNER");
  if (!eventRecords.some(({ event }) => api.events.system.ExtrinsicSuccess.is(event))) throw new Error("TRANSFER_EXTRINSIC_FAILED");
  const feePaid = eventRecords.find(({ event }) => api.events.transactionPayment.TransactionFeePaid.is(event));
  if (!feePaid) throw new Error("MISSING_TRANSACTION_FEE_EVENT");
  const [feeSigner, actualFee, tip] = feePaid.event.data;
  const transactionFeeRao = BigInt(actualFee.toString());
  const transactionTipRao = BigInt(tip.toString());
  if (accountHex(feeSigner) !== signerHex || transactionFeeRao <= 0n || transactionTipRao > transactionFeeRao) {
    throw new Error("TRANSACTION_FEE_EVENT_MISMATCH");
  }
  const remarked = eventRecords.find(({ event }) => api.events.system.Remarked.is(event));
  if (!remarked || accountHex(remarked.event.data[0]) !== signerHex || remarked.event.data[1].toHex() !== decoded.payloadHash) throw new Error("REMARK_EVENT_MISMATCH");
  return {
    ...decoded,
    artifactId: decoded.payload.artifact,
    nonce: decoded.payload.nonce,
    signerHex,
    destinationHex,
    transactionFeeRao,
    transactionTipRao,
  };
}
