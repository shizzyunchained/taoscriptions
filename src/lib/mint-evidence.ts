export type MintEvidence = {
  protocol: "neural-relics";
  protocolVersion: 1;
  network: "testnet";
  artifactId: string;
  genesisHash: string;
  runtimeSpec: string;
  blockNumber: string;
  blockHash: string;
  extrinsicIndex: number;
  extrinsicHash: string;
  signerAddress: string;
  signerAccountHex: string;
  routeHotkey: string;
  routeHotkeyHex: string;
  netuid: number;
  subnetGeneration: string;
  taoSpentRao: string;
  alphaBurnedRao: string;
  limitPriceRao: string;
  transactionFeeRao: string;
  transactionTipRao: string;
  payload: string;
  payloadHash: string;
  quoteBlock: string;
  finalizedAt: string;
};

type MintEvidenceInput = Omit<MintEvidence, "protocol" | "protocolVersion" | "network" | "artifactId">;

const HASH = /^0x[0-9a-f]{64}$/;

export function createMintEvidence(input: MintEvidenceInput): MintEvidence {
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
    protocol: "neural-relics",
    protocolVersion: 1,
    network: "testnet",
    ...input,
    genesisHash,
    blockHash,
    extrinsicHash,
    payloadHash: input.payloadHash.toLowerCase(),
    artifactId: `nr1:${genesisHash}:${input.blockNumber}:${input.extrinsicIndex}`,
  };
}
