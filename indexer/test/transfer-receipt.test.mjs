import assert from "node:assert/strict";
import test from "node:test";
import { createTransferEvidence } from "../../src/lib/transfer-evidence.ts";
import { verifyFinalizedTransferReceipt } from "../../src/lib/transfer-receipt.ts";

const signer = `0x${"1".repeat(64)}`;
const payloadHash = `0x${"2".repeat(64)}`;
const codec = (value, encoded = null) => ({ toString: () => String(value), ...(encoded ? { toHex: () => encoded } : {}) });
const event = (section, method, data = []) => ({ event: { section, method, data } });
const valid = () => [
  event("transactionPayment", "TransactionFeePaid", [codec(signer, signer), codec(900_000), codec(0)]),
  event("system", "Remarked", [codec(signer, signer), codec(payloadHash, payloadHash)]),
  event("system", "ExtrinsicSuccess"),
];

test("transfer receipts bind success, signer, payload, and actual fee", () => {
  assert.deepEqual(verifyFinalizedTransferReceipt({ eventRecords: valid(), signerAccountHex: signer, payloadHash }), {
    transactionFeeRao: 900_000n, transactionTipRao: 0n,
  });
  assert.throws(() => verifyFinalizedTransferReceipt({ eventRecords: valid().slice(1), signerAccountHex: signer, payloadHash }), /MISSING_TRANSACTION_FEE_EVENT/);
  assert.throws(() => verifyFinalizedTransferReceipt({ eventRecords: valid().slice(0, 2), signerAccountHex: signer, payloadHash }), /TRANSFER_EXTRINSIC_FAILED/);
});

test("transfer evidence derives its canonical ID from finality", () => {
  const hash = (character) => `0x${character.repeat(64)}`;
  const evidence = createTransferEvidence({
    artifactId: `nr1:${hash("a")}:10:2`, genesisHash: hash("a"), runtimeSpec: "440",
    blockNumber: "20", blockHash: hash("b"), extrinsicIndex: 3, extrinsicHash: hash("c"),
    fromAddress: "5From", fromAccountHex: signer, toAccountHex: hash("d"), ownershipNonce: 1,
    transactionFeeRao: "900000", transactionTipRao: "0", payloadHash, finalizedAt: "2026-08-02T00:00:00.000Z",
  });
  assert.equal(evidence.transferId, `nrt1:${hash("a")}:20:3`);
});
