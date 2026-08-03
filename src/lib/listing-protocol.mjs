import { stringToU8a, u8aToHex } from "@polkadot/util";
import { blake2AsHex, cryptoWaitReady, decodeAddress, signatureVerify } from "@polkadot/util-crypto";
export { buildCancellationMessage, buildListingMessage, CANCELLATION_DOMAIN, LISTING_DOMAIN } from "./listing-message.mjs";

export function normalizeAccount(value) {
  if (typeof value !== "string") throw new Error("INVALID_ACCOUNT");
  const decoded = decodeAddress(value);
  if (decoded.length !== 32) throw new Error("INVALID_ACCOUNT");
  return u8aToHex(decoded);
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
