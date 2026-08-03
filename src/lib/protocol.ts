export const PROTOCOL_ID = "bittensor-relics";
export const PROTOCOL_VERSION = 1;
export const MAX_JSON_REMARK_BYTES = 2_048;
export const MAX_ONCHAIN_IMAGE_BYTES = 12_288;
export const MAX_MINT_REMARK_BYTES = 16_384;
export const DEFAULT_SLIPPAGE_BPS = 200n;
export const CONTENT_POLICY_ID = "br-safe-1";
export const RELIC_PURPOSES = ["personal", "collection", "subnet_milestone", "community_message"] as const;
const BPS_DENOMINATOR = 10_000n;
const IMAGE_MAGIC = new TextEncoder().encode("BRI1");

export type RelicPurpose = (typeof RELIC_PURPOSES)[number];

type InlineMintInput = {
  netuid: number;
  subnetGeneration: string;
  name: string;
  body: string;
  purpose?: RelicPurpose;
  collection?: string;
  contentPolicy?: typeof CONTENT_POLICY_ID;
};

type OnChainImageMintInput = InlineMintInput & {
  imageBytes: Uint8Array;
  contentHash: string;
  width: number;
  height: number;
};

function bytesToHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isWebP(bytes: Uint8Array) {
  return bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

function validateMintIdentity(input: InlineMintInput) {
  const name = input.name.trim();
  const body = input.body.trim();
  const purpose = input.purpose ?? "personal";
  const collection = input.collection?.trim() ?? "";
  if (!Number.isSafeInteger(input.netuid) || input.netuid <= 0 || input.netuid > 65_535) {
    throw new Error("Choose a valid non-root subnet.");
  }
  if (!/^\d+$/.test(input.subnetGeneration)) throw new Error("The subnet generation is unavailable.");
  if (Array.from(name).length < 1 || Array.from(name).length > 80) {
    throw new Error("Relic names must contain 1 to 80 characters.");
  }
  if (Array.from(body).length > 1_024) throw new Error("Inscriptions may contain up to 1,024 characters.");
  if (!RELIC_PURPOSES.includes(purpose)) throw new Error("Choose a valid Relic purpose.");
  if (purpose === "collection" && (Array.from(collection).length < 1 || Array.from(collection).length > 80)) {
    throw new Error("Collection labels must contain 1 to 80 characters.");
  }
  if (purpose !== "collection" && collection) throw new Error("Only collection entries may include a collection label.");
  if (input.contentPolicy !== undefined && input.contentPolicy !== CONTENT_POLICY_ID) {
    throw new Error("The Relic content policy is not supported.");
  }
  return { name, body, purpose, collection };
}

export function createInlineMintPayload(input: InlineMintInput) {
  const { name, body, purpose, collection } = validateMintIdentity(input);
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
    purpose,
    ...(collection ? { collection } : {}),
    ...(input.contentPolicy ? { content_policy: input.contentPolicy } : {}),
    media_type: "text/plain;charset=utf-8",
    body,
  });
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_JSON_REMARK_BYTES) {
    throw new Error(`The encoded inscription is ${bytes.length} bytes; the text limit is ${MAX_JSON_REMARK_BYTES}.`);
  }

  const hex = bytesToHex(bytes);
  return { json, hex, byteLength: bytes.length };
}

