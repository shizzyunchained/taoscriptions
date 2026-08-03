"use client";

import { useState } from "react";
import { assertExpectedGenesis } from "@/lib/chain-guard";
import { compactHex, formatRao } from "@/lib/format";

const APP_NAME = "Bittensor Relics";
const TESTNET_RPC = process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";

type CheckoutListing = {
  listingId: string;
  sellerAccountHex: string;
  ownershipNonce: string;
  priceRao: string;
  expiryBlock: string;
};

type BuyerAccount = {
  address: string;
  accountHex: string;
  name: string;
  balanceRao: string;
};

export function BuyerCheckout({ artifactId, artifactName, artifactNumber, chainGenesis, listing }: {
  artifactId: string;
  artifactName: string;
  artifactNumber: string;
  chainGenesis: string;
  listing: CheckoutListing;
}) {
  const [buyer, setBuyer] = useState<BuyerAccount | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");

  async function connectAndReview() {
    setState("checking");
    setMessage("");
    try {
      const [{ web3Accounts, web3Enable }, { ApiPromise, WsProvider }, { decodeAddress }, { u8aToHex }] = await Promise.all([
        import("@polkadot/extension-dapp"),
        import("@polkadot/api"),
        import("@polkadot/util-crypto"),
        import("@polkadot/util"),
      ]);
      const extensions = await web3Enable(APP_NAME);
      if (!extensions.length) throw new Error("Unlock TAOStats Wallet, then try again.");
      const accounts = await web3Accounts();
      if (!accounts.length) throw new Error("Share one testnet account from TAOStats Wallet to continue.");
      const selected = accounts.find((account) => /tao.?stats|bittensor/i.test(account.meta.source ?? "")) ?? accounts[0];
      const accountHex = u8aToHex(decodeAddress(selected.address));

      const [artifactResponse, listingResponse, api] = await Promise.all([
        fetch(`/api/v1/artifacts/${encodeURIComponent(artifactId)}?fresh=1`, { cache: "no-store" }),
        fetch(`/api/v1/listings?artifact=${encodeURIComponent(artifactId)}&limit=1`, { cache: "no-store" }),
        ApiPromise.create({ provider: new WsProvider(TESTNET_RPC), noInitWarn: true }),
      ]);
      try {
        assertExpectedGenesis(api.genesisHash.toHex(), chainGenesis);
        const [artifactBody, listingBody, accountInfo] = await Promise.all([
          artifactResponse.json() as Promise<{ artifact?: { ownerAccountHex: string; ownershipNonce: string }; error?: { message?: string } }>,
          listingResponse.json() as Promise<{ listings?: CheckoutListing[]; error?: { message?: string } }>,
          api.query.system.account(selected.address),
        ]);
        if (!artifactResponse.ok || !artifactBody.artifact) throw new Error(artifactBody.error?.message || "Finalized ownership could not be verified.");
        if (!listingResponse.ok) throw new Error(listingBody.error?.message || "The listing could not be verified.");
        const currentListing = listingBody.listings?.[0];
        if (!currentListing || currentListing.listingId !== listing.listingId) throw new Error("This listing is no longer active. Refresh before continuing.");
        if (artifactBody.artifact.ownerAccountHex !== listing.sellerAccountHex || artifactBody.artifact.ownershipNonce !== listing.ownershipNonce) {
          throw new Error("Ownership changed after this listing was published. The checkout was stopped.");
        }
        const free = (accountInfo as unknown as { data: { free: { toString(): string } } }).data.free.toString();
        setBuyer({ address: selected.address, accountHex, name: selected.meta.name || "TAOStats account", balanceRao: free });
        setState("ready");
      } finally {
        await api.disconnect();
      }
    } catch (error) {
      setBuyer(null);
      setState("error");
      setMessage(error instanceof Error ? error.message : "The purchase review could not be prepared.");
    }
  }

  const isSeller = buyer?.accountHex === listing.sellerAccountHex;
  const hasAskingPrice = buyer ? BigInt(buyer.balanceRao) >= BigInt(listing.priceRao) : false;

  return (
    <section className="buyer-checkout" aria-labelledby="buyer-checkout-title">
      <header>
        <div><span>Buyer checkout</span><h2 id="buyer-checkout-title">Review without spending.</h2><p>Connect a testnet wallet to verify the listing and buyer details. This screen cannot sign or submit a purchase.</p></div>
        <div className="checkout-price"><span>Asking price</span><strong>{formatRao(listing.priceRao)} TAO</strong><small>Relic #{artifactNumber}</small></div>
      </header>
      <div className="checkout-body">
        <div className="checkout-summary">
          <span>Purchase summary</span>
          <h3>{artifactName}</h3>
          <dl>
            <div><dt>Seller</dt><dd>{compactHex(listing.sellerAccountHex, 12, 10)}</dd></div>
            <div><dt>Listing</dt><dd>{compactHex(listing.listingId, 12, 10)}</dd></div>
            <div><dt>Ownership version</dt><dd>Nonce {listing.ownershipNonce}</dd></div>
            <div><dt>Expiry</dt><dd>Block #{listing.expiryBlock}</dd></div>
          </dl>
        </div>
        <div className="checkout-wallet">
          {buyer ? (
            <>
              <span>Connected buyer</span>
              <strong>{buyer.name}</strong>
              <code>{compactHex(buyer.address, 14, 12)}</code>
              <dl>
                <div><dt>Testnet balance</dt><dd>{formatRao(buyer.balanceRao)} TAO</dd></div>
                <div><dt>Network fee</dt><dd>Testnet contract dry-run required</dd></div>
                <div><dt>Destination owner</dt><dd>{compactHex(buyer.accountHex, 12, 10)}</dd></div>
              </dl>
              {!hasAskingPrice && <p className="checkout-warning">This wallet does not currently hold the full asking price. No payment attempt will be made.</p>}
              {isSeller && <p className="checkout-warning">This wallet is the seller. Connect a different account to review as a buyer.</p>}
            </>
          ) : (
            <><span>Buyer wallet</span><h3>Verify before anything moves.</h3><p>The checkout will read your address and testnet balance, then recheck the listing against finalized indexed ownership.</p></>
          )}
        </div>
      </div>
      <ol className="checkout-gates">
        <li data-state={state === "ready" && hasAskingPrice && !isSeller ? "pass" : state === "ready" ? "blocked" : "waiting"}><span>1</span><div><strong>Wallet and balance</strong><small>{state === "ready" ? hasAskingPrice && !isSeller ? "Testnet buyer and asking-price balance verified" : "Buyer account is not purchase-ready" : "Waiting for buyer"}</small></div></li>
        <li data-state={state === "ready" ? "pass" : "waiting"}><span>2</span><div><strong>Listing and ownership</strong><small>{state === "ready" ? "Current owner and nonce match" : "Checked after connection"}</small></div></li>
        <li data-state="blocked"><span>3</span><div><strong>Atomic settlement</strong><small>Native ink!/WASM prototype compiled; deployment and audit are still required</small></div></li>
      </ol>
      <div className="checkout-action">
        <div><strong>{state === "ready" ? "Review complete. Settlement remains locked." : "No signature. No transaction. No TAO movement."}</strong><p>Buying unlocks only after the published contract is deployed and proves payment and Relic ownership succeed or fail together on testnet.</p></div>
        {state === "ready" ? <button type="button" disabled>Settlement locked</button> : <button type="button" onClick={connectAndReview} disabled={state === "checking"}>{state === "checking" ? "Verifying wallet and listing…" : "Connect wallet and review"}</button>}
      </div>
      {message && <p className="error-message checkout-error" role="alert">{message}</p>}
    </section>
  );
}
