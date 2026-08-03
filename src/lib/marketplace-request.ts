import "server-only";
import {
  buildCancellationMessage,
  buildListingMessage,
  messageId,
  normalizeAccount,
  verifyRawSignature,
} from "./listing-protocol.mjs";

const GENESIS = () => process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const ARTIFACT = /^br1:(0x[0-9a-f]{64}):\d+:\d+$/;
const UINT = /^(0|[1-9]\d*)$/;
const NONCE = /^[0-9a-f]{64}$/;
const SIGNATURE = /^0x[0-9a-fA-F]{128,132}$/;

export class MarketplaceRequestError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = "MarketplaceRequestError";
  }
}

function exactObject(value: unknown, keys: string[]) {
  if (!value || Array.isArray(value) || typeof value !== "object") throw new MarketplaceRequestError("INVALID_BODY", "A JSON object is required.");
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== [...keys].sort()[index])) {
    throw new MarketplaceRequestError("INVALID_FIELDS", "The request fields do not match the signed listing format.");
  }
  return value as Record<string, unknown>;
}

function decimal(value: unknown, field: string, allowZero = true) {
  if (typeof value !== "string" || !UINT.test(value) || (!allowZero && value === "0")) {
    throw new MarketplaceRequestError("INVALID_INTEGER", `${field} must be a canonical unsigned decimal string.`);
  }
  if (BigInt(value) > 18_446_744_073_709_551_615n) {
    throw new MarketplaceRequestError("INTEGER_TOO_LARGE", `${field} is outside the supported range.`);
  }
  return value;
}

async function readJson(request: Request) {
  const text = await request.text();
  if (text.length > 8_192) throw new MarketplaceRequestError("BODY_TOO_LARGE", "The request body is too large.", 413);
  try { return JSON.parse(text) as unknown; } catch { throw new MarketplaceRequestError("INVALID_JSON", "The request body is not valid JSON."); }
}

export async function verifiedListingRequest(request: Request) {
  const body = exactObject(await readJson(request), [
    "artifact", "buyer", "chain", "expiryBlock", "nonce", "ownershipNonce", "priceRao", "seller", "signature",
  ]);
  if (body.chain !== GENESIS()) throw new MarketplaceRequestError("WRONG_CHAIN", "The listing is signed for a different chain.");
  if (typeof body.artifact !== "string" || !ARTIFACT.test(body.artifact) || ARTIFACT.exec(body.artifact)?.[1] !== body.chain) {
    throw new MarketplaceRequestError("INVALID_ARTIFACT", "The artifact ID is not canonical for this chain.");
  }
  let seller: string;
  try { seller = normalizeAccount(body.seller); } catch { throw new MarketplaceRequestError("INVALID_SELLER", "The seller is not a valid AccountId32 address."); }
  const ownershipNonce = decimal(body.ownershipNonce, "ownershipNonce");
  const priceRao = decimal(body.priceRao, "priceRao", false);
  const expiryBlock = decimal(body.expiryBlock, "expiryBlock", false);
  if (typeof body.nonce !== "string" || !NONCE.test(body.nonce)) throw new MarketplaceRequestError("INVALID_NONCE", "nonce must be 64 lowercase hexadecimal characters.");
  let buyer = "*";
  let buyerAccountHex: string | null = null;
  if (body.buyer !== "*") {
    try { buyer = buyerAccountHex = normalizeAccount(body.buyer); } catch { throw new MarketplaceRequestError("INVALID_BUYER", "The buyer restriction is not a valid AccountId32 address."); }
    if (buyer === seller) throw new MarketplaceRequestError("INVALID_BUYER", "The seller cannot also be the restricted buyer.");
  }
  if (typeof body.signature !== "string" || !SIGNATURE.test(body.signature)) throw new MarketplaceRequestError("INVALID_SIGNATURE", "The wallet signature has an invalid encoding.");
  const message = buildListingMessage({ chain: body.chain, artifact: body.artifact, seller, ownershipNonce, priceRao, expiryBlock, nonce: body.nonce, buyer });
  if (!await verifyRawSignature(message, body.signature, seller)) throw new MarketplaceRequestError("INVALID_SIGNATURE", "The wallet signature does not authorize this listing.", 401);
  return {
    listingId: messageId(message), artifactId: body.artifact, chainGenesis: body.chain,
    sellerAccountHex: seller, ownershipNonce, priceRao, expiryBlock, nonce: body.nonce,
    buyerAccountHex, message, signature: body.signature,
  };
}

export async function verifiedCancellationRequest(request: Request, listingId: string, expectedSeller: string, chain: string) {
  if (!/^0x[0-9a-f]{64}$/.test(listingId)) throw new MarketplaceRequestError("INVALID_LISTING_ID", "The listing ID is invalid.");
  const body = exactObject(await readJson(request), ["seller", "signature"]);
  let seller: string;
  try { seller = normalizeAccount(body.seller); } catch { throw new MarketplaceRequestError("INVALID_SELLER", "The seller is not a valid AccountId32 address."); }
  if (seller !== expectedSeller) throw new MarketplaceRequestError("WRONG_SELLER", "Only the listing signer can cancel it.", 403);
  if (typeof body.signature !== "string" || !SIGNATURE.test(body.signature)) throw new MarketplaceRequestError("INVALID_SIGNATURE", "The wallet signature has an invalid encoding.");
  if (chain !== GENESIS()) throw new MarketplaceRequestError("WRONG_CHAIN", "The listing belongs to a different chain.");
  const message = buildCancellationMessage({ chain, listingId, seller });
  if (!await verifyRawSignature(message, body.signature, seller)) throw new MarketplaceRequestError("INVALID_SIGNATURE", "The wallet signature does not authorize cancellation.", 401);
  return { seller, message, signature: body.signature };
}

export function marketplaceRequestError(error: unknown) {
  return error instanceof MarketplaceRequestError ? error : null;
}
