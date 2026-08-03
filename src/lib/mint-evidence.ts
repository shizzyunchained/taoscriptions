export type MintEvidence = {
  protocol: "bittensor-relics";
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
    protocol: "bittensor-relics",
    protocolVersion: 1,
    network: "testnet",
    ...input,
    genesisHash,
    blockHash,
    extrinsicHash,
    payloadHash: input.payloadHash.toLowerCase(),
    artifactId: `br1:${genesisHash}:${input.blockNumber}:${input.extrinsicIndex}`,
  };
}

const EVIDENCE_KEYS = [
  "alphaBurnedRao", "artifactId", "blockHash", "blockNumber", "extrinsicHash",
  "extrinsicIndex", "finalizedAt", "genesisHash", "limitPriceRao", "netuid",
  "network", "payload", "payloadHash", "protocol", "protocolVersion", "quoteBlock",
  "routeHotkey", "routeHotkeyHex", "runtimeSpec", "signerAccountHex", "signerAddress",
  "subnetGeneration", "taoSpentRao", "transactionFeeRao", "transactionTipRao",
] as const;

export function parseMintEvidenceJson(text: string): MintEvidence {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("INVALID_EVIDENCE_JSON"); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("INVALID_EVIDENCE_OBJECT");
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join("\n") !== [...EVIDENCE_KEYS].sort().join("\n")) throw new Error("INVALID_EVIDENCE_FIELDS");
  if (record.protocol !== "bittensor-relics" || record.protocolVersion !== 1 || record.network !== "testnet") {
    throw new Error("INVALID_EVIDENCE_PROTOCOL");
  }
  const decimalFields = [
    "blockNumber", "runtimeSpec", "quoteBlock", "subnetGeneration", "taoSpentRao",
    "alphaBurnedRao", "limitPriceRao", "transactionFeeRao", "transactionTipRao",
  ];
  for (const field of decimalFields) {
    if (typeof record[field] !== "string" || !/^\d+$/.test(record[field])) throw new Error(`INVALID_EVIDENCE_${field}`);
  }
  if (!["taoSpentRao", "alphaBurnedRao", "limitPriceRao", "transactionFeeRao"].every((field) => BigInt(record[field] as string) > 0n)) {
    throw new Error("INVALID_EVIDENCE_AMOUNT");
  }
  if (BigInt(record.transactionTipRao as string) > BigInt(record.transactionFeeRao as string)) throw new Error("INVALID_EVIDENCE_TIP");
  if (!Number.isSafeInteger(record.extrinsicIndex) || (record.extrinsicIndex as number) < 0) throw new Error("INVALID_CHAIN_POSITION");
  if (!Number.isSafeInteger(record.netuid) || (record.netuid as number) <= 0) throw new Error("INVALID_EVIDENCE_NETUID");
  if (typeof record.payload !== "string" || typeof record.signerAddress !== "string" || typeof record.routeHotkey !== "string") {
    throw new Error("INVALID_EVIDENCE_TEXT");
  }
  if (![record.signerAccountHex, record.routeHotkeyHex].every((value) => typeof value === "string" && HASH.test(value))) {
    throw new Error("INVALID_EVIDENCE_ACCOUNT");
  }
  if (typeof record.finalizedAt !== "string" || !Number.isFinite(Date.parse(record.finalizedAt))) throw new Error("INVALID_EVIDENCE_TIME");
  const evidence = createMintEvidence(record as unknown as MintEvidenceInput);
  if (record.artifactId !== evidence.artifactId) throw new Error("ARTIFACT_ID_MISMATCH");
  return evidence;
}
