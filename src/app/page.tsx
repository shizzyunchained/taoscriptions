"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { calculateLimitPrice, createInlineMintPayload, DEFAULT_SLIPPAGE_BPS } from "@/lib/protocol";
import { verifyFinalizedMintReceipt, type MintReceiptExpectation } from "@/lib/mint-receipt";
import { createMintEvidence, type MintEvidence } from "@/lib/mint-evidence";
import { assertExpectedGenesis } from "@/lib/chain-guard";

const APP_NAME = "Neural Relics";
const TESTNET_RPC = process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";
const TESTNET_GENESIS = process.env.NEXT_PUBLIC_CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const RAO_PER_TAO = 1_000_000_000n;

type WalletAccount = { address: string; name: string; source: string };
type Subnet = { netuid: number; generation: string; name: string; symbol: string; ownerHotkey: string };
type BurnQuote = { alphaAmount: bigint; alphaSlippage: bigint; priceRao: bigint; taoAmount: bigint; taoFee: bigint };
type MintReview = {
  payload: string;
  payloadBytes: number;
  limitPrice: bigint;
  estimatedFee: bigint;
  quoteBlock: string;
  routeHotkey: string;
};
type ConnectionState = "idle" | "connecting" | "connected" | "error";
type DataState = "connecting" | "ready" | "error";
type MintState = "idle" | "review" | "signing" | "submitted" | "finalized" | "error";

function shortAddress(address: string) {
  if (address.length < 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-7)}`;
}

function decodeHexText(hex: string) {
  if (!hex.startsWith("0x") || hex.length <= 2) return "";
  try {
    const pairs = hex.slice(2).match(/.{1,2}/g) ?? [];
    const bytes = new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
    return new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

function taoToRao(value: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,9})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * RAO_PER_TAO + BigInt(fraction.padEnd(9, "0"));
}

function formatToken(raw: bigint, maximumFractionDigits = 5) {
  const whole = raw / RAO_PER_TAO;
  const fraction = (raw % RAO_PER_TAO).toString().padStart(9, "0").slice(0, maximumFractionDigits).replace(/0+$/, "");
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""}`;
}

function formatPrice(raw: bigint) {
  return raw === 0n ? "--" : `${formatToken(raw, 7)} TAO / alpha`;
}

function quoteImpactBps(quote: BurnQuote) {
  const noSlippageAmount = quote.alphaAmount + quote.alphaSlippage;
  return noSlippageAmount === 0n ? 0n : (quote.alphaSlippage * 10_000n) / noSlippageAmount;
}

function formatBps(bps: bigint) {
  return `${bps / 100n}.${(bps % 100n).toString().padStart(2, "0")}%`;
}

