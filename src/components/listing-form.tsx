"use client";

import { useState } from "react";
import { buildListingMessage } from "@/lib/listing-message.mjs";

const APP_NAME = "Bittensor Relics";
const RAO_PER_TAO = 1_000_000_000n;

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
  const [price, setPrice] = useState("1");
  const [state, setState] = useState<"idle" | "signing" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

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
      const expiryBlock = (BigInt(status.checkpoint.blockNumber) + 50_400n).toString();
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
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "The signed listing was not accepted.");
      setState("saved");
      setMessage("Listing published. It is a discovery offer only; no buyer payment is enabled.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The listing could not be created.");
    }
  }

  return (
    <section className="listing-panel">
      <div><span>Owner listing authorization</span><h2>List this Relic</h2><p>Publish a seven-day, wallet-signed asking price for discovery. Buying stays disabled until TAO payment and protocol ownership can be enforced by the same native state transition.</p></div>
      <label><span>Price</span><div><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /><em>TAO</em></div></label>
      <button type="button" onClick={createListing} disabled={state === "signing" || state === "saved"}>{state === "signing" ? "Confirm in TAOStats Wallet" : state === "saved" ? "Listing published" : "Sign listing"}</button>
      <small>Testnet only. Signing does not move funds, transfer the Relic, or authorize the current purchase prototype.</small>
      {message && <p className={state === "error" ? "error-message" : "listing-success"} role="status">{message}</p>}
    </section>
  );
}
