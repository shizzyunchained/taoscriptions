import assert from "node:assert/strict";
import test from "node:test";
import { verifyFinalizedMintReceipt } from "../../src/lib/mint-receipt.ts";

const signer = `0x${"1".repeat(64)}`;
const hotkey = `0x${"2".repeat(64)}`;
const remarkHash = `0x${"a".repeat(64)}`;
const codec = (value, hex = null) => ({ toString: () => String(value), ...(hex ? { toHex: () => hex } : {}) });
const event = (section, method, data = []) => ({ event: { section, method, data } });
const expected = { signerAccountHex: signer, routeHotkeyHex: hotkey, netuid: 1, taoAmountRao: 5_000_000n, remarkHash };

function validEvents() {
  return [
    event("subtensorModule", "AddStakeBurn", [codec(1), codec(hotkey, hotkey), codec(5_000_000), codec(5_203_000_000)]),
    event("subtensorModule", "AlphaBurned", [codec(signer, signer), codec(hotkey, hotkey), codec(5_203_000_000), codec(1)]),
    event("system", "Remarked", [codec(signer, signer), codec(remarkHash, remarkHash)]),
    event("utility", "BatchCompleted"),
    event("system", "ExtrinsicSuccess"),
  ];
}

test("accepts only a finalized mint receipt matching every signed intent field", () => {
  assert.deepEqual(verifyFinalizedMintReceipt({ eventRecords: validEvents(), expected }), { alphaBurnedRao: 5_203_000_000n });
});

test("rejects a receipt with missing success or mismatched burn and remark evidence", () => {
  assert.throws(
    () => verifyFinalizedMintReceipt({ eventRecords: validEvents().filter(({ event: item }) => item.method !== "ExtrinsicSuccess"), expected }),
    /MINT_EXTRINSIC_FAILED/,
  );
  const wrongHotkeyEvents = validEvents();
  wrongHotkeyEvents[0] = event("subtensorModule", "AddStakeBurn", [codec(1), codec(signer, signer), codec(5_000_000), codec(5_203_000_000)]);
  assert.throws(() => verifyFinalizedMintReceipt({ eventRecords: wrongHotkeyEvents, expected }), /ADD_STAKE_BURN_EVENT_MISMATCH/);
  const wrongRemarkEvents = validEvents();
  wrongRemarkEvents[2] = event("system", "Remarked", [codec(signer, signer), codec(`0x${"b".repeat(64)}`, `0x${"b".repeat(64)}`)]);
  assert.throws(() => verifyFinalizedMintReceipt({ eventRecords: wrongRemarkEvents, expected }), /REMARK_EVENT_MISMATCH/);
});
