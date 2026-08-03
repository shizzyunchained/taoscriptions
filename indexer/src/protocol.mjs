import { blake2AsHex, decodeAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { createHash } from "node:crypto";

export const INDEXER_VERSION = "0.2.0";
const ALLOWED_KEYS = new Set([
  "p", "v", "op", "netuid", "subnet_generation", "name", "media_type",
  "body", "content_uri", "content_hash", "encoding", "content_length", "width", "height",
  "purpose", "collection", "content_policy",
]);
const TRANSFER_KEYS = new Set(["p", "v", "op", "artifact", "to", "nonce"]);
const IMAGE_MAGIC = Uint8Array.from([0x42, 0x52, 0x49, 0x31]);
const MAX_JSON_REMARK_BYTES = 2_048;
const MAX_MINT_REMARK_BYTES = 16_384;
const MAX_ONCHAIN_IMAGE_BYTES = 12_288;
const RELIC_PURPOSES = new Set(["personal", "collection", "subnet_milestone", "community_message"]);
const MAX_ALPHA_BURN_ROUNDING_RAO = 1n;

function hasImageMagic(bytes) {
  return bytes.length >= IMAGE_MAGIC.length && IMAGE_MAGIC.every((value, index) => bytes[index] === value);
}

function isWebP(bytes) {
  return bytes.length >= 12
    && Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP";
}

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
  const { payload, text, payloadHex, payloadHash, mediaBytes } = parseProtocolPayload(bytes);
  if (Object.keys(payload).some((key) => !ALLOWED_KEYS.has(key))) throw new Error("UNKNOWN_FIELD");
  if (payload.p !== "bittensor-relics" || payload.v !== 1 || payload.op !== "mint") throw new Error("UNSUPPORTED_PROTOCOL");
  if (!Number.isInteger(payload.netuid) || payload.netuid <= 0 || payload.netuid > 65_535) throw new Error("INVALID_NETUID");
  if (!Number.isSafeInteger(payload.subnet_generation) || payload.subnet_generation < 0) throw new Error("INVALID_SUBNET_GENERATION");
  if (typeof payload.name !== "string" || Array.from(payload.name.trim()).length < 1 || Array.from(payload.name.trim()).length > 80) throw new Error("INVALID_NAME");
  if (payload.purpose !== undefined && !RELIC_PURPOSES.has(payload.purpose)) throw new Error("INVALID_PURPOSE");
  if (payload.collection !== undefined && (payload.purpose !== "collection" || typeof payload.collection !== "string" || Array.from(payload.collection.trim()).length < 1 || Array.from(payload.collection.trim()).length > 80)) throw new Error("INVALID_COLLECTION");
  if (payload.purpose === "collection" && typeof payload.collection !== "string") throw new Error("MISSING_COLLECTION");
  if (payload.content_policy !== undefined && payload.content_policy !== "br-safe-1") throw new Error("INVALID_CONTENT_POLICY");
  if (typeof payload.media_type !== "string" || payload.media_type.length < 1 || payload.media_type.length > 255) throw new Error("INVALID_MEDIA_TYPE");
  const onchain = payload.encoding === "binary" && mediaBytes instanceof Uint8Array;
  const inline = typeof payload.body === "string" && !onchain;
  const external = typeof payload.content_uri === "string" && typeof payload.content_hash === "string";
  if ([inline, external, onchain].filter(Boolean).length !== 1) throw new Error("INVALID_CONTENT_FORM");
  if (inline && (Array.from(payload.body.trim()).length < 1 || Array.from(payload.body.trim()).length > 1_024)) throw new Error("INVALID_BODY");
  if (external && !/^sha256:[0-9a-f]{64}$/.test(payload.content_hash)) throw new Error("INVALID_CONTENT_HASH");
  if (external && !/^ipfs:\/\/[a-zA-Z0-9]+(?:\/.*)?$/.test(payload.content_uri)) throw new Error("INVALID_CONTENT_URI");
  if (onchain) {
    if (payload.media_type !== "image/webp") throw new Error("INVALID_ONCHAIN_MEDIA_TYPE");
    if (!isWebP(mediaBytes)) throw new Error("INVALID_WEBP_BYTES");
    if (typeof payload.body === "string" && Array.from(payload.body.trim()).length > 1_024) throw new Error("INVALID_BODY");
    if (!Number.isSafeInteger(payload.content_length) || payload.content_length !== mediaBytes.length) throw new Error("CONTENT_LENGTH_MISMATCH");
    if (mediaBytes.length < 1 || mediaBytes.length > MAX_ONCHAIN_IMAGE_BYTES) throw new Error("INVALID_ONCHAIN_MEDIA_LENGTH");
    if (![payload.width, payload.height].every((value) => Number.isSafeInteger(value) && value >= 64 && value <= 256)) throw new Error("INVALID_IMAGE_DIMENSIONS");
    const contentHash = `sha256:${createHash("sha256").update(mediaBytes).digest("hex")}`;
    if (payload.content_hash !== contentHash) throw new Error("CONTENT_HASH_MISMATCH");
  }
  return { payload, text, payloadHex, payloadHash, mediaBytes };
}

export function parseProtocolPayload(bytes) {
  let manifestBytes = bytes;
  let mediaBytes = null;
  if (hasImageMagic(bytes)) {
    if (bytes.length > MAX_MINT_REMARK_BYTES || bytes.length < 9) throw new Error("PAYLOAD_TOO_LARGE");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const manifestLength = view.getUint32(4, false);
    if (manifestLength < 2 || manifestLength > 4_096 || 8 + manifestLength >= bytes.length) throw new Error("INVALID_IMAGE_ENVELOPE");
    manifestBytes = bytes.slice(8, 8 + manifestLength);
    mediaBytes = bytes.slice(8 + manifestLength);
  } else if (bytes.length > MAX_JSON_REMARK_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes);
  strictJsonScan(text);
  const payload = JSON.parse(text);
  if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new Error("PAYLOAD_NOT_OBJECT");
  if (payload.p !== "bittensor-relics" || payload.v !== 1 || typeof payload.op !== "string") throw new Error("UNSUPPORTED_PROTOCOL");
  return { payload, text, payloadHex: u8aToHex(bytes), payloadHash: blake2AsHex(bytes, 256), mediaBytes };
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
    if (hasImageMagic(bytes)) return bytes;
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
  const nominalAlphaRao = BigInt(eventAlpha.toString());
  if (Number(eventNetuid.toString()) !== netuid || accountHex(eventHotkey) !== hotkeyHex || BigInt(eventAmount.toString()) !== taoSpentRao || nominalAlphaRao <= 0n) throw new Error("ADD_STAKE_BURN_EVENT_MISMATCH");

  const alphaBurn = eventRecords.find(({ event }) => api.events.subtensorModule.AlphaBurned.is(event));
  if (!alphaBurn) throw new Error("MISSING_ALPHA_BURNED_EVENT");
  const [eventSigner, burnedHotkey, burnedAlpha, burnedNetuid] = alphaBurn.event.data;
  const alphaBurnedRao = BigInt(burnedAlpha.toString());
  const roundingDeltaRao = nominalAlphaRao - alphaBurnedRao;
  if (accountHex(eventSigner) !== signer || accountHex(burnedHotkey) !== hotkeyHex || alphaBurnedRao <= 0n || roundingDeltaRao < 0n || roundingDeltaRao > MAX_ALPHA_BURN_ROUNDING_RAO || Number(burnedNetuid.toString()) !== netuid) throw new Error("ALPHA_BURNED_EVENT_MISMATCH");

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
