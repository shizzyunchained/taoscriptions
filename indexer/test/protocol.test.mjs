import assert from "node:assert/strict";
import test from "node:test";
import { blake2AsHex } from "@polkadot/util-crypto";
import { findProtocolRemark, parseMintPayload, parseTransferPayload, validateMint } from "../src/protocol.mjs";

const encode = (value) => new TextEncoder().encode(value);
const inline = (overrides = {}) => ({
  p: "neural-relics",
  v: 1,
  op: "mint",
  netuid: 1,
  subnet_generation: 123,
  name: "Test Relic",
  media_type: "text/plain;charset=utf-8",
  body: "hello",
  ...overrides,
});

test("accepts a canonical inline mint", () => {
  const result = parseMintPayload(encode(JSON.stringify(inline())));
  assert.equal(result.payload.name, "Test Relic");
  assert.match(result.payloadHash, /^0x[0-9a-f]{64}$/);
});

test("accepts a content-addressed mint", () => {
  const payload = inline({
    body: undefined,
    media_type: "image/png",
    content_uri: "ipfs://bafyexample",
    content_hash: `sha256:${"a".repeat(64)}`,
  });
  delete payload.body;
  assert.equal(parseMintPayload(encode(JSON.stringify(payload))).payload.media_type, "image/png");
});

test("rejects duplicate keys, floats, unknown fields, and oversized remarks", () => {
  const invalid = [
    '{"p":"neural-relics","p":"neural-relics","v":1,"op":"mint","netuid":1,"subnet_generation":123,"name":"Test","media_type":"text/plain","body":"hello"}',
    '{"p":"neural-relics","v":1.0,"op":"mint","netuid":1,"subnet_generation":123,"name":"Test","media_type":"text/plain","body":"hello"}',
    JSON.stringify(inline({ extra: true })),
    JSON.stringify(inline({ body: "x".repeat(2_100) })),
  ];
  for (const value of invalid) assert.throws(() => parseMintPayload(encode(value)));
});

test("discovers protocol remarks even when the identifier uses a JSON escape", () => {
  const text = JSON.stringify(inline()).replace("neural-relics", "neural\\u002drelics");
  const bytes = encode(text);
  const call = {
    section: "system",
    method: "remarkWithEvent",
    args: [{ toU8a: () => bytes }],
  };
  assert.deepEqual(findProtocolRemark(call), bytes);
  assert.equal(parseMintPayload(bytes).payload.p, "neural-relics");
});

test("accepts canonical transfers and rejects malformed ownership nonces", () => {
  const destination = `0x${"2".repeat(64)}`;
  const transfer = {
    p: "neural-relics",
    v: 1,
    op: "transfer",
    artifact: `nr1:0x${"1".repeat(64)}:10:2`,
    to: destination,
    nonce: 1,
  };
  assert.equal(parseTransferPayload(encode(JSON.stringify(transfer))).payload.to, destination);
  assert.throws(() => parseTransferPayload(encode(JSON.stringify({ ...transfer, nonce: 0 }))));
  assert.throws(() => parseTransferPayload(encode(JSON.stringify({ ...transfer, extra: true }))));
});

test("accepted mints require the finalized fee payer and actual fee", () => {
  const signer = `0x${"1".repeat(64)}`;
  const hotkey = `0x${"2".repeat(64)}`;
  const bytes = encode(JSON.stringify(inline()));
  const codec = (value, hex = null) => ({
    toString: () => String(value),
    ...(hex ? { toHex: () => hex } : {}),
  });
  const call = (section, method, args = []) => ({ section, method, args });
  const event = (section, method, data = []) => ({ event: { section, method, data } });
  const guards = new Proxy({}, {
    get: (_target, section) => new Proxy({}, {
      get: (_sectionTarget, method) => ({ is: (candidate) => candidate.section === section && candidate.method === method }),
    }),
  });
  const extrinsic = {
    isSigned: true,
    signer: codec(signer),
    method: call("utility", "batchAll", [[
      call("subtensorModule", "addStakeBurn", [
        codec(hotkey), codec(1), codec(5_000_000), { isSome: true, unwrap: () => codec(979_555) },
      ]),
      call("system", "remarkWithEvent", [{ toU8a: () => bytes }]),
    ]]),
  };
  const records = [
    event("transactionPayment", "TransactionFeePaid", [codec(signer), codec(1_710_598), codec(0)]),
    event("subtensorModule", "AddStakeBurn", [codec(1), codec(hotkey), codec(5_000_000), codec(5_203_000_000)]),
    event("subtensorModule", "AlphaBurned", [codec(signer), codec(hotkey), codec(5_203_000_000), codec(1)]),
    event("system", "Remarked", [codec(signer), codec(blake2AsHex(bytes, 256), blake2AsHex(bytes, 256))]),
    event("utility", "BatchCompleted"),
    event("system", "ExtrinsicSuccess"),
  ];
  const result = validateMint({ api: { events: guards }, extrinsic, eventRecords: records, subnetGeneration: "123" });
  assert.equal(result.transactionFeeRao, 1_710_598n);
  assert.throws(
    () => validateMint({ api: { events: guards }, extrinsic, eventRecords: records.slice(1), subnetGeneration: "123" }),
    /MISSING_TRANSACTION_FEE_EVENT/,
  );
});
