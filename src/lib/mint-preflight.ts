export function assertMintPreflight(input: {
  reviewedGeneration: string;
  currentGeneration: string;
  subtokenEnabled: boolean;
  poolTaoRao: bigint;
  minimumPoolTaoRao: bigint;
  freeBalanceRao: bigint;
  spendRao: bigint;
  estimatedFeeRao: bigint;
  existentialDepositRao: bigint;
}) {
  if (input.currentGeneration !== input.reviewedGeneration) {
    throw new Error("This subnet was re-registered. Refresh its identity before minting.");
  }
  if (!input.subtokenEnabled) throw new Error("Alpha operations are currently disabled on this subnet.");
  if (input.poolTaoRao < input.minimumPoolTaoRao) throw new Error("POOL_INPUT_BELOW_MINIMUM_STAKE");
  const required = input.spendRao + input.estimatedFeeRao + input.existentialDepositRao;
  if (input.freeBalanceRao < required) throw new Error("INSUFFICIENT_FREE_TAO");
  return { requiredBalanceRao: required };
}
