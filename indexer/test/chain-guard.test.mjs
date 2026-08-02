import assert from "node:assert/strict";
import test from "node:test";
import { assertExpectedGenesis } from "../../src/lib/chain-guard.ts";

const testnet = `0x${"1".repeat(64)}`;

test("the browser fails closed when an RPC serves the wrong chain", () => {
  assert.equal(assertExpectedGenesis(testnet.toUpperCase().replace("0X", "0x"), testnet), testnet);
  assert.throws(() => assertExpectedGenesis(`0x${"2".repeat(64)}`, testnet), /Wrong Bittensor network/);
  assert.throws(() => assertExpectedGenesis(testnet, "testnet"), /genesis hash is invalid/);
});
