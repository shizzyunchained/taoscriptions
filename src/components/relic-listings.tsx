"use client";

import { useState } from "react";
import { buildCancellationMessage } from "@/lib/listing-message.mjs";
import { compactHex, formatRao } from "@/lib/format";

type RelicListing = {
  listingId: string;
  sellerAccountHex: string;
  ownershipNonce: string;
  priceRao: string;
  expiryBlock: string;
  createdAt: string;
};

export function RelicListings({ initialListings, ownerAccountHex, chainGenesis }: {
  initialListings: RelicListing[];
  ownerAccountHex: string;
  chainGenesis: string;
}) {
  const [listings, setListings] = useState(initialListings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<"idle" | "error">("idle");
  const [message, setMessage] = useState("");

  async function cancel(listingId: string) {
    setBusyId(listingId); setActionState("idle"); setMessage("");
    try {
      const [{ web3Accounts, web3Enable, web3FromSource }, { stringToHex }, { normalizeAccount }] = await Promise.all([
        import("@polkadot/extension-dapp"), import("@polkadot/util"), import("@/lib/listing-protocol.mjs"),
      ]);
      const extensions = await web3Enable("Bittensor Relics");
      if (!extensions.length) throw new Error("Unlock TAOStats Wallet, then try again.");
      const accounts = await web3Accounts();
      const account = accounts.find((candidate) => {
        try { return normalizeAccount(candidate.address) === ownerAccountHex; } catch { return false; }
      });
      if (!account) throw new Error("Connect the wallet that signed and currently owns this relic.");
      const injector = await web3FromSource(account.meta.source);
      if (!injector.signer.signRaw) throw new Error("This wallet does not support signed cancellation messages.");
      const canonical = buildCancellationMessage({ chain: chainGenesis, listingId, seller: ownerAccountHex });
      const signed = await injector.signer.signRaw({ address: account.address, data: stringToHex(canonical), type: "bytes" });
      const response = await fetch(`/api/v1/listings/${listingId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seller: account.address, signature: signed.signature }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "The cancellation was not accepted.");
      setListings((current) => current.filter((listing) => listing.listingId !== listingId));
      setMessage("Listing cancelled. No chain transaction or payment was made.");
    } catch (error) {
      setActionState("error");
      setMessage(error instanceof Error ? error.message : "The listing could not be cancelled.");
    } finally { setBusyId(null); }
  }

  return (
    <section className="active-offers purchase-panel">
      <div>
        <div>
          <span>Marketplace listing</span>
          <h2>{listings.length ? "Listed for discovery" : "Not currently listed"}</h2>
        </div>
        <span>{listings.length} active</span>
      </div>
      {listings.length ? listings.map((listing) => (
        <article key={listing.listingId}>
          <div className="purchase-price">
            <span>Price</span>
            <strong>{formatRao(listing.priceRao)} TAO</strong>
          </div>
          <dl className="listing-proof-summary">
            <div><dt>Seller</dt><dd>{compactHex(listing.sellerAccountHex, 12, 10)}</dd></div>
            <div><dt>Ownership version</dt><dd>Nonce {listing.ownershipNonce}</dd></div>
            <div><dt>Published</dt><dd>{listing.createdAt.slice(0, 10)}</dd></div>
            <div><dt>Expires</dt><dd>Block #{listing.expiryBlock}</dd></div>
            <div><dt>Listing ID</dt><dd>{compactHex(listing.listingId, 12, 10)}</dd></div>
          </dl>
          <div className="listing-primary-actions">
            <button
              type="button"
              className="buy-relic-button"
              disabled
            >
              Buying not enabled
            </button>
            <button type="button" className="cancel-listing" disabled={busyId !== null} onClick={() => cancel(listing.listingId)}>
              {busyId === listing.listingId ? "Confirm in wallet" : "Owner: cancel listing"}
            </button>
          </div>
        </article>
      )) : <p>This Relic has no active marketplace listing.</p>}
      {listings.length > 0 && (
        <small>Discovery only. A native chain-enforced payment-and-ownership mechanism is required before buying can be enabled safely.</small>
      )}
      {message && <p className={actionState === "error" ? "error-message" : "listing-action-message"} role="status">{message}</p>}
    </section>
  );
}