export function createOnChainImageMintPayload(input: OnChainImageMintInput) {
  const { name, body, purpose, collection } = validateMintIdentity(input);
  if (!(input.imageBytes instanceof Uint8Array) || input.imageBytes.length < 1) {
    throw new Error("Choose an image to store on-chain.");
  }
  if (!isWebP(input.imageBytes)) throw new Error("The prepared image is not a valid WebP payload.");
  if (input.imageBytes.length > MAX_ONCHAIN_IMAGE_BYTES) {
    throw new Error(`The compressed image exceeds the ${MAX_ONCHAIN_IMAGE_BYTES.toLocaleString()} byte on-chain limit.`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(input.contentHash)) throw new Error("The image hash is invalid.");
  if (![input.width, input.height].every((value) => Number.isSafeInteger(value) && value >= 64 && value <= 256)) {
    throw new Error("The on-chain image dimensions are invalid.");
  }
  const manifest = {
    p: PROTOCOL_ID,
    v: PROTOCOL_VERSION,
    op: "mint",
    netuid: input.netuid,
    subnet_generation: Number.parseInt(input.subnetGeneration, 10),
    name,
    purpose,
    ...(collection ? { collection } : {}),
    ...(input.contentPolicy ? { content_policy: input.contentPolicy } : {}),
    media_type: "image/webp",
    encoding: "binary",
    content_hash: input.contentHash,
    content_length: input.imageBytes.length,
    width: input.width,
    height: input.height,
    ...(body ? { body } : {}),
  };
  const json = JSON.stringify(manifest);
  const manifestBytes = new TextEncoder().encode(json);
  const bytes = new Uint8Array(8 + manifestBytes.length + input.imageBytes.length);
  bytes.set(IMAGE_MAGIC, 0);
  new DataView(bytes.buffer).setUint32(4, manifestBytes.length, false);
  bytes.set(manifestBytes, 8);
  bytes.set(input.imageBytes, 8 + manifestBytes.length);
  if (bytes.length > MAX_MINT_REMARK_BYTES) throw new Error("The complete on-chain relic exceeds the mint payload limit.");
  return { json, hex: bytesToHex(bytes), byteLength: bytes.length, imageByteLength: input.imageBytes.length };
}

export function calculateLimitPrice(
  currentSpotPriceRao: bigint,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
) {
  if (currentSpotPriceRao <= 0n) {
    throw new Error("A fresh nonzero spot price is required.");
  }
  if (slippageBps < 0n || slippageBps > 1_000n) {
    throw new Error("Slippage tolerance must be between 0% and 10%.");
  }

  return (currentSpotPriceRao * (BPS_DENOMINATOR + slippageBps) + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
}

export function createTransferPayload(input: {
  artifactId: string;
  destinationAccountHex: string;
  ownershipNonce: number;
}) {
  if (!/^br1:0x[0-9a-f]{64}:\d+:\d+$/.test(input.artifactId)) {
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
  if (bytes.length > MAX_JSON_REMARK_BYTES) throw new Error("The transfer payload exceeds the protocol limit.");
  return {
    json,
    hex: bytesToHex(bytes),
    byteLength: bytes.length,
  };
}

export function createPurchasePayload(input: {
  artifactId: string;
  listingId: string;
  sellerAccountHex: string;
  buyerAccountHex: string;
  listingBuyerAccountHex: string | null;
  listingOwnershipNonce: string;
  priceRao: string;
  expiryBlock: string;
  listingNonce: string;
  listingSignature: string;
}) {
  if (!/^br1:0x[0-9a-f]{64}:\d+:\d+$/.test(input.artifactId)) throw new Error("The Relic ID is not canonical.");
  if (!/^0x[0-9a-f]{64}$/.test(input.listingId)) throw new Error("The listing ID is invalid.");
  if (![input.sellerAccountHex, input.buyerAccountHex].every((value) => /^0x[0-9a-f]{64}$/.test(value))) {
    throw new Error("The buyer or seller AccountId32 is invalid.");
  }
  if (input.sellerAccountHex === input.buyerAccountHex) throw new Error("The owner cannot buy their own Relic.");
  if (input.listingBuyerAccountHex && input.listingBuyerAccountHex !== input.buyerAccountHex) {
    throw new Error("This listing is reserved for another buyer.");
  }
  if (![input.listingOwnershipNonce, input.priceRao, input.expiryBlock].every((value) => /^(0|[1-9]\d*)$/.test(value))) {
    throw new Error("The listing contains an invalid integer.");
  }
  if (BigInt(input.priceRao) <= 0n) throw new Error("The listing price must be positive.");
  if (!/^[0-9a-f]{64}$/.test(input.listingNonce)) throw new Error("The listing nonce is invalid.");
  if (!/^0x[0-9a-fA-F]{128,132}$/.test(input.listingSignature)) throw new Error("The listing signature is invalid.");
  const nextNonce = BigInt(input.listingOwnershipNonce) + 1n;
  if (nextNonce > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("The ownership nonce exceeds the supported range.");
  const json = JSON.stringify({
    p: PROTOCOL_ID,
    v: PROTOCOL_VERSION,
    op: "purchase",
    artifact: input.artifactId,
    listing_id: input.listingId,
    seller: input.sellerAccountHex,
    buyer: input.buyerAccountHex,
    listing_buyer: input.listingBuyerAccountHex ?? "*",
    listing_ownership_nonce: input.listingOwnershipNonce,
    price_rao: input.priceRao,
    expiry_block: input.expiryBlock,
    listing_nonce: input.listingNonce,
    listing_signature: input.listingSignature,
    nonce: Number(nextNonce),
  });
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_JSON_REMARK_BYTES) throw new Error("The purchase receipt exceeds the protocol limit.");
  return { json, hex: bytesToHex(bytes), byteLength: bytes.length, nextNonce: Number(nextNonce) };
}