export default function Home() {
  const apiRef = useRef<ApiPromise | null>(null);
  const [dataState, setDataState] = useState<DataState>("connecting");
  const [runtimeVersion, setRuntimeVersion] = useState("--");
  const [genesisHash, setGenesisHash] = useState("--");
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedNetuid, setSelectedNetuid] = useState<number | null>(null);
  const [taoAmount, setTaoAmount] = useState("0.005");
  const [quote, setQuote] = useState<BurnQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [walletState, setWalletState] = useState<ConnectionState>("idle");
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [walletError, setWalletError] = useState("");
  const [relicName, setRelicName] = useState("");
  const [relicBody, setRelicBody] = useState("");
  const [mintState, setMintState] = useState<MintState>("idle");
  const [mintReview, setMintReview] = useState<MintReview | null>(null);
  const [mintError, setMintError] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [mintEvidence, setMintEvidence] = useState<MintEvidence | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeApi: ApiPromise | null = null;

    async function loadSubnets() {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const api = await ApiPromise.create({ provider: new WsProvider(TESTNET_RPC), noInitWarn: true });
        activeApi = api;
        assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
        if (cancelled) {
          await api.disconnect();
          return;
        }
        apiRef.current = api;
        setRuntimeVersion(api.runtimeVersion.specVersion.toString());
        setGenesisHash(api.genesisHash.toHex());

        const entries = await api.query.subtensorModule.networksAdded.entries();
        const netuids = entries
          .filter(([, enabled]) => enabled.toString() === "true")
          .map(([key]) => Number.parseInt(key.args[0].toString(), 10))
          .filter((netuid) => netuid > 0)
          .sort((left, right) => left - right);
        const [identities, symbols, generations, ownerHotkeys] = await Promise.all([
          api.query.subtensorModule.subnetIdentitiesV3.multi(netuids),
          api.query.subtensorModule.tokenSymbol.multi(netuids),
          api.query.subtensorModule.networkRegisteredAt.multi(netuids),
          api.query.subtensorModule.subnetOwnerHotkey.multi(netuids),
        ]);

        const nextSubnets = netuids.map((netuid, index) => {
          const identity = identities[index].toHuman() as { subnetName?: string } | null;
          const symbol = decodeHexText(symbols[index].toHex());
          return {
            netuid,
            generation: generations[index].toString(),
            name: identity?.subnetName || `Subnet ${netuid}`,
            symbol: symbol || `alpha-${netuid}`,
            ownerHotkey: ownerHotkeys[index].toString(),
          };
        });

        if (!cancelled) {
          setSubnets(nextSubnets);
          setSelectedNetuid(nextSubnets[0]?.netuid ?? null);
          setDataState("ready");
        }
      } catch {
        if (!cancelled) setDataState("error");
      }
    }

    void loadSubnets();
    return () => {
      cancelled = true;
      apiRef.current = null;
      if (activeApi) void activeApi.disconnect();
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    const amountRao = taoToRao(taoAmount);
    if (!api || selectedNetuid === null || !amountRao || amountRao === 0n) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const [priceResult, quoteResult] = await Promise.all([
          api.call.swapRuntimeApi.currentAlphaPrice(selectedNetuid),
          api.call.swapRuntimeApi.simSwapTaoForAlpha(selectedNetuid, amountRao.toString()),
        ]);
        const decoded = quoteResult as unknown as {
          alphaAmount: { toString(): string };
          alphaSlippage: { toString(): string };
          taoAmount: { toString(): string };
          taoFee: { toString(): string };
        };
        const nextQuote = {
          alphaAmount: BigInt(decoded.alphaAmount.toString()),
          alphaSlippage: BigInt(decoded.alphaSlippage.toString()),
          priceRao: BigInt(priceResult.toString()),
          taoAmount: BigInt(decoded.taoAmount.toString()),
          taoFee: BigInt(decoded.taoFee.toString()),
        };
        if (nextQuote.alphaAmount === 0n) throw new Error("This amount cannot be quoted on the selected subnet.");
        if (!cancelled) {
          setQuote(nextQuote);
          setMintReview(null);
          setMintState("idle");
        }
      } catch (cause) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(cause instanceof Error ? cause.message : "The burn quote is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [selectedNetuid, taoAmount, dataState]);

  const selectedSubnet = useMemo(() => subnets.find((subnet) => subnet.netuid === selectedNetuid) ?? null, [selectedNetuid, subnets]);

  async function connectWallet() {
    setWalletState("connecting");
    setWalletError("");
    try {
      const { web3Accounts, web3Enable } = await import("@polkadot/extension-dapp");
      const extensions = await web3Enable(APP_NAME);
      if (extensions.length === 0) throw new Error("Unlock TAOStats Wallet, then try connecting again.");
      const accounts = await web3Accounts();
      if (accounts.length === 0) throw new Error("Share one account from TAOStats Wallet to continue.");
      const preferred = accounts.find((item) => /tao.?stats|bittensor/i.test(item.meta.source ?? "")) ?? accounts[0];
      const nextAccount = {
        address: preferred.address,
        name: preferred.meta.name || "TAOStats account",
        source: preferred.meta.source || extensions[0]?.name || "TAOStats",
      };

      let api = apiRef.current;
      let disconnectAfterRead = false;
      if (!api) {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        api = await ApiPromise.create({ provider: new WsProvider(TESTNET_RPC), noInitWarn: true });
        disconnectAfterRead = true;
      }
      try {
        assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
        const accountInfo = await api.query.system.account(nextAccount.address);
        const raw = BigInt((accountInfo as unknown as { data: { free: { toString(): string } } }).data.free.toString());
        setBalance(raw);
      } finally {
        if (disconnectAfterRead) await api.disconnect();
      }

      setAccount(nextAccount);
      setWalletState("connected");
    } catch (cause) {
      setWalletError(cause instanceof Error ? cause.message : "The wallet connection could not be completed.");
      setWalletState("error");
    }
  }

  function disconnectWallet() {
    setAccount(null);
    setBalance(null);
    setWalletError("");
    setWalletState("idle");
  }

  async function assembleMint() {
    const api = apiRef.current;
    const amountRao = taoToRao(taoAmount);
    if (!api || dataState !== "ready") throw new Error("The testnet connection is not ready.");
    assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
    if (!account) throw new Error("Connect the signing wallet first.");
    if (!selectedSubnet || selectedNetuid === null) throw new Error("Choose a subnet first.");
    if (!amountRao || amountRao === 0n) throw new Error("Enter a valid TAO amount.");

    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    const [apiAt, header] = await Promise.all([
      api.at(finalizedHash),
      api.rpc.chain.getHeader(finalizedHash),
    ]);
    const [generationResult, routeHotkeyResult, subtokenEnabledResult, priceResult, quoteResult] = await Promise.all([
      apiAt.query.subtensorModule.networkRegisteredAt(selectedNetuid),
      apiAt.query.subtensorModule.subnetOwnerHotkey(selectedNetuid),
      apiAt.query.subtensorModule.subtokenEnabled(selectedNetuid),
      apiAt.call.swapRuntimeApi.currentAlphaPrice(selectedNetuid),
      apiAt.call.swapRuntimeApi.simSwapTaoForAlpha(selectedNetuid, amountRao.toString()),
    ]);
    const currentGeneration = generationResult.toString();
    const routeHotkey = routeHotkeyResult.toString();
    if (currentGeneration !== selectedSubnet.generation) {
      throw new Error("This subnet was re-registered. Refresh its identity before minting.");
    }
    if (subtokenEnabledResult.toString() !== "true") {
      throw new Error("Alpha operations are currently disabled on this subnet.");
    }

    const decoded = quoteResult as unknown as {
      alphaAmount: { toString(): string };
      alphaSlippage: { toString(): string };
      taoAmount: { toString(): string };
      taoFee: { toString(): string };
    };
    const freshQuote: BurnQuote = {
      alphaAmount: BigInt(decoded.alphaAmount.toString()),
      alphaSlippage: BigInt(decoded.alphaSlippage.toString()),
      priceRao: BigInt(priceResult.toString()),
      taoAmount: BigInt(decoded.taoAmount.toString()),
      taoFee: BigInt(decoded.taoFee.toString()),
    };
    if (freshQuote.alphaAmount === 0n) throw new Error("The selected burn no longer returns alpha.");
    const minimumStakeRao = BigInt(apiAt.consts.subtensorModule.initialMinStake.toString());
    if (freshQuote.taoAmount < minimumStakeRao) {
      throw new Error(`The pool must receive at least ${formatToken(minimumStakeRao, 9)} TAO after its swap fee.`);
    }

    const payload = createInlineMintPayload({
      netuid: selectedNetuid,
      subnetGeneration: currentGeneration,
      name: relicName,
      body: relicBody,
    });
    const signerAccountHex = api.registry.createType("AccountId32", account.address).toHex().toLowerCase();
    const routeHotkeyHex = api.registry.createType("AccountId32", routeHotkey).toHex().toLowerCase();
    if (routeHotkeyHex === `0x${"0".repeat(64)}`) throw new Error("The subnet does not expose a registered owner hotkey.");
    const routeOwner = await apiAt.query.subtensorModule.owner(routeHotkey);
    const routeOwnerHex = api.registry.createType("AccountId32", routeOwner.toString()).toHex().toLowerCase();
    if (routeOwnerHex === `0x${"0".repeat(64)}`) throw new Error("The subnet owner hotkey is not registered for staking.");
    const { blake2AsHex } = await import("@polkadot/util-crypto");
    const receiptExpectation: MintReceiptExpectation = {
      signerAccountHex,
      routeHotkeyHex,
      netuid: selectedNetuid,
      taoAmountRao: amountRao,
      remarkHash: blake2AsHex(payload.hex, 256).toLowerCase(),
    };
    const limitPrice = calculateLimitPrice(freshQuote.priceRao, DEFAULT_SLIPPAGE_BPS);
    const batch = api.tx.utility.batchAll([
      api.tx.subtensorModule.addStakeBurn(
        routeHotkey,
        selectedNetuid,
        amountRao.toString(),
        limitPrice.toString(),
      ),
      api.tx.system.remarkWithEvent(payload.hex),
    ]);
    const payment = await batch.paymentInfo(account.address);
    const estimatedFee = BigInt(payment.partialFee.toString());
    const accountInfo = await api.query.system.account(account.address);
    const available = BigInt(
      (accountInfo as unknown as { data: { free: { toString(): string } } }).data.free.toString(),
    );
    const existentialDeposit = BigInt(api.consts.balances.existentialDeposit.toString());
    if (available < amountRao + estimatedFee + existentialDeposit) {
      throw new Error("The test wallet does not have enough free TAO for the burn and network fee.");
    }

    return {
      api,
      batch,
      freshQuote,
      receiptExpectation,
      currentGeneration,
      review: {
        payload: payload.json,
        payloadBytes: payload.byteLength,
        limitPrice,
        estimatedFee,
        quoteBlock: header.number.toString(),
        routeHotkey,
      } satisfies MintReview,
    };
  }

  async function reviewMint() {
    setMintError("");
    setTransactionHash("");
    setMintEvidence(null);
    try {
      const assembled = await assembleMint();
      setQuote(assembled.freshQuote);
      setMintReview(assembled.review);
      setMintState("review");
    } catch (cause) {
      setMintReview(null);
      setMintState("error");
      setMintError(cause instanceof Error ? cause.message : "The transaction review could not be prepared.");
    }
  }

  async function signMint() {
    if (!account) return;
    setMintError("");
    setMintEvidence(null);
    setMintState("signing");
    try {
      const assembled = await assembleMint();
      setMintReview(assembled.review);
      setQuote(assembled.freshQuote);
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injector = await web3FromSource(account.source);
      const subscription = { unsubscribe: undefined as (() => void) | undefined };
      subscription.unsubscribe = await assembled.batch.signAndSend(
        account.address,
        { signer: injector.signer },
        (result) => {
          setTransactionHash(result.txHash.toHex());
          if (result.dispatchError) {
            const error = result.dispatchError;
            const message = error.isModule
              ? (() => {
                  const decoded = assembled.api.registry.findMetaError(error.asModule);
                  return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
                })()
              : error.toString();
            setMintError(message);
            setMintState("error");
            subscription.unsubscribe?.();
            return;
          }
          if (result.status.isInBlock) setMintState("submitted");
          if (result.status.isFinalized) {
            void (async () => {
              try {
                const receipt = verifyFinalizedMintReceipt({
                  eventRecords: result.events,
                  expected: assembled.receiptExpectation,
                });
                const finalizedHash = result.status.asFinalized.toHex().toLowerCase();
                const [header, signedBlock, blockTimestamp, finalizedRuntime] = await Promise.all([
                  assembled.api.rpc.chain.getHeader(finalizedHash),
                  assembled.api.rpc.chain.getBlock(finalizedHash),
                  assembled.api.query.timestamp.now.at(finalizedHash),
                  assembled.api.rpc.state.getRuntimeVersion(finalizedHash),
                ]);
                const txHash = result.txHash.toHex().toLowerCase();
                const locatedIndex = signedBlock.block.extrinsics.findIndex(
                  (extrinsic) => extrinsic.hash.toHex().toLowerCase() === txHash,
                );
                if (locatedIndex < 0 || (result.txIndex !== undefined && result.txIndex !== locatedIndex)) {
                  throw new Error("FINALIZED_EXTRINSIC_POSITION_MISMATCH");
                }
                setMintEvidence(createMintEvidence({
                  genesisHash: assembled.api.genesisHash.toHex(),
                  runtimeSpec: finalizedRuntime.specVersion.toString(),
                  blockNumber: header.number.toString(),
                  blockHash: finalizedHash,
                  extrinsicIndex: locatedIndex,
                  extrinsicHash: txHash,
                  signerAddress: account.address,
                  signerAccountHex: assembled.receiptExpectation.signerAccountHex,
                  routeHotkey: assembled.review.routeHotkey,
                  routeHotkeyHex: assembled.receiptExpectation.routeHotkeyHex,
                  netuid: assembled.receiptExpectation.netuid,
                  subnetGeneration: assembled.currentGeneration,
                  taoSpentRao: assembled.receiptExpectation.taoAmountRao.toString(),
                  alphaBurnedRao: receipt.alphaBurnedRao.toString(),
                  limitPriceRao: assembled.review.limitPrice.toString(),
                  transactionFeeRao: receipt.transactionFeeRao.toString(),
                  transactionTipRao: receipt.transactionTipRao.toString(),
                  payload: assembled.review.payload,
                  payloadHash: assembled.receiptExpectation.remarkHash,
                  quoteBlock: assembled.review.quoteBlock,
                  finalizedAt: new Date(Number(blockTimestamp.toString())).toISOString(),
                }));
                setMintState("finalized");
              } catch {
                setMintError("The finalized chain proof did not exactly match the Neural Relics transaction you signed.");
                setMintState("error");
              } finally {
                subscription.unsubscribe?.();
              }
            })();
          }
        },
      );
    } catch (cause) {
      setMintError(cause instanceof Error ? cause.message : "The wallet did not complete the testnet mint.");
      setMintState("error");
    }
  }

  function downloadMintEvidence() {
    if (!mintEvidence) return;
    const blob = new Blob([`${JSON.stringify(mintEvidence, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${mintEvidence.artifactId.replaceAll(":", "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="site-shell">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Neural Relics home"><span className="brand-sigil" aria-hidden="true"><i /></span><span>Neural Relics</span></a>
        <div className="nav-links">
          <a href="#forge">Forge</a><a href="/explore">Explore</a><a href="/marketplace">Market</a><a href="/wallet">My Relics</a><a href="#protocol">Protocol</a>
          <span className={`chain-status ${dataState}`}><i aria-hidden="true" />{dataState === "ready" ? `Testnet v${runtimeVersion}` : dataState === "error" ? "RPC unavailable" : "Reading chain"}</span>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Native alpha burn artifacts</p>
          <h1>Forge permanence<span>from alpha.</span></h1>
          <p className="intro">Choose a Bittensor subnet. Buy and permanently burn its alpha. Receive a numbered digital relic proven by one finalized Subtensor transaction.</p>
          <div className="hero-actions"><a className="primary-link" href="#forge">Preview a forge <span aria-hidden="true">-&gt;</span></a><a className="text-link" href="#protocol">How the proof works</a></div>
          <dl className="hero-facts"><div><dt>Execution</dt><dd>Native SS58</dd></div><div><dt>Settlement</dt><dd>Finalized blocks</dd></div><div><dt>Contracts</dt><dd>No EVM</dd></div></dl>
        </div>

        <div className="relic-preview" aria-label="Example alpha burn receipt">
          <div className="relic-topline"><span>Relic proof</span><span>Testnet preview</span></div>
          <div className="relic-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-core" /></div>
          <div className="relic-number"><span>Subnet artifact</span><strong>SN{selectedSubnet?.netuid ?? "--"} / #0001</strong></div>
          <div className="receipt-grid"><div><span>TAO committed</span><strong>{taoAmount || "0"} TAO</strong></div><div><span>Alpha destroyed</span><strong>{quote ? formatToken(quote.alphaAmount, 4) : "--"} {selectedSubnet?.symbol}</strong></div></div>
          <p>Burn event + inscription, bound inside one atomic extrinsic.</p>
        </div>
      </section>

      <section className="forge-section" id="forge">
        <div className="section-heading"><div><p className="eyebrow">Testnet forge</p><h2>See exactly what the mint will burn.</h2></div><p>Reviewing re-quotes at the current block, checks the subnet generation and balance, then shows every limit before the wallet can sign.</p></div>
        <div className="forge-layout">
          <div className="forge-card">
            <div className="step-label"><span>01</span>Select a subnet</div>
            <label className="field"><span>Alpha economy</span><select value={selectedNetuid ?? ""} onChange={(event) => setSelectedNetuid(Number.parseInt(event.target.value, 10))} disabled={dataState !== "ready"}>{subnets.map((subnet) => <option key={`${subnet.netuid}-${subnet.generation}`} value={subnet.netuid}>SN{subnet.netuid} - {subnet.name} ({subnet.symbol})</option>)}</select></label>
            <div className="subnet-meta"><div><span>Subnet generation</span><strong>{selectedSubnet?.generation ?? "--"}</strong></div><div><span>Canonical identity</span><strong>{selectedSubnet ? `SN${selectedSubnet.netuid}:${selectedSubnet.generation}` : "--"}</strong></div></div>

            <div className="step-label amount-step"><span>02</span>Choose a burn amount</div>
            <label className="field amount-field"><span>TAO permanently committed</span><div><input inputMode="decimal" value={taoAmount} onChange={(event) => setTaoAmount(event.target.value)} aria-describedby="amount-help" /><em>TAO</em></div><small id="amount-help">Testnet TAO only. Nothing is submitted yet.</small></label>
            <div className="amount-options" aria-label="Preset test amounts">{["0.005", "0.05", "0.5"].map((amount) => <button key={amount} type="button" className={taoAmount === amount ? "active" : ""} onClick={() => setTaoAmount(amount)}>{amount} TAO</button>)}</div>

            <div className="step-label content-step"><span>03</span>Write the relic</div>
            <label className="field"><span>Name</span><input maxLength={80} value={relicName} onChange={(event) => { setRelicName(event.target.value); setMintReview(null); setMintState("idle"); }} placeholder="A name that survives the moment" /></label>
            <label className="field inscription-field"><span>Inscription</span><textarea maxLength={1024} value={relicBody} onChange={(event) => { setRelicBody(event.target.value); setMintReview(null); setMintState("idle"); }} placeholder="The text permanently bound to this alpha burn" /><small>{Array.from(relicBody).length}/1,024 characters</small></label>

            <div className="step-label wallet-step"><span>04</span>Connect the signer</div>
            {account ? (
              <div className="connected-wallet"><div className="account-avatar" aria-hidden="true">N</div><div><strong>{account.name}</strong><span>{shortAddress(account.address)}</span></div><div className="account-balance"><span>Test balance</span><strong>{balance === null ? "--" : `${formatToken(balance, 4)} TAO`}</strong></div><button type="button" onClick={disconnectWallet}>Disconnect</button></div>
            ) : (
              <button className="wallet-button" type="button" onClick={connectWallet} disabled={walletState === "connecting"}><span className="wallet-symbol" aria-hidden="true">N</span>{walletState === "connecting" ? "Opening TAOStats Wallet..." : "Connect TAOStats Wallet"}<span aria-hidden="true">-&gt;</span></button>
            )}
            {walletError && <p className="error-message" role="alert">{walletError}</p>}
          </div>

          <aside className="quote-card" aria-live="polite">
            <div className="quote-header"><div><span>Live chain quote</span><strong>{selectedSubnet?.name ?? "Select a subnet"}</strong></div><span className="read-only">Testnet</span></div>
            <div className="burn-output"><span>Estimated alpha destroyed</span><strong className={quoteLoading ? "loading" : ""}>{quote ? formatToken(quote.alphaAmount, 6) : "--"}</strong><em>{selectedSubnet?.symbol ?? "alpha"}</em></div>
            <dl className="quote-details"><div><dt>Spot price</dt><dd>{quote ? formatPrice(quote.priceRao) : "--"}</dd></div><div><dt>Pool fee</dt><dd>{quote ? `${formatToken(quote.taoFee, 7)} TAO` : "--"}</dd></div><div><dt>Price impact</dt><dd>{quote ? formatBps(quoteImpactBps(quote)) : "--"}</dd></div><div><dt>Execution</dt><dd>Atomic batch</dd></div></dl>
            {quoteError && <p className="quote-error">{quoteError}</p>}
            <div className="burn-warning"><span aria-hidden="true">!</span><p>The finished mint will permanently spend the TAO and burn the purchased alpha. It cannot be reversed.</p></div>
            {mintReview && (
              <div className="transaction-review">
                <div><span>Network</span><strong>Testnet / {shortAddress(genesisHash)}</strong></div>
                <div><span>Fresh at block</span><strong>#{mintReview.quoteBlock}</strong></div>
                <div><span>Registered burn hotkey</span><strong>{shortAddress(mintReview.routeHotkey)}</strong></div>
                <div><span>Maximum ending spot price (2%)</span><strong>{formatPrice(mintReview.limitPrice)}</strong></div>
                <div><span>Estimated chain fee</span><strong>{formatToken(mintReview.estimatedFee, 7)} TAO</strong></div>
                <div><span>Inscription payload</span><strong>{mintReview.payloadBytes} / 2,048 bytes</strong></div>
              </div>
            )}
            {mintError && <p className="error-message" role="alert">{mintError}</p>}
            {mintState === "finalized" && mintEvidence ? (
              <div className="mint-success">
                <strong>Relic mint finalized</strong>
                <span>{mintEvidence.artifactId}</span>
                <dl>
                  <div><dt>Finalized block</dt><dd>#{mintEvidence.blockNumber} / {mintEvidence.extrinsicIndex}</dd></div>
                  <div><dt>Alpha burned</dt><dd>{formatToken(BigInt(mintEvidence.alphaBurnedRao), 7)} {selectedSubnet?.symbol}</dd></div>
                  <div><dt>Actual chain fee</dt><dd>{formatToken(BigInt(mintEvidence.transactionFeeRao), 7)} TAO</dd></div>
                  <div><dt>Transaction</dt><dd>{shortAddress(mintEvidence.extrinsicHash)}</dd></div>
                </dl>
                <button type="button" onClick={downloadMintEvidence}>Download finalized proof</button>
              </div>
            ) : mintState === "review" ? (
              <button className="forge-button danger" type="button" onClick={signMint}>Sign and forge on testnet <span>Irreversible test burn</span></button>
            ) : (
              <button className="forge-button" type="button" onClick={reviewMint} disabled={!account || !quote || quoteLoading || mintState === "signing" || mintState === "submitted"}>
                {mintState === "signing" ? "Confirm in TAOStats Wallet" : mintState === "submitted" ? "Waiting for finality" : account ? "Review testnet forge" : "Connect wallet to continue"}
                <span>{mintState === "submitted" ? shortAddress(transactionHash) : "No mainnet funds"}</span>
              </button>
            )}
          </aside>
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div className="section-heading protocol-heading"><div><p className="eyebrow">One signature, three facts</p><h2>The chain proves the sacrifice.</h2></div><p>Neural Relics never pretends metadata lives inside a fungible alpha token. The artifact is derived from public, reproducible chain evidence.</p></div>
        <div className="protocol-steps">
          <article><span>01 / Buy</span><h3>TAO enters the selected pool.</h3><p>The native runtime swaps the committed TAO for that subnet&apos;s alpha.</p></article>
          <article><span>02 / Burn</span><h3>The acquired alpha is destroyed.</h3><p>A finalized AlphaBurned event records the exact amount, subnet, and signer.</p></article>
          <article><span>03 / Inscribe</span><h3>The Relic is permanently identified.</h3><p>The matching remark and burn share one atomic transaction and one canonical number.</p></article>
        </div>
        <div className="protocol-call"><span>Native call path</span><code>batchAll[ addStakeBurn, remarkWithEvent ]</code><em>No EVM. No custody. Finalized testnet only.</em></div>
      </section>

      <footer><a className="brand footer-brand" href="#top"><span className="brand-sigil" aria-hidden="true"><i /></span><span>Neural Relics</span></a><p>Alpha burn artifacts on Subtensor. Testnet research build.</p><a href="https://taostats.io/bittensor-chrome-wallet" target="_blank" rel="noreferrer">TAOStats Wallet -&gt;</a></footer>
    </main>
  );
}
