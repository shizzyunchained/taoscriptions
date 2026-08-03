export type TransferEvidence = {
  protocol: "bittensor-relics"; protocolVersion: 1; operation: "transfer"; network: "testnet";
  transferId: string; artifactId: string; genesisHash: string; runtimeSpec: string;
  blockNumber: string; blockHash: string; extrinsicIndex: number; extrinsicHash: string;
  fromAddress: string; fromAccountHex: string; toAccountHex: string; ownershipNonce: number;
  transactionFeeRao: string; transactionTipRao: string; payloadHash: string; finalizedAt: string;
};

type Input = Omit<TransferEvidence, "protocol" | "protocolVersion" | "operation" | "network" | "transferId">;
const HASH = /^0x[0-9a-f]{64}$/;

export function createTransferEvidence(input: Input): TransferEvidence {
  const genesisHash = input.genesisHash.toLowerCase();
  const blockHash = input.blockHash.toLowerCase();
  const extrinsicHash = input.extrinsicHash.toLowerCase();
  if (![genesisHash, blockHash, extrinsicHash, input.payloadHash.toLowerCase()].every((value) => HASH.test(value))) {
    throw new Error("INVALID_EVIDENCE_HASH");
  }
  if (!/^\d+$/.test(input.blockNumber) || !Number.isSafeInteger(input.extrinsicIndex) || input.extrinsicIndex < 0) {
    throw new Error("INVALID_CHAIN_POSITION");
  }
  return {
    protocol: "bittensor-relics", protocolVersion: 1, operation: "transfer", network: "testnet",
    ...input, genesisHash, blockHash, extrinsicHash, payloadHash: input.payloadHash.toLowerCase(),
    transferId: `nrt1:${genesisHash}:${input.blockNumber}:${input.extrinsicIndex}`,
  };
}
