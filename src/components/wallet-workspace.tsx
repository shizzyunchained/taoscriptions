"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ApiPromise } from "@polkadot/api";
import { createTransferPayload } from "@/lib/protocol";
import { formatRao } from "@/lib/format";

const APP_NAME = "Neural Relics";
const TESTNET_RPC = process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";
const TESTNET_GENESIS = "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";

type WalletAccount = { address: string; name: string; source: string; accountHex: string };
type OwnedRelic = {
  artifactId: string; globalNumber: string; subnetNumber: string; netuid: number;
  name: string; body: string | null; mediaType: string; ownershipNonce: string;
  ownerAccountHex: string; alphaBurnedRao: string;
};
type TransferReview = {
  artifact: OwnedRelic; destination: string; payloadHex: string;
  payloadHash: string; payloadBytes: number; nextNonce: number; estimatedFeeRao: string;
};

function compact(value: string) { return value.length > 22 ? `${value.slice(0, 11)}...${value.slice(-9)}` : value; }
export function WalletWorkspace() {
  const collectionRequest = useRef(0);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [walletAccounts, setWalletAccounts] = useState<WalletAccount[]>([]);
  const [relics, setRelics] = useState<OwnedRelic[]>([]);
  const [state, setState] = useState<"idle" | "connecting" | "ready" | "offline" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<OwnedRelic | null>(null);
  const [destination, setDestination] = useState("");
  const [review, setReview] = useState<TransferReview | null>(null);
  const [transferState, setTransferState] = useState<"idle" | "review" | "signing" | "submitted" | "finalized" | "error">("idle");
  const [transactionHash, setTransactionHash] = useState("");

  async function loadCollection(address: string) {
    const requestId = ++collectionRequest.current;
    try {
      const response = await fetch(`/api/v1/accounts/${encodeURIComponent(address)}/artifacts?limit=100&fresh=1`, { cache: "no-store" });
      const body = await response.json() as { artifacts?: OwnedRelic[]; error?: { message?: string } };
      if (requestId !== collectionRequest.current) return;
      if (!response.ok) {
        if (response.status === 503) { setState("offline"); setMessage("The finalized indexer is not online yet. Wallet connection succeeded, but ownership claims stay hidden."); return; }
        throw new Error(body.error?.message || "The finalized collection could not be loaded.");
      }
      setRelics(body.artifacts ?? []);
      setState("ready");
    } catch (error) {
      if (requestId !== collectionRequest.current) return;
      throw error;
    }
  }

  async function connect() {
    setState("connecting"); setMessage("");
    try {
      const [{ web3Accounts, web3Enable }, { u8aToHex }, { decodeAddress }] = await Promise.all([
        import("@polkadot/extension-dapp"), import("@polkadot/util"), import("@polkadot/util-crypto"),
      ]);
      const extensions = await web3Enable(APP_NAME);
      if (!extensions.length) throw new Error("Unlock TAOStats Wallet, then try again.");
      const accounts = await web3Accounts();
      if (!accounts.length) throw new Error("Share one account from TAOStats Wallet to continue.");
      const available = accounts.map((item) => ({ address: item.address, name: item.meta.name || "TAOStats account", source: item.meta.source, accountHex: u8aToHex(decodeAddress(item.address)) }));
      const next = available.find((item) => /tao.?stats|bittensor/i.test(item.source ?? "")) ?? available[0];
      setWalletAccounts(available);
      setAccount(next);
      await loadCollection(next.address);
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "The wallet could not connect."); }
  }

  async function withApi<T>(action: (api: ApiPromise) => Promise<T>) {
    const { ApiPromise, WsProvider } = await import("@polkadot/api");
    const api = await ApiPromise.create({ provider: new WsProvider(TESTNET_RPC), noInitWarn: true });
    try {
      if (api.genesisHash.toHex() !== TESTNET_GENESIS) throw new Error("The configured RPC is not Neural Relics testnet.");
      return await action(api);
    } finally { await api.disconnect(); }
  }

  async function reviewTransfer() {
    if (!account || !selected) return;
    setTransferState("idle"); setMessage(""); setTransactionHash("");
    try {
      const [{ u8aToHex }, { blake2AsHex, decodeAddress }] = await Promise.all([import("@polkadot/util"), import("@polkadot/util-crypto")]);
      const destinationHex = u8aToHex(decodeAddress(destination.trim()));
      if (destinationHex === account.accountHex) throw new Error("The destination is already the current owner.");
      const nextNonceBig = BigInt(selected.ownershipNonce) + 1n;
      if (nextNonceBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("The ownership nonce exceeds the supported client range.");
      const payload = createTransferPayload({ artifactId: selected.artifactId, destinationAccountHex: destinationHex, ownershipNonce: Number(nextNonceBig) });
      const fee = await withApi(async (api) => {
        const call = api.tx.system.remarkWithEvent(payload.hex);
        const payment = await call.paymentInfo(account.address);
        const info = await api.query.system.account(account.address);
        const free = BigInt((info as unknown as { data: { free: { toString(): string } } }).data.free.toString());
        const estimated = BigInt(payment.partialFee.toString());
        const deposit = BigInt(api.consts.balances.existentialDeposit.toString());
        if (free < estimated + deposit) throw new Error("The testnet wallet cannot cover the network fee while staying alive.");
        return estimated.toString();
      });
      setReview({ artifact: selected, destination: destinationHex, payloadHex: payload.hex, payloadHash: blake2AsHex(new TextEncoder().encode(payload.json), 256), payloadBytes: payload.byteLength, nextNonce: Number(nextNonceBig), estimatedFeeRao: fee });
      setTransferState("review");
    } catch (error) { setReview(null); setTransferState("error"); setMessage(error instanceof Error ? error.message : "The transfer review could not be prepared."); }
  }

  async function signTransfer() {
    if (!account || !review) return;
    setTransferState("signing"); setMessage("");
    try {
      const [{ u8aToHex }, { decodeAddress }] = await Promise.all([import("@polkadot/util"), import("@polkadot/util-crypto")]);
      const stateResponse = await fetch(`/api/v1/artifacts/${encodeURIComponent(review.artifact.artifactId)}?fresh=1`, { cache: "no-store" });
      const stateBody = await stateResponse.json() as { artifact?: { ownerAccountHex: string; ownershipNonce: string }; error?: { message?: string } };
      if (!stateResponse.ok || !stateBody.artifact) throw new Error(stateBody.error?.message || "Finalized ownership could not be refreshed.");
      if (stateBody.artifact.ownerAccountHex !== account.accountHex || BigInt(stateBody.artifact.ownershipNonce) + 1n !== BigInt(review.nextNonce)) {
        throw new Error("Finalized ownership changed after review. Reload the wallet collection before signing.");
      }
      await withApi(async (api) => {
        const { web3FromSource } = await import("@polkadot/extension-dapp");
        const injector = await web3FromSource(account.source);
        const call = api.tx.system.remarkWithEvent(review.payloadHex);
        await new Promise<void>((resolve, reject) => {
          let unsubscribe: (() => void) | undefined;
          void call.signAndSend(account.address, { signer: injector.signer }, (result) => {
              setTransactionHash(result.txHash.toHex());
              if (result.dispatchError) { unsubscribe?.(); reject(new Error(result.dispatchError.toString())); return; }
              if (result.status.isInBlock) setTransferState("submitted");
              if (result.status.isFinalized) {
                try {
                  const success = result.events.some(({ event }) => api.events.system.ExtrinsicSuccess.is(event));
                  const remarked = result.events.find(({ event }) => api.events.system.Remarked.is(event));
                  const remarkMatches = remarked
                    && u8aToHex(decodeAddress(remarked.event.data[0].toString())) === account.accountHex
                    && remarked.event.data[1].toHex() === review.payloadHash;
                  unsubscribe?.();
                  if (!success || !remarkMatches) reject(new Error("The finalized transaction is missing the required matching remark evidence."));
                  else resolve();
                } catch (error) { unsubscribe?.(); reject(error); }
              }
            }).then((stop) => { unsubscribe = stop; }).catch((error) => { unsubscribe?.(); reject(error); });
        });
      });
      setTransferState("finalized");
      setMessage("Transfer finalized. The new owner appears after the indexer reaches this block.");
    } catch (error) { setTransferState("error"); setMessage(error instanceof Error ? error.message : "The transfer did not finalize."); }
  }

  return (
    <section className="wallet-workspace">
      {!account ? <div className="wallet-gate"><span>SS58 ownership</span><h2>Your wallet is your account.</h2><p>Connect TAOStats Wallet to read finalized relics owned by that AccountId32. Neural Relics never receives a seed phrase.</p><button type="button" onClick={connect} disabled={state === "connecting"}>{state === "connecting" ? "Opening wallet..." : "Connect TAOStats Wallet"}</button>{message && <p className="error-message" role="alert">{message}</p>}</div>
      : <><header><div><span>Connected owner</span><select aria-label="Connected wallet account" value={account.address} onChange={(event) => { const next = walletAccounts.find((item) => item.address === event.target.value); if (!next) return; setAccount(next); setRelics([]); setSelected(null); setReview(null); setDestination(""); setTransferState("idle"); setState("connecting"); void loadCollection(next.address).catch((error) => { setState("error"); setMessage(error instanceof Error ? error.message : "The collection could not be loaded."); }); }}>{walletAccounts.map((item) => <option key={item.address} value={item.address}>{item.name} · {compact(item.address)}</option>)}</select><p>{compact(account.address)}</p></div><button type="button" disabled={transferState === "signing" || transferState === "submitted"} onClick={() => { collectionRequest.current += 1; setAccount(null); setWalletAccounts([]); setRelics([]); setState("idle"); setSelected(null); }}>Disconnect</button></header>
        {state === "offline" || state === "error" ? <div className="wallet-notice" role="status"><strong>{state === "offline" ? "Indexer gate" : "Wallet error"}</strong><p>{message}</p></div>
        : state === "ready" && !relics.length ? <div className="wallet-notice"><strong>No finalized relics</strong><p>This address does not currently own a Neural Relic in indexed testnet state.</p><Link href="/#forge">Open the testnet forge</Link></div>
        : <div className="owned-layout"><div className="owned-list"><div><span>Finalized collection</span><strong>{relics.length} owned</strong></div>{relics.map((relic) => <button type="button" key={relic.artifactId} className={selected?.artifactId === relic.artifactId ? "active" : ""} onClick={() => { setSelected(relic); setReview(null); setTransferState("idle"); setMessage(""); }}><span>Relic #{relic.globalNumber} · SN{relic.netuid}</span><strong>{relic.name}</strong><small>Ownership nonce {relic.ownershipNonce}</small></button>)}</div>
          <div className="transfer-console">{selected ? <><span>Canonical transfer</span><h2>{selected.name}</h2><p>This changes Neural Relics protocol ownership after finalization. It does not move TAO or alpha.</p><label><span>Destination SS58 address</span><input value={destination} onChange={(event) => { setDestination(event.target.value); setReview(null); setTransferState("idle"); }} placeholder="5..." /></label>{review && <div className="transfer-review"><div><span>Next nonce</span><strong>{review.nextNonce}</strong></div><div><span>Destination</span><strong>{compact(review.destination)}</strong></div><div><span>Estimated fee</span><strong>{formatRao(review.estimatedFeeRao)} TAO</strong></div><div><span>Payload</span><strong>{review.payloadBytes} bytes</strong></div></div>}{message && <p className={transferState === "finalized" ? "listing-success" : "error-message"} role="status">{message}</p>}{transferState === "review" ? <button type="button" className="transfer-button danger" onClick={signTransfer}>Sign irreversible transfer</button> : <button type="button" className="transfer-button" onClick={reviewTransfer} disabled={!destination || transferState === "signing" || transferState === "submitted" || transferState === "finalized"}>{transferState === "signing" ? "Confirm in TAOStats Wallet" : transferState === "submitted" ? `Finalizing ${compact(transactionHash)}` : transferState === "finalized" ? "Transfer finalized" : "Review transfer"}</button>}<Link href={`/relic/${encodeURIComponent(selected.artifactId)}`}>Inspect full provenance</Link></> : <div className="transfer-empty"><span>Select a relic</span><h2>Ownership actions appear here.</h2><p>Nothing can be signed until you choose one finalized relic.</p></div>}</div></div>}</>}
    </section>
  );
}
