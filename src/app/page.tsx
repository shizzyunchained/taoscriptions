"use client";

import { useMemo, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import type { DispatchError } from "@polkadot/types/interfaces";

const APP_NAME = "TAOscriptions";
const TESTNET_RPC =
  process.env.NEXT_PUBLIC_SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";

type WalletAccount = {
  address: string;
  name: string;
  source: string;
};

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type MintState =
  | "idle"
  | "preparing"
  | "awaiting-signature"
  | "broadcasting"
  | "finalized"
  | "error";

type InscriptionProof = {
  title: string;
  content: string;
  transactionHash: string;
  blockHash: string;
};

const MAX_TITLE_LENGTH = 60;
const MAX_CONTENT_LENGTH = 280;

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

function buildInscriptionPayload(title: string, content: string) {
  return JSON.stringify({
    p: "taoscriptions",
    v: 1,
    op: "mint",
    type: "text/plain;charset=utf-8",
    title,
    content,
  });
}

function transactionErrorMessage(
  api: Pick<ApiPromise, "registry">,
  dispatchError: DispatchError,
) {
  if (!dispatchError.isModule) return dispatchError.toString();

  const decoded = api.registry.findMetaError(dispatchError.asModule);
  return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
}

export default function Home() {
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [balance, setBalance] = useState<string>("—");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mintState, setMintState] = useState<MintState>("idle");
  const [mintError, setMintError] = useState("");
  const [proof, setProof] = useState<InscriptionProof | null>(null);

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
    setMintState("idle");
    setMintError("");
    setProof(null);
    setStatus("idle");
  }

  async function copyAddress() {
    if (!account) return;
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function mintInscription() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!account || !cleanTitle || !cleanContent) return;

    setMintState("preparing");
    setMintError("");
    setProof(null);

    const payload = buildInscriptionPayload(cleanTitle, cleanContent);

    try {
      const [{ ApiPromise, WsProvider }, { web3FromSource }] =
        await Promise.all([
          import("@polkadot/api"),
          import("@polkadot/extension-dapp"),
        ]);
      const injector = await web3FromSource(account.source);
      const api = await ApiPromise.create({
        provider: new WsProvider(TESTNET_RPC),
      });

      try {
        if (!api.tx.system.remarkWithEvent) {
          throw new Error(
            "This Subtensor runtime does not currently support inscription remarks.",
          );
        }

        const transaction = api.tx.system.remarkWithEvent(
          new TextEncoder().encode(payload),
        );

        setMintState("awaiting-signature");

        await new Promise<void>((resolve, reject) => {
          let unsubscribe: (() => void) | undefined;

          transaction
            .signAndSend(
              account.address,
              { signer: injector.signer },
              (result) => {
                if (result.dispatchError) {
                  unsubscribe?.();
                  reject(
                    new Error(
                      transactionErrorMessage(api, result.dispatchError),
                    ),
                  );
                  return;
                }

                if (result.status.isBroadcast || result.status.isInBlock) {
                  setMintState("broadcasting");
                }

                if (result.status.isFinalized) {
                  setProof({
                    title: cleanTitle,
                    content: cleanContent,
                    transactionHash: result.txHash.toHex(),
                    blockHash: result.status.asFinalized.toHex(),
                  });
                  setMintState("finalized");
                  unsubscribe?.();
                  resolve();
                }
              },
            )
            .then((stop) => {
              unsubscribe = stop;
            })
            .catch(reject);
        });
      } finally {
        await api.disconnect();
      }
    } catch (cause) {
      setMintError(
        cause instanceof Error
          ? cause.message
          : "The inscription transaction could not be completed.",
      );
      setMintState("error");
    }
  }

  const isMinting =
    mintState === "preparing" ||
    mintState === "awaiting-signature" ||
    mintState === "broadcasting";

  const mintButtonLabel =
    mintState === "preparing"
      ? "Preparing inscription…"
      : mintState === "awaiting-signature"
        ? "Approve in TAOStats…"
        : mintState === "broadcasting"
          ? "Waiting for finalization…"
          : "Mint test inscription";

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
        <div className="nav-actions">
          <details className="mint-menu">
            <summary>
              Mint
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="mint-dropdown">
              <a href="#mint">
                <span className="menu-icon" aria-hidden="true">T</span>
                <span>
                  <strong>Text inscription</strong>
                  <small>Available on testnet</small>
                </span>
                <em>Live</em>
              </a>
              <div className="menu-item-disabled" aria-disabled="true">
                <span className="menu-icon" aria-hidden="true">◆</span>
                <span>
                  <strong>Image inscription</strong>
                  <small>Media stored with proof</small>
                </span>
                <em>Soon</em>
              </div>
              <div className="menu-item-disabled" aria-disabled="true">
                <span className="menu-icon" aria-hidden="true">C</span>
                <span>
                  <strong>Create collection</strong>
                  <small>Group inscriptions together</small>
                </span>
                <em>Soon</em>
              </div>
            </div>
          </details>
          <div className="network-badge">
            <span className="network-dot" aria-hidden="true" />
            Subtensor Testnet
          </div>
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

        <div className="mint-card" id="mint">
            <div className="card-heading">
              <div>
                <p className="card-kicker">Protocol experiment · Step 1</p>
                <h2>Mint a text inscription</h2>
              </div>
              <span className="status-orb">Testnet only</span>
            </div>

            <p className="mint-explainer">
              Your wallet signs a TAOscriptions message into a native
              Subtensor transaction. Only testnet TAO fees apply.
            </p>

            {account ? (
              <>
              <label className="input-group">
              <span>Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="My first TAOscription"
                disabled={isMinting}
              />
              <small>{title.length}/{MAX_TITLE_LENGTH}</small>
            </label>

            <label className="input-group">
              <span>Inscription</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={MAX_CONTENT_LENGTH}
                placeholder="Write something permanent for the testnet…"
                rows={4}
                disabled={isMinting}
              />
              <small>{content.length}/{MAX_CONTENT_LENGTH}</small>
            </label>

            <button
              className="mint-button"
              type="button"
              onClick={mintInscription}
              disabled={
                isMinting || title.trim() === "" || content.trim() === ""
              }
            >
              {mintButtonLabel}
              <span aria-hidden="true">↗</span>
            </button>

            {mintError && (
              <p className="error-message" role="alert">{mintError}</p>
            )}

            {proof && (
              <div className="proof-card" aria-live="polite">
                <div className="proof-status">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>Inscription finalized</strong>
                    <p>{proof.title}</p>
                  </div>
                </div>
                <blockquote>{proof.content}</blockquote>
                <dl>
                  <div>
                    <dt>Transaction</dt>
                    <dd title={proof.transactionHash}>
                      {shortAddress(proof.transactionHash)}
                    </dd>
                  </div>
                  <div>
                    <dt>Block</dt>
                    <dd title={proof.blockHash}>
                      {shortAddress(proof.blockHash)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

              </>
            ) : (
              <div className="mint-locked">
                <span className="lock-mark" aria-hidden="true">τ</span>
                <div>
                  <strong>Connect to unlock minting</strong>
                  <p>Your TAOStats wallet signs every inscription.</p>
                </div>
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={status === "connecting"}
                >
                  {status === "connecting" ? "Opening wallet…" : "Connect wallet"}
                </button>
              </div>
            )}

            <p className="protocol-note">
              Experimental protocol record. Transfers and marketplace
              ownership rules are not enabled yet.
            </p>
          </div>

        <div className="trust-row" aria-label="Product principles">
          <div><span>01</span><p>Native SS58</p></div>
          <div><span>02</span><p>Non-custodial</p></div>
          <div><span>03</span><p>Open protocol</p></div>
        </div>
      </section>

      <footer>
        <p>Testnet inscription preview · No mainnet transactions enabled</p>
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
