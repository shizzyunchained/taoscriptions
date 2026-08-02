const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const MAX_EXTRINSIC_INDEX = 4_294_967_295;

export function parseChainPosition(block: string, extrinsic: string) {
  if (!/^\d+$/.test(block) || !/^\d+$/.test(extrinsic)) return null;
  const blockNumber = BigInt(block);
  const extrinsicIndex = Number.parseInt(extrinsic, 10);
  if (
    blockNumber > MAX_POSTGRES_BIGINT ||
    !Number.isSafeInteger(extrinsicIndex) ||
    extrinsicIndex > MAX_EXTRINSIC_INDEX
  ) return null;
  return { blockNumber: blockNumber.toString(), extrinsicIndex };
}
