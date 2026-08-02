"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiPromise } from "@polkadot/api";

const APP_NAME = "Neural Relics";
const TESTNET_RPC = process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";
const RAO_PER_TAO = 1_000_000_000n;

type WalletAccount = { address: string; name: string; source: string };
type Subnet = { netuid: number; generation: string; name: string; symbol: string; ownerHotkey: string };
type BurnQuote = { alphaAmount: bigint; alphaSlippage: bigint; priceRao: bigint; taoFee: bigint };
type ConnectionState = "idle" | "connecting" | "connected" | "error";
type DataState = "connecting" | "ready" | "error";

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

  useEffect(() => {
    let cancelled = false;
    let activeApi: ApiPromise | null = null;

    async function loadSubnets() {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const api = await ApiPromise.create({ provider: new WsProvider(TESTNET_RPC), noInitWarn: true });
        activeApi = api;
        if (cancelled) {
          await api.disconnect();
          return;
        }
        apiRef.current = api;
        setRuntimeVersion(api.runtimeVersion.specVersion.toString());

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
          taoFee: { toString(): string };
        };
        const nextQuote = {
          alphaAmount: BigInt(decoded.alphaAmount.toString()),
          alphaSlippage: BigInt(decoded.alphaSlippage.toString()),
          priceRao: BigInt(priceResult.toString()),
          taoFee: BigInt(decoded.taoFee.toString()),
        };
        if (nextQuote.alphaAmount === 0n) throw new Error("This amount cannot be quoted on the selected subnet.");
        if (!cancelled) setQuote(nextQuote);
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

  return (
    <main className="site-shell">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Neural Relics home"><span className="brand-sigil" aria-hidden="true"><i /></span><span>Neural Relics</span></a>
        <div className="nav-links">
          <a href="#forge">Forge</a><a href="#protocol">Protocol</a>
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
        <div className="section-heading"><div><p className="eyebrow">Forge preview</p><h2>See exactly what the mint would burn.</h2></div><p>This stage only reads testnet. The transaction button stays locked until the quote, wallet checks, and atomic mint pass verification.</p></div>
        <div className="forge-layout">
          <div className="forge-card">
            <div className="step-label"><span>01</span>Select a subnet</div>
            <label className="field"><span>Alpha economy</span><select value={selectedNetuid ?? ""} onChange={(event) => setSelectedNetuid(Number.parseInt(event.target.value, 10))} disabled={dataState !== "ready"}>{subnets.map((subnet) => <option key={`${subnet.netuid}-${subnet.generation}`} value={subnet.netuid}>SN{subnet.netuid} - {subnet.name} ({subnet.symbol})</option>)}</select></label>
            <div className="subnet-meta"><div><span>Subnet generation</span><strong>{selectedSubnet?.generation ?? "--"}</strong></div><div><span>Canonical identity</span><strong>{selectedSubnet ? `SN${selectedSubnet.netuid}:${selectedSubnet.generation}` : "--"}</strong></div></div>

            <div className="step-label amount-step"><span>02</span>Choose a burn amount</div>
            <label className="field amount-field"><span>TAO permanently committed</span><div><input inputMode="decimal" value={taoAmount} onChange={(event) => setTaoAmount(event.target.value)} aria-describedby="amount-help" /><em>TAO</em></div><small id="amount-help">Testnet TAO only. Nothing is submitted yet.</small></label>
            <div className="amount-options" aria-label="Preset test amounts">{["0.005", "0.05", "0.5"].map((amount) => <button key={amount} type="button" className={taoAmount === amount ? "active" : ""} onClick={() => setTaoAmount(amount)}>{amount} TAO</button>)}</div>

            <div className="step-label wallet-step"><span>03</span>Connect the signer</div>
            {account ? (
              <div className="connected-wallet"><div className="account-avatar" aria-hidden="true">N</div><div><strong>{account.name}</strong><span>{shortAddress(account.address)}</span></div><div className="account-balance"><span>Test balance</span><strong>{balance === null ? "--" : `${formatToken(balance, 4)} TAO`}</strong></div><button type="button" onClick={disconnectWallet}>Disconnect</button></div>
            ) : (
              <button className="wallet-button" type="button" onClick={connectWallet} disabled={walletState === "connecting"}><span className="wallet-symbol" aria-hidden="true">N</span>{walletState === "connecting" ? "Opening TAOStats Wallet..." : "Connect TAOStats Wallet"}<span aria-hidden="true">-&gt;</span></button>
            )}
            {walletError && <p className="error-message" role="alert">{walletError}</p>}
          </div>

          <aside className="quote-card" aria-live="polite">
            <div className="quote-header"><div><span>Live chain quote</span><strong>{selectedSubnet?.name ?? "Select a subnet"}</strong></div><span className="read-only">Read only</span></div>
            <div className="burn-output"><span>Estimated alpha destroyed</span><strong className={quoteLoading ? "loading" : ""}>{quote ? formatToken(quote.alphaAmount, 6) : "--"}</strong><em>{selectedSubnet?.symbol ?? "alpha"}</em></div>
            <dl className="quote-details"><div><dt>Spot price</dt><dd>{quote ? formatPrice(quote.priceRao) : "--"}</dd></div><div><dt>Pool fee</dt><dd>{quote ? `${formatToken(quote.taoFee, 7)} TAO` : "--"}</dd></div><div><dt>Price impact</dt><dd>{quote ? formatBps(quoteImpactBps(quote)) : "--"}</dd></div><div><dt>Execution</dt><dd>Atomic batch</dd></div></dl>
            {quoteError && <p className="quote-error">{quoteError}</p>}
            <div className="burn-warning"><span aria-hidden="true">!</span><p>The finished mint will permanently spend the TAO and burn the purchased alpha. It cannot be reversed.</p></div>
            <button className="forge-button" type="button" disabled>Forge transaction locked <span>Testnet verification next</span></button>
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
