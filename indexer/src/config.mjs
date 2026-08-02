export function parseBlockBounds(env = process.env) {
  const rawStart = env.START_BLOCK?.trim() ?? "";
  const startBlock = Number.parseInt(rawStart, 10);
  if (!/^\d+$/.test(rawStart) || !Number.isSafeInteger(startBlock) || startBlock < 1) {
    throw new Error("START_BLOCK must be an explicit positive finalized block number.");
  }

  const rawStop = env.STOP_BLOCK?.trim() ?? "";
  if (!rawStop) return { startBlock, stopBlock: null };

  const stopBlock = Number.parseInt(rawStop, 10);
  if (!/^\d+$/.test(rawStop) || !Number.isSafeInteger(stopBlock) || stopBlock < startBlock) {
    throw new Error("STOP_BLOCK must be an explicit finalized block number at or after START_BLOCK.");
  }
  return { startBlock, stopBlock };
}

export function boundedFinalizedTarget(finalizedHead, stopBlock) {
  if (!Number.isSafeInteger(finalizedHead) || finalizedHead < 0) {
    throw new Error("Finalized head must be a nonnegative safe integer.");
  }
  return stopBlock === null ? finalizedHead : Math.min(finalizedHead, stopBlock);
}

export function reachedStopBlock(processedBlock, stopBlock) {
  return stopBlock !== null && processedBlock >= stopBlock;
}
