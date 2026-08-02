import assert from "node:assert/strict";
import test from "node:test";
import { assertMintPreflight } from "../../src/lib/mint-preflight.ts";

const valid = (overrides = {}) => ({
  reviewedGeneration: "3536", currentGeneration: "3536", subtokenEnabled: true,
  poolTaoRao: 4_997_483n, minimumPoolTaoRao: 2_000_000n,
  freeBalanceRao: 10_000_000n, spendRao: 5_000_000n,
  estimatedFeeRao: 1_710_598n, existentialDepositRao: 500n,
  ...overrides,
});

test("mint preflight fails before signing on stale subnet, disabled alpha, pool minimum, or balance", () => {
  assert.equal(assertMintPreflight(valid()).requiredBalanceRao, 6_711_098n);
  assert.throws(() => assertMintPreflight(valid({ currentGeneration: "3537" })), /re-registered/);
  assert.throws(() => assertMintPreflight(valid({ subtokenEnabled: false })), /disabled/);
  assert.throws(() => assertMintPreflight(valid({ poolTaoRao: 1_999_999n })), /POOL_INPUT_BELOW_MINIMUM_STAKE/);
  assert.throws(() => assertMintPreflight(valid({ freeBalanceRao: 6_711_097n })), /INSUFFICIENT_FREE_TAO/);
});
