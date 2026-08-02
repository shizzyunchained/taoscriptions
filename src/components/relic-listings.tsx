"use client";

import { useState } from "react";
import { buildCancellationMessage } from "@/lib/listing-message.mjs";
import { formatRao } from "@/lib/format";

type RelicListing = { listingId: string; priceRao: string; expiryBlock: string };

export function RelicListings({ initialListings, ownerAccountHex, chainGenesis }: {
  initialListings: RelicListing[];
  ownerAccountHex: string;
  chainGenesis: string;
}) {
  const [listings, setListings] = useState(initialListings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function cancel(listingId: string) {
    setBusyId(listingId); setMessage("");
    try {
      const [{ web3Accounts, web3Enable, web3FromSource }, { stringToHex }, { normalizeAccount }] = await Promise.all([
        import("@polkadot/extension-dapp"), import("@polkadot/util"), import("@/lib/listing-protocol.mjs"),
      ]);
      const extensions = await web3Enable("Neural Relics");
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
      setMessage(error instanceof Error ? error.message : "The listing could not be cancelled.");
    } finally { setBusyId(null); }
  }

  return <section className="active-offers"><div><h2>Signed offers</h2><span>{listings.length} active</span></div>{listings.length ? listings.map((listing) => <article key={listing.listingId}><strong>{formatRao(listing.priceRao)} TAO</strong><span>Expires block #{listing.expiryBlock}</span><div><button type="button" disabled>Purchase locked</button><button type="button" className="cancel-listing" disabled={busyId !== null} onClick={() => cancel(listing.listingId)}>{busyId === listing.listingId ? "Confirm in wallet" : "Cancel listing"}</button></div></article>) : <p>This relic has no active owner-signed listing.</p>}{message && <p className="listing-action-message" role="status">{message}</p>}</section>;
}
