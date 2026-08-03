import assert from "node:assert/strict";
import test from "node:test";
import { boundedFinalizedTarget, parseBlockBounds, reachedStopBlock } from "../src/config.mjs";

test("requires an explicit positive start block", () => {
  assert.deepEqual(parseBlockBounds({ START_BLOCK: "100" }), { startBlock: 100, stopBlock: null });
  for (const value of [undefined, "", "0", "-1", "1.5", "word"]) {
    assert.throws(() => parseBlockBounds({ START_BLOCK: value }), /START_BLOCK/);
  }
});

test("accepts only a deterministic stop at or after start", () => {
  assert.deepEqual(parseBlockBounds({ START_BLOCK: "100", STOP_BLOCK: "150" }), { startBlock: 100, stopBlock: 150 });
  assert.deepEqual(parseBlockBounds({ START_BLOCK: "100", STOP_BLOCK: "100" }), { startBlock: 100, stopBlock: 100 });
  for (const value of ["99", "0", "-1", "150.5", "word"]) {
    assert.throws(() => parseBlockBounds({ START_BLOCK: "100", STOP_BLOCK: value }), /STOP_BLOCK/);
  }
});

test("caps replay work at the chosen finalized checkpoint", () => {
  assert.equal(boundedFinalizedTarget(200, null), 200);
  assert.equal(boundedFinalizedTarget(200, 150), 150);
  assert.equal(boundedFinalizedTarget(125, 150), 125);
  assert.equal(reachedStopBlock(149, 150), false);
  assert.equal(reachedStopBlock(150, 150), true);
});
