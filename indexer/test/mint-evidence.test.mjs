import assert from "node:assert/strict";
import test from "node:test";
import { createMintEvidence } from "../../src/lib/mint-evidence.ts";

const hash = (character) => `0x${character.repeat(64)}`;

test("builds the canonical relic identifier from finalized chain position", () => {
  const evidence = createMintEvidence({
    genesisHash: hash("1"), runtimeSpec: "440", blockNumber: "7692897",
    blockHash: hash("2"), extrinsicIndex: 3, extrinsicHash: hash("3"),
    signerAddress: "5Signer", signerAccountHex: hash("4"), routeHotkey: "5Hotkey",
    routeHotkeyHex: hash("5"), netuid: 1, subnetGeneration: "3536",
    taoSpentRao: "5000000", alphaBurnedRao: "5203697846", limitPriceRao: "979555",
    transactionFeeRao: "1710598", transactionTipRao: "0", payload: "{}",
    payloadHash: hash("6"), quoteBlock: "7692890", finalizedAt: "2026-08-02T08:00:00.000Z",
  });
  assert.equal(evidence.artifactId, `nr1:${hash("1")}:7692897:3`);
  assert.equal(evidence.transactionFeeRao, "1710598");
  assert.equal(evidence.protocolVersion, 1);
});
