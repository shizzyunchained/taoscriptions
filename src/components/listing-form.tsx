"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildCancellationMessage, buildListingMessage } from "@/lib/listing-message.mjs";
import { formatRao } from "@/lib/format";

const APP_NAME = "Bittensor Relics";
const RAO_PER_TAO = 1_000_000_000n;
const BLOCKS_PER_DAY = 7_200n;

type CurrentListing = {
  listingId: string;
  priceRao: string;
  expiryBlock: string;
};

function taoToRao(value: string) {
  if (!/^\d+(\.\d{0,9})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  return (BigInt(whole) * RAO_PER_TAO + BigInt(fraction.padEnd(9, "0"))).toString();
}

export function ListingForm({ artifactId, ownerAccountHex, ownershipNonce, chainGenesis }: {
  artifactId: string;
  ownerAccountHex: string;
  ownershipNonce: string;
  chainGenesis: string;
}) {
  const router = useRouter();
  const [price, setPrice] = useState("1");
  const [duration, setDuration] = useState("7");
  const [currentListing, setCurrentListing] = useState<CurrentListing | null>(null);
  const [state, setState] = useState<"idle" | "signing" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/listings?artifact=${encodeURIComponent(artifactId)}&limit=1`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json() as { listings?: CurrentListing[] };
        if (active) setCurrentListing(body.listings?.[0] ?? null);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [artifactId]);

  async function createListing() {
    setState("signing");
    setMessage("");
    try {
      const priceRao = taoToRao(price);
      if (!priceRao || priceRao === "0") throw new Error("Enter a price greater than zero.");
      const [{ web3Accounts, web3Enable, web3FromSource }, { stringToHex }, { normalizeAccount }, statusResponse] = await Promise.all([
        import("@polkadot/extension-dapp"),
        import("@polkadot/util"),
        import("@/lib/listing-protocol.mjs"),
        fetch("/api/v1/status", { cache: "no-store" }),
      ]);
      if (!statusResponse.ok) throw new Error("The finalized indexer must be online before a listing can be signed.");
      const status = await statusResponse.json() as { checkpoint?: { blockNumber?: string } };
      if (!status.checkpoint?.blockNumber) throw new Error("The indexer has not established a finalized checkpoint yet.");
      const extensions = await web3Enable(APP_NAME);
      if (!extensions.length) throw new Error("Unlock TAOStats Wallet, then try again.");
      const accounts = await web3Accounts();
      const account = accounts.find((candidate) => {
        try { return normalizeAccount(candidate.address) === ownerAccountHex; } catch { return false; }
      });
      if (!account) throw new Error("Connect the wallet that currently owns this relic.");
      const injector = await web3FromSource(account.meta.source);
      if (!injector.signer.signRaw) throw new Error("This wallet does not support signed marketplace messages.");
      const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
      const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const expiryBlock = (BigInt(status.checkpoint.blockNumber) + BigInt(duration) * BLOCKS_PER_DAY).toString();
      const canonical = buildListingMessage({
        chain: chainGenesis, artifact: artifactId, seller: ownerAccountHex,
        ownershipNonce, priceRao, expiryBlock, nonce, buyer: "*",
      });
      const signed = await injector.signer.signRaw({ address: account.address, data: stringToHex(canonical), type: "bytes" });
      const response = await fetch("/api/v1/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chain: chainGenesis, artifact: artifactId, seller: account.address,
          ownershipNonce, priceRao, expiryBlock, nonce, buyer: "*", signature: signed.signature,
        }),
      });
      const result = await response.json() as { listing?: CurrentListing; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "The signed listing was not accepted.");
      if (result.listing) setCurrentListing(result.listing);
      setState("saved");
      setMessage("Listing published. Any older active asking price for this Relic was replaced.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The listing could not be created.");
    }
  }

  async function cancelListing() {
    if (!currentListing) return;
    setState("signing");
    setMessage("");
    try {
      const [{ web3Accounts, web3Enable, web3FromSource }, { stringToHex }, { normalizeAccount }] = await Promise.all([
        import("@polkadot/extension-dapp"),
        import("@polkadot/util"),
        import("@/lib/listing-protocol.mjs"),
      ]);
      const extensions = await web3Enable(APP_NAME);
      if (!extensions.length) throw new Error("Unlock TAOStats Wallet, then try again.");
      const accounts = await web3Accounts();
      const account = accounts.find((candidate) => {
        try { return normalizeAccount(candidate.address) === ownerAccountHex; } catch { return false; }
      });
      if (!account) throw new Error("Connect the wallet that currently owns this relic.");
      const injector = await web3FromSource(account.meta.source);
      if (!injector.signer.signRaw) throw new Error("This wallet does not support signed cancellation messages.");
      const canonical = buildCancellationMessage({ chain: chainGenesis, listingId: currentListing.listingId, seller: ownerAccountHex });
      const signed = await injector.signer.signRaw({ address: account.address, data: stringToHex(canonical), type: "bytes" });
      const response = await fetch(`/api/v1/listings/${currentListing.listingId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seller: account.address, signature: signed.signature }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "The cancellation was not accepted.");
      setCurrentListing(null);
      setState("saved");
      setMessage("Listing cancelled. No funds or ownership moved.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The listing could not be cancelled.");
    }
  }

  return (
    <section className="listing-panel">
      <div><span>Owner listing authorization</span><h2>{currentListing ? "Manage listing" : "List this Relic"}</h2><p>Publish a wallet-signed asking price for discovery. A new signature replaces the current active listing without moving funds or ownership.</p>{currentListing && <div className="current-listing"><span>Current asking price</span><strong>{formatRao(currentListing.priceRao)} TAO</strong><small>Expires at block #{currentListing.expiryBlock}</small></div>}</div>
      <label><span>Price</span><div><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /><em>TAO</em></div></label>
      <label><span>Duration</span><div><select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></div></label>
      <div className="listing-form-actions">
        <button type="button" onClick={createListing} disabled={state === "signing"}>{state === "signing" ? "Confirm in TAOStats Wallet" : currentListing ? "Update asking price" : "Publish listing"}</button>
        {currentListing && <button type="button" className="listing-cancel-button" onClick={cancelListing} disabled={state === "signing"}>Cancel listing</button>}
      </div>
      <small>Testnet only. Signing does not move funds, transfer the Relic, or authorize the current purchase prototype.</small>
      {message && <p className={state === "error" ? "error-message" : "listing-success"} role="status">{message}</p>}
    </section>
  );
}
