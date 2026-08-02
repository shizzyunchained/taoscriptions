import assert from "node:assert/strict";
import test from "node:test";
import { stringToU8a, u8aToHex, u8aWrapBytes } from "@polkadot/util";
import { cryptoWaitReady, sr25519PairFromSeed, sr25519Sign } from "@polkadot/util-crypto";
import {
  buildCancellationMessage,
  buildListingMessage,
  messageId,
  normalizeAccount,
  verifyRawSignature,
} from "../../src/lib/listing-protocol.mjs";

await cryptoWaitReady();
const pair = sr25519PairFromSeed(new Uint8Array(32).fill(7));
const seller = normalizeAccount(u8aToHex(pair.publicKey));
const chain = `0x${"1".repeat(64)}`;
const artifact = `br1:${chain}:42:3`;

test("builds and verifies a canonical wallet listing authorization", async () => {
  const message = buildListingMessage({
    chain, artifact, seller, ownershipNonce: "2", priceRao: "500000000",
    expiryBlock: "12345", nonce: "a".repeat(64), buyer: "*",
  });
  assert.equal(message.endsWith("\n"), true);
  assert.match(messageId(message), /^0x[0-9a-f]{64}$/);
  const signature = u8aToHex(sr25519Sign(stringToU8a(message), pair));
  assert.equal(await verifyRawSignature(message, signature, seller), true);
  assert.equal(await verifyRawSignature(message.replace("500000000", "1"), signature, seller), false);
});

test("accepts the wrapped-byte form used by Polkadot wallet signers", async () => {
  const message = buildCancellationMessage({ chain, listingId: `0x${"b".repeat(64)}`, seller });
  const signature = u8aToHex(sr25519Sign(u8aWrapBytes(stringToU8a(message)), pair));
  assert.equal(await verifyRawSignature(message, signature, seller), true);
});
