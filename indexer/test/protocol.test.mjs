import assert from "node:assert/strict";
import test from "node:test";
import { findProtocolRemark, parseMintPayload, parseTransferPayload } from "../src/protocol.mjs";

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
