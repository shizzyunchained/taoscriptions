"use client";

import { useMemo, useState } from "react";

const APP_NAME = "TAOscriptions";
const TESTNET_RPC =
  process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";

type WalletAccount = {
  address: string;
  name: string;
  source: string;
};

type ConnectionState = "idle" | "connecting" | "connected" | "error";

function shortAddress(address: string) {
  if (address.length < 18) return address;
  return `${address.slice(0, 9)}…${address.slice(-8)}`;
}

function formatTao(raw: bigint) {
  const whole = raw / 1_000_000_000n;
  const fraction = (raw % 1_000_000_000n)
    .toString()
    .padStart(9, "0")
    .slice(0, 4)
    .replace(/0+$/, "");

  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} τ`;
}

export default function Home() {
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [balance, setBalance] = useState<string>("—");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const buttonLabel = useMemo(() => {
    if (status === "connecting") return "Opening TAOStats…";
    if (status === "connected") return "Wallet connected";
    return "Connect TAOStats Wallet";
  }, [status]);

  async function connectWallet() {
    setStatus("connecting");
    setError("");

    try {
      const { web3Accounts, web3Enable } = await import(
        "@polkadot/extension-dapp"
      );
      const { ApiPromise, WsProvider } = await import("@polkadot/api");
      const extensions = await web3Enable(APP_NAME);
      if (extensions.length === 0) {
        throw new Error(
          "TAOStats Wallet was not detected. Install or unlock the TAOStats Chrome extension, then try again.",
        );
      }

      const accounts = await web3Accounts();
      if (accounts.length === 0) {
        throw new Error(
          "No wallet account was shared. Open TAOStats Wallet and approve access for this site.",
        );
      }

      const preferred =
        accounts.find((item) =>
          /tao.?stats|bittensor/i.test(item.meta.source ?? ""),
        ) ?? accounts[0];

      const nextAccount = {
        address: preferred.address,
        name: preferred.meta.name || "TAOStats account",
        source: preferred.meta.source || extensions[0]?.name || "TAOStats",
      };

      setAccount(nextAccount);

      const provider = new WsProvider(TESTNET_RPC);
      const api = await ApiPromise.create({ provider });

      try {
        const accountInfo = await api.query.system.account(
          nextAccount.address,
        );
        const raw = BigInt(
          (accountInfo as unknown as { data: { free: { toString(): string } } })
            .data.free.toString(),
        );
        setBalance(formatTao(raw));
      } finally {
        await api.disconnect();
      }

      setStatus("connected");
    } catch (cause) {
      setAccount(null);
      setBalance("—");
      setError(
        cause instanceof Error
          ? cause.message
          : "The wallet connection could not be completed.",
      );
      setStatus("error");
    }
  }

  function disconnectWallet() {
    setAccount(null);
    setBalance("—");
    setError("");
    setCopied(false);
    setStatus("idle");
  }

  async function copyAddress() {
    if (!account) return;
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#" aria-label="TAOscriptions home">
          <span className="brand-mark" aria-hidden="true">
            τ
          </span>
          <span>TAOscriptions</span>
        </a>
        <div className="network-badge">
          <span className="network-dot" aria-hidden="true" />
          Subtensor Testnet
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span>Native TAO inscriptions</span>
          <span className="eyebrow-divider" />
          <span>No EVM</span>
        </div>

        <h1>Your TAO wallet.<br />Your on-chain identity.</h1>
        <p className="intro">
          Connect your TAOStats wallet to enter the first native inscription
          experience built for Subtensor.
        </p>

        <div className="wallet-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">
                {account ? "Connected account" : "Start here"}
              </p>
              <h2>{account ? account.name : "Connect your wallet"}</h2>
            </div>
            <span className={`status-orb ${account ? "online" : ""}`}>
              {account ? "Live" : "Testnet"}
            </span>
          </div>

          {account ? (
            <div className="account-panel">
              <div className="account-row">
                <div>
                  <span className="field-label">SS58 address</span>
                  <button
                    className="address-button"
                    type="button"
                    onClick={copyAddress}
                    aria-label="Copy wallet address"
                  >
                    {shortAddress(account.address)}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="balance-block">
                  <span className="field-label">Testnet balance</span>
                  <strong>{balance}</strong>
                </div>
              </div>
              <div className="provider-row">
                <span>Wallet provider</span>
                <strong>{account.source}</strong>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={disconnectWallet}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <button
                className="connect-button"
                type="button"
                onClick={connectWallet}
                disabled={status === "connecting"}
              >
                <span className="button-icon" aria-hidden="true">τ</span>
                {buttonLabel}
                <span className="button-arrow" aria-hidden="true">→</span>
              </button>

              {error && <p className="error-message" role="alert">{error}</p>}

              <p className="privacy-note">
                We never see your seed phrase or private keys. TAOStats asks
                you to approve every connection and transaction.
              </p>
            </>
          )}
        </div>

        <div className="trust-row" aria-label="Product principles">
          <div><span>01</span><p>Native SS58</p></div>
          <div><span>02</span><p>Non-custodial</p></div>
          <div><span>03</span><p>Open protocol</p></div>
        </div>
      </section>

      <footer>
        <p>Connection preview · No mainnet transactions enabled</p>
        <a
          href="https://taostats.io/bittensor-chrome-wallet"
          target="_blank"
          rel="noreferrer"
        >
          Get TAOStats Wallet ↗
        </a>
      </footer>
    </main>
  );
}
