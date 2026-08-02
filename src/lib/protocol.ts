export const PROTOCOL_ID = "neural-relics";
export const PROTOCOL_VERSION = 1;
export const MAX_REMARK_BYTES = 2_048;
export const DEFAULT_SLIPPAGE_BPS = 200n;
const BPS_DENOMINATOR = 10_000n;
const ALPHA_UNITS = 1_000_000_000n;

type InlineMintInput = {
  netuid: number;
  subnetGeneration: string;
  name: string;
  body: string;
};

export function createInlineMintPayload(input: InlineMintInput) {
  const name = input.name.trim();
  const body = input.body.trim();

  if (!Number.isSafeInteger(input.netuid) || input.netuid <= 0 || input.netuid > 65_535) {
    throw new Error("Choose a valid non-root subnet.");
  }
  if (!/^\d+$/.test(input.subnetGeneration)) {
    throw new Error("The subnet generation is unavailable.");
  }
  if (Array.from(name).length < 1 || Array.from(name).length > 80) {
    throw new Error("Relic names must contain 1 to 80 characters.");
  }
  if (Array.from(body).length < 1 || Array.from(body).length > 1_024) {
    throw new Error("Inline inscriptions must contain 1 to 1,024 characters.");
  }

  const json = JSON.stringify({
    p: PROTOCOL_ID,
    v: PROTOCOL_VERSION,
    op: "mint",
    netuid: input.netuid,
    subnet_generation: Number.parseInt(input.subnetGeneration, 10),
    name,
    media_type: "text/plain;charset=utf-8",
    body,
  });
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_REMARK_BYTES) {
    throw new Error(`The encoded inscription is ${bytes.length} bytes; the v1 limit is ${MAX_REMARK_BYTES}.`);
  }

  const hex = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { json, hex, byteLength: bytes.length };
}

export function calculateLimitPrice(
  taoPaidRao: bigint,
  expectedAlphaRao: bigint,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
) {
  if (taoPaidRao <= 0n || expectedAlphaRao <= 0n) {
    throw new Error("A fresh nonzero quote is required.");
  }
  if (slippageBps < 0n || slippageBps > 1_000n) {
    throw new Error("Slippage tolerance must be between 0% and 10%.");
  }

  const quotedPrice = (taoPaidRao * ALPHA_UNITS + expectedAlphaRao - 1n) / expectedAlphaRao;
  return (quotedPrice * (BPS_DENOMINATOR + slippageBps) + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
}

export function createTransferPayload(input: {
  artifactId: string;
  destinationAccountHex: string;
  ownershipNonce: number;
}) {
  if (!/^nr1:0x[0-9a-f]{64}:\d+:\d+$/.test(input.artifactId)) {
    throw new Error("The relic ID is not canonical.");
  }
  if (!/^0x[0-9a-f]{64}$/.test(input.destinationAccountHex)) {
    throw new Error("The destination must be a valid AccountId32.");
  }
  if (!Number.isSafeInteger(input.ownershipNonce) || input.ownershipNonce < 1) {
    throw new Error("The next ownership nonce is invalid.");
  }
  const json = JSON.stringify({
    p: PROTOCOL_ID,
    v: PROTOCOL_VERSION,
    op: "transfer",
    artifact: input.artifactId,
    to: input.destinationAccountHex,
    nonce: input.ownershipNonce,
  });
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_REMARK_BYTES) throw new Error("The transfer payload exceeds the protocol limit.");
  return {
    json,
    hex: `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
    byteLength: bytes.length,
  };
}
