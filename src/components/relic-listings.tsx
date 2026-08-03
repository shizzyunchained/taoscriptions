"use client";

import { useState } from "react";
import { buildCancellationMessage, LISTING_DOMAIN } from "@/lib/listing-message.mjs";
import { formatRao } from "@/lib/format";
import { assertExpectedGenesis } from "@/lib/chain-guard";
import { createPurchasePayload } from "@/lib/protocol";

const TESTNET_RPC = process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";

type RelicListing = {
  listingId: string;
  priceRao: string;
  expiryBlock: string;
  sellerAccountHex: string;
  ownershipNonce: string;
  nonce: string;
  buyerAccountHex: string | null;
  signature: string;
  message: string;
};

export function RelicListings({ initialListings, artifactId, ownerAccountHex, chainGenesis }: {
  initialListings: RelicListing[];
  artifactId: string;
  ownerAccountHex: string;
  chainGenesis: string;
}) {
  const [listings, setListings] = useState(initialListings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [buyState, setBuyState] = useState<"idle" | "signing" | "submitted" | "finalized" | "error">("idle");
  const [message, setMessage] = useState("");

  async function buy(listing: RelicListing) {
    setBusyId(listing.listingId);
    setBuyState("signing");
    setMessage("");
    let api: import("@polkadot/api").ApiPromise | null = null;
    try {
      const [extension, apiModule, listingProtocol] = await Promise.all([
        import("@polkadot/extension-dapp"),
        import("@polkadot/api"),
        import("@/lib/listing-protocol.mjs"),
      ]);
      const extensions = await extension.web3Enable("Bittensor Relics");
      if (!extensions.length) throw new Error("Unlock TAOStats Wallet, then try again.");
      const accounts = await extension.web3Accounts();
      const buyer = accounts.find((candidate) => {
        try {
          const accountHex = listingProtocol.normalizeAccount(candidate.address);
          return accountHex !== listing.sellerAccountHex
            && (!listing.buyerAccountHex || listing.buyerAccountHex === accountHex);
        } catch { return false; }
      });
      if (!buyer) throw new Error("Connect an eligible buyer wallet. The seller cannot buy their own Relic.");
      const buyerAccountHex = listingProtocol.normalizeAccount(buyer.address);
      const payload = createPurchasePayload({
        artifactId,
        listingId: listing.listingId,
        sellerAccountHex: listing.sellerAccountHex,
        buyerAccountHex,
        listingBuyerAccountHex: listing.buyerAccountHex,
        listingOwnershipNonce: listing.ownershipNonce,
        priceRao: listing.priceRao,
        expiryBlock: listing.expiryBlock,
        listingNonce: listing.nonce,
        listingSignature: listing.signature,
      });
      api = await apiModule.ApiPromise.create({ provider: new apiModule.WsProvider(TESTNET_RPC), noInitWarn: true });
      assertExpectedGenesis(api.genesisHash.toHex(), chainGenesis);
      const call = api.tx.utility.batchAll([
        api.tx.balances.transferKeepAlive(listing.sellerAccountHex, listing.priceRao),
        api.tx.system.remarkWithEvent(payload.hex),
      ]);
      const [payment, accountInfo] = await Promise.all([
        call.paymentInfo(buyer.address),
        api.query.system.account(buyer.address),
      ]);
      const free = BigInt((accountInfo as unknown as { data: { free: { toString(): string } } }).data.free.toString());
      const fee = BigInt(payment.partialFee.toString());
      const deposit = BigInt(api.consts.balances.existentialDeposit.toString());
      if (free < BigInt(listing.priceRao) + fee + deposit) {
        throw new Error(`The buyer wallet needs the ${formatRao(listing.priceRao)} test TAO price plus the network fee while staying alive.`);
      }
      const injector = await extension.web3FromSource(buyer.meta.source);
      await new Promise<void>((resolve, reject) => {
        let unsubscribe: (() => void) | undefined;
        void call.signAndSend(buyer.address, { signer: injector.signer }, (result) => {
          if (result.dispatchError) {
            unsubscribe?.();
            reject(new Error(result.dispatchError.toString()));
            return;
          }
          if (result.status.isInBlock) setBuyState("submitted");
          if (result.status.isFinalized) {
            const completed = result.events.some(({ event }) => event.section === "utility" && event.method === "BatchCompleted");
            const paid = result.events.find(({ event }) => event.section === "balances" && event.method === "Transfer");
            const paymentMatches = paid
              && listingProtocol.normalizeAccount(paid.event.data[0].toString()) === buyerAccountHex
              && listingProtocol.normalizeAccount(paid.event.data[1].toString()) === listing.sellerAccountHex
              && BigInt(paid.event.data[2].toString()) === BigInt(listing.priceRao);
            if (!completed || !paymentMatches) {
              unsubscribe?.();
              reject(new Error("The finalized transaction did not contain the exact atomic payment receipt."));
              return;
            }
            unsubscribe?.();
            setMessage(`Purchase finalized: ${result.txHash.toHex()}. Ownership will update when the indexer reaches this block.`);
            resolve();
          }
        }).then((stop) => { unsubscribe = stop; }).catch(reject);
      });
      setBuyState("finalized");
    } catch (error) {
      setBuyState("error");
      setMessage(error instanceof Error ? error.message : "The purchase could not be completed.");
    } finally {
      setBusyId(null);
      await api?.disconnect();
    }
  }

  async function cancel(listingId: string) {
    setBusyId(listingId); setMessage("");
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
      setMessage(error instanceof Error ? error.message : "The listing could not be cancelled.");
    } finally { setBusyId(null); }
  }

  return (
    <section className="active-offers purchase-panel">
      <div>
        <div>
          <span>Marketplace listing</span>
          <h2>{listings.length ? "Buy this Relic" : "Not currently for sale"}</h2>
        </div>
        <span>{listings.length} active</span>
      </div>
      {listings.length ? listings.map((listing) => (
        <article key={listing.listingId}>
          <div className="purchase-price">
            <span>Price</span>
            <strong>{formatRao(listing.priceRao)} TAO</strong>
          </div>
          <span>Listing expires at block #{listing.expiryBlock}</span>
          <div>
            {(() => {
              const settlementReady = listing.message.startsWith(`${LISTING_DOMAIN}\n`);
              return (
            <button
              type="button"
              className="buy-relic-button"
              disabled={!settlementReady || busyId !== null || buyState === "finalized"}
              onClick={() => buy(listing)}
            >
              {!settlementReady
                ? "Relist to enable buying"
                : busyId === listing.listingId && buyState === "signing"
                ? "Confirm in TAOStats Wallet"
                : busyId === listing.listingId && buyState === "submitted"
                  ? "Finalizing purchase"
                  : buyState === "finalized"
                    ? "Purchase finalized"
                    : "Buy Relic"}
            </button>
              );
            })()}
            <button type="button" className="cancel-listing" disabled={busyId !== null} onClick={() => cancel(listing.listingId)}>
              {busyId === listing.listingId ? "Confirm in wallet" : "Cancel listing"}
            </button>
          </div>
        </article>
      )) : <p>This Relic has no active marketplace listing.</p>}
      {listings.length > 0 && (
        <small>Testnet purchase: TAO payment and the signed ownership receipt are submitted together in one atomic batch.</small>
      )}
      {message && <p className={buyState === "error" ? "error-message" : "listing-action-message"} role="status">{message}</p>}
    </section>
  );
}
