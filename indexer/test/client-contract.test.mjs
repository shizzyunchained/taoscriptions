import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { hexToU8a } from "@polkadot/util";
import {
  calculateLimitPrice,
  createInlineMintPayload,
  createOnChainImageMintPayload,
  createTransferPayload,
  DEFAULT_SLIPPAGE_BPS,
} from "../../src/lib/protocol.ts";
import { parseMintPayload, parseTransferPayload } from "../src/protocol.mjs";

const genesis = `0x${"1".repeat(64)}`;
const artifactId = `br1:${genesis}:100:2`;

test("browser mint bytes satisfy the strict indexer contract", () => {
  const created = createInlineMintPayload({
    netuid: 1,
    subnetGeneration: "3536",
    name: "  Contract proof  ",
    body: "  The browser and indexer agree.  ",
  });
  const parsed = parseMintPayload(hexToU8a(created.hex));
  assert.equal(parsed.text, created.json);
  assert.equal(parsed.payload.name, "Contract proof");
  assert.equal(parsed.payload.body, "The browser and indexer agree.");
  assert.equal(parsed.payload.subnet_generation, 3536);
  assert.equal(created.byteLength, new TextEncoder().encode(created.json).length);
});

test("browser on-chain image bytes satisfy the strict indexer contract", () => {
  const imageBytes = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
  const created = createOnChainImageMintPayload({
    netuid: 1,
    subnetGeneration: "3536",
    name: "Personal relic",
    body: "Forever on-chain",
    imageBytes,
    contentHash: `sha256:${createHash("sha256").update(imageBytes).digest("hex")}`,
    width: 128,
    height: 128,
  });
  const parsed = parseMintPayload(hexToU8a(created.hex));
  assert.deepEqual(parsed.mediaBytes, imageBytes);
  assert.equal(parsed.payload.name, "Personal relic");
  assert.equal(parsed.payload.body, "Forever on-chain");
  assert.equal(created.imageByteLength, imageBytes.length);
});

test("browser transfer bytes satisfy the strict indexer contract", () => {
  const destination = `0x${"2".repeat(64)}`;
  const created = createTransferPayload({ artifactId, destinationAccountHex: destination, ownershipNonce: 7 });
  const parsed = parseTransferPayload(hexToU8a(created.hex));
  assert.equal(parsed.text, created.json);
  assert.equal(parsed.payload.artifact, artifactId);
  assert.equal(parsed.payload.to, destination);
  assert.equal(parsed.payload.nonce, 7);
});

test("client builders reject ambiguous or unsupported intent", () => {
  assert.throws(() => createInlineMintPayload({ netuid: 0, subnetGeneration: "1", name: "x", body: "y" }), /non-root subnet/);
  assert.throws(() => createInlineMintPayload({ netuid: 1, subnetGeneration: "1.5", name: "x", body: "y" }), /generation/);
  assert.throws(() => createInlineMintPayload({ netuid: 1, subnetGeneration: "1", name: " ", body: "y" }), /names/);
  assert.throws(() => createTransferPayload({ artifactId, destinationAccountHex: "0x12", ownershipNonce: 1 }), /AccountId32/);
  assert.throws(() => createTransferPayload({ artifactId, destinationAccountHex: `0x${"2".repeat(64)}`, ownershipNonce: 0 }), /nonce/);
});

test("slippage limit rounds upward from spot price and remains explicitly bounded", () => {
  assert.equal(calculateLimitPrice(959_392n, DEFAULT_SLIPPAGE_BPS), 978_580n);
  assert.equal(calculateLimitPrice(959_392n, 0n), 959_392n);
  assert.throws(() => calculateLimitPrice(0n), /nonzero spot price/);
  assert.throws(() => calculateLimitPrice(1n, 1_001n), /between 0% and 10%/);
});
