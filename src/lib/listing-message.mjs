export const LISTING_DOMAIN = "BITTENSOR_RELICS_SALE_V2";
export const CANCELLATION_DOMAIN = "BITTENSOR_RELICS_CANCEL_LISTING_V1";

export function buildListingMessage(listing) {
  return `${LISTING_DOMAIN}\nchain=${listing.chain}\nartifact=${listing.artifact}\nseller=${listing.seller}\nownership_nonce=${listing.ownershipNonce}\nprice_rao=${listing.priceRao}\nexpiry_block=${listing.expiryBlock}\nnonce=${listing.nonce}\nbuyer=${listing.buyer}\nsettlement=atomic_tao_transfer_and_relic_ownership\n`;
}

export function buildCancellationMessage(cancellation) {
  return `${CANCELLATION_DOMAIN}\nchain=${cancellation.chain}\nlisting=${cancellation.listingId}\nseller=${cancellation.seller}\n`;
}
