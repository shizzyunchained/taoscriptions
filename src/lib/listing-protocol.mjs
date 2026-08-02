import { stringToU8a, u8aToHex } from "@polkadot/util";
import { blake2AsHex, cryptoWaitReady, decodeAddress, signatureVerify } from "@polkadot/util-crypto";

export const LISTING_DOMAIN = "NEURAL_RELICS_LISTING_V1";
export const CANCELLATION_DOMAIN = "NEURAL_RELICS_CANCEL_LISTING_V1";

export function normalizeAccount(value) {
  if (typeof value !== "string") throw new Error("INVALID_ACCOUNT");
  const decoded = decodeAddress(value);
  if (decoded.length !== 32) throw new Error("INVALID_ACCOUNT");
  return u8aToHex(decoded);
}

export function buildListingMessage(listing) {
  return `${LISTING_DOMAIN}\nchain=${listing.chain}\nartifact=${listing.artifact}\nseller=${listing.seller}\nownership_nonce=${listing.ownershipNonce}\nprice_rao=${listing.priceRao}\nexpiry_block=${listing.expiryBlock}\nnonce=${listing.nonce}\nbuyer=${listing.buyer}\n`;
}

export function buildCancellationMessage(cancellation) {
  return `${CANCELLATION_DOMAIN}\nchain=${cancellation.chain}\nlisting=${cancellation.listingId}\nseller=${cancellation.seller}\n`;
}

export function messageId(message) {
  return blake2AsHex(stringToU8a(message), 256);
}

export async function verifyRawSignature(message, signature, account) {
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) return false;
  await cryptoWaitReady();
  try {
    return signatureVerify(message, signature, account).isValid;
  } catch {
    return false;
  }
}
