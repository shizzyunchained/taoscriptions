"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import type { EventRecord } from "@polkadot/types/interfaces";
import {
  calculateLimitPrice,
  CONTENT_POLICY_ID,
  createInlineMintPayload,
  createOnChainImageMintPayload,
  DEFAULT_SLIPPAGE_BPS,
  MAX_MINT_REMARK_BYTES,
  MAX_ONCHAIN_IMAGE_BYTES,
  type RelicPurpose,
} from "@/lib/protocol";
import {
  verifyFinalizedMintReceipt,
  type MintReceiptExpectation,
} from "@/lib/mint-receipt";
import { createMintEvidence, type MintEvidence } from "@/lib/mint-evidence";
import { assertExpectedGenesis } from "@/lib/chain-guard";
import { assertMintPreflight } from "@/lib/mint-preflight";
import { SiteNav } from "@/components/site-nav";

const APP_NAME = "Bittensor Relics";
const TESTNET_HTTP_RPC =
  process.env.NEXT_PUBLIC_SUBTENSOR_HTTP_RPC ??
  "https://test.chain.opentensor.ai";
const TESTNET_GENESIS =
  process.env.NEXT_PUBLIC_CHAIN_GENESIS_HASH ??
  "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const RAO_PER_TAO = 1_000_000_000n;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type WalletAccount = { address: string; name: string; source: string };
type Subnet = {
  netuid: number;
  generation: string;
  name: string;
  symbol: string;
  ownerHotkey: string;
};
type BurnQuote = {
  alphaAmount: bigint;
  alphaSlippage: bigint;
  priceRao: bigint;
  taoAmount: bigint;
  taoFee: bigint;
};
type MintReview = {
  payload: string;
  payloadBytes: number;
  imageBytes: number;
  purpose: RelicPurpose;
  collection: string;
  limitPrice: bigint;
  estimatedFee: bigint;
  quoteBlock: string;
  routeHotkey: string;
};
type OnChainImage = {
  bytes: Uint8Array;
  previewUrl: string;
  contentHash: string;
  width: number;
  height: number;
};
type ConnectionState = "idle" | "connecting" | "connected" | "error";
type DataState = "connecting" | "ready" | "error";
type MintState =
  | "idle"
  | "review"
  | "signing"
  | "submitted"
  | "finalized"
  | "error";

function SubnetPicker({
  subnets,
  selectedNetuid,
  onSelect,
  disabled,
}: {
  subnets: Subnet[];
  selectedNetuid: number | null;
  onSelect: (netuid: number) => void;
  disabled: boolean;
}) {
  const selected =
    subnets.find((subnet) => subnet.netuid === selectedNetuid) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? subnets.filter((subnet) =>
          `sn${subnet.netuid} ${subnet.netuid} ${subnet.name} ${subnet.symbol}`
            .toLowerCase()
            .includes(normalized),
        )
      : [...subnets].sort((a, b) => {
          const aNamed = /^Subnet \d+$/i.test(a.name) ? 1 : 0;
          const bNamed = /^Subnet \d+$/i.test(b.name) ? 1 : 0;
          return aNamed - bNamed || a.netuid - b.netuid;
        });
    return matches.slice(0, 10);
  }, [query, subnets]);

  function choose(subnet: Subnet) {
    onSelect(subnet.netuid);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="field subnet-picker">
      <span>Alpha economy</span>
      <div
        className={`subnet-picker-control ${open ? "open" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          className="subnet-selected"
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="subnet-results"
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              setQuery(event.key);
              setOpen(true);
            }
          }}
        >
          <span>
            <strong>
              {selected
                ? `SN${selected.netuid} · ${selected.name}`
                : disabled
                  ? "Reading alpha economies…"
                  : "Choose an alpha economy"}
            </strong>
            <small>
              {selected
                ? `${selected.symbol} · generation ${selected.generation}`
                : "Select a subnet"}
            </small>
          </span>
          <i aria-hidden="true" />
        </button>
        {open && !disabled && (
          <div className="subnet-dropdown">
            <label>
              <span className="sr-only">Search subnets</span>
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results[0]) {
                    event.preventDefault();
                    choose(results[0]);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
                placeholder="Type a subnet name or SN number…"
                role="combobox"
                aria-label="Search alpha economies"
                aria-expanded="true"
                aria-controls="subnet-results"
                aria-autocomplete="list"
              />
            </label>
            <div className="subnet-results" id="subnet-results" role="listbox">
              {results.length ? (
                results.map((subnet) => (
                  <button
                    key={`${subnet.netuid}-${subnet.generation}`}
                    type="button"
                    role="option"
                    aria-selected={subnet.netuid === selectedNetuid}
                    onClick={() => choose(subnet)}
                  >
                    <span>SN{subnet.netuid}</span>
                    <strong>{subnet.name}</strong>
                    <em>{subnet.symbol}</em>
                    <small>gen {subnet.generation}</small>
                  </button>
                ))
              ) : (
                <p>No matching alpha economy.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function shortAddress(address: string) {
  if (address.length < 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-7)}`;
}

function taoToRao(value: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,9})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * RAO_PER_TAO + BigInt(fraction.padEnd(9, "0"));
}

function formatToken(raw: bigint, maximumFractionDigits = 5) {
  const whole = raw / RAO_PER_TAO;
  const fraction = (raw % RAO_PER_TAO)
    .toString()
    .padStart(9, "0")
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""}`;
}

function formatPrice(raw: bigint) {
  return raw === 0n ? "--" : `${formatToken(raw, 7)} TAO / alpha`;
}

function quoteImpactBps(quote: BurnQuote) {
  const noSlippageAmount = quote.alphaAmount + quote.alphaSlippage;
  return noSlippageAmount === 0n
    ? 0n
    : (quote.alphaSlippage * 10_000n) / noSlippageAmount;
}

function formatBps(bps: bigint) {
  return `${bps / 100n}.${(bps % 100n).toString().padStart(2, "0")}%`;
}

function waitFor(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForFinalizedExtrinsic(
  api: ApiPromise,
  txHash: string,
  afterBlock: number,
) {
  const deadline = Date.now() + 180_000;
  let checkedBlock = afterBlock;
  while (Date.now() < deadline) {
    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);
    const finalizedNumber = finalizedHeader.number.toNumber();
    for (
      let blockNumber = checkedBlock + 1;
      blockNumber <= finalizedNumber;
      blockNumber += 1
    ) {
      const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
      const signedBlock = await api.rpc.chain.getBlock(blockHash);
      const extrinsicIndex = signedBlock.block.extrinsics.findIndex(
        (extrinsic) => extrinsic.hash.toHex().toLowerCase() === txHash,
      );
      if (extrinsicIndex >= 0) {
        const [eventCodec, blockTimestamp, finalizedRuntime] =
          await Promise.all([
            api.query.system.events.at(blockHash),
            api.query.timestamp.now.at(blockHash),
            api.rpc.state.getRuntimeVersion(blockHash),
          ]);
        const eventRecords = Array.from(
          eventCodec as unknown as Iterable<EventRecord>,
        ).filter(
          (record) =>
            record.phase.isApplyExtrinsic &&
            record.phase.asApplyExtrinsic.toNumber() === extrinsicIndex,
        );
        return {
          blockHash: blockHash.toHex().toLowerCase(),
          blockNumber,
          blockTimestamp,
          eventRecords,
          extrinsicIndex,
          finalizedRuntime,
        };
      }
      checkedBlock = blockNumber;
    }
    await waitFor(4_000);
  }
  throw new Error(
    "The transaction was submitted but finality confirmation timed out. Check the transaction hash before trying again.",
  );
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
}

async function prepareOnChainImage(file: File): Promise<OnChainImage> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a PNG, JPG, or WebP image.");
  }
  if (file.size > 15_000_000)
    throw new Error("Choose an original image smaller than 15 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const crop = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - crop) / 2;
    const sourceY = (bitmap.height - crop) / 2;
    for (const size of [256, 224, 192, 160, 128, 96, 64]) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser cannot prepare the image.");
      context.drawImage(bitmap, sourceX, sourceY, crop, crop, 0, 0, size, size);
      for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
        const blob = await canvasBlob(canvas, quality);
        if (!blob || blob.type !== "image/webp") continue;
        if (blob.size <= MAX_ONCHAIN_IMAGE_BYTES) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const digest = new Uint8Array(
            await crypto.subtle.digest("SHA-256", bytes),
          );
          const contentHash = `sha256:${Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("")}`;
          return {
            bytes,
            previewUrl: URL.createObjectURL(blob),
            contentHash,
            width: size,
            height: size,
          };
        }
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error(
    "The image could not be compressed safely for an on-chain mint.",
  );
}

export default function Home() {
  const apiRef = useRef<ApiPromise | null>(null);
  const apiPromiseRef = useRef<Promise<ApiPromise> | null>(null);
  const [dataState, setDataState] = useState<DataState>("connecting");
  const [dataError, setDataError] = useState("");
  const [dataRetry, setDataRetry] = useState(0);
  const [signerReady, setSignerReady] = useState(false);
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
  const [relicPurpose, setRelicPurpose] = useState<RelicPurpose>("personal");
  const [collectionLabel, setCollectionLabel] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [onChainImage, setOnChainImage] = useState<OnChainImage | null>(null);
  const [imageState, setImageState] = useState<
    "idle" | "processing" | "ready" | "error"
  >("idle");
  const [imageError, setImageError] = useState("");
  const [mintState, setMintState] = useState<MintState>("idle");
  const [mintReview, setMintReview] = useState<MintReview | null>(null);
  const [mintError, setMintError] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [mintEvidence, setMintEvidence] = useState<MintEvidence | null>(null);

  useEffect(
    () => () => {
      if (onChainImage) URL.revokeObjectURL(onChainImage.previewUrl);
    },
    [onChainImage],
  );

  async function chooseImage(file: File | undefined) {
    setImageError("");
    setMintReview(null);
    setMintState("idle");
    if (!file) return;
    setImageState("processing");
    try {
      const prepared = await prepareOnChainImage(file);
      setOnChainImage(prepared);
      setImageState("ready");
    } catch (cause) {
      setOnChainImage(null);
      setImageState("error");
      setImageError(
        cause instanceof Error
          ? cause.message
          : "The image could not be prepared.",
      );
    }
  }

  function removeImage() {
    setOnChainImage(null);
    setImageState("idle");
    setImageError("");
    setMintReview(null);
    setMintState("idle");
  }

  async function getSigningApi() {
    if (apiRef.current) return apiRef.current;
    if (!apiPromiseRef.current) {
      apiPromiseRef.current = (async () => {
        const { ApiPromise, HttpProvider } = await import("@polkadot/api");
        const api = await ApiPromise.create({
          provider: new HttpProvider(TESTNET_HTTP_RPC),
          noInitWarn: true,
        });
        assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
        apiRef.current = api;
        setSignerReady(true);
        return api;
      })().catch((error) => {
        apiPromiseRef.current = null;
        setSignerReady(false);
        throw error;
      });
    }
    return apiPromiseRef.current;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSubnets() {
      setDataState("connecting");
      setDataError("");
      try {
        const response = await fetch("/api/v1/chain/subnets", {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          genesisHash?: string;
          runtimeVersion?: string;
          subnets?: Subnet[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            body.error?.message || "Finalized testnet data is unavailable.",
          );
        assertExpectedGenesis(body.genesisHash ?? "", TESTNET_GENESIS);
        const nextSubnets = body.subnets ?? [];
        if (nextSubnets.length === 0)
          throw new Error("No active testnet subnets were returned.");

        if (!cancelled) {
          setRuntimeVersion(body.runtimeVersion ?? "--");
          setGenesisHash(body.genesisHash ?? "--");
          setSubnets(nextSubnets);
          setSelectedNetuid((current) =>
            nextSubnets.some((subnet) => subnet.netuid === current)
              ? current
              : (nextSubnets[0]?.netuid ?? null),
          );
          setDataState("ready");
        }
      } catch (cause) {
        if (!cancelled) {
          setDataState("error");
          setDataError(
            cause instanceof Error
              ? cause.message
              : "Finalized testnet data is unavailable.",
          );
        }
      }
    }

    void loadSubnets();
    return () => {
      cancelled = true;
    };
  }, [dataRetry]);

  useEffect(() => {
    void getSigningApi().catch(() => undefined);
    return () => {
      const api = apiRef.current;
      apiRef.current = null;
      apiPromiseRef.current = null;
      if (api) void api.disconnect();
    };
  }, []);

  useEffect(() => {
    const amountRao = taoToRao(taoAmount);
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      if (
        dataState !== "ready" ||
        selectedNetuid === null ||
        !amountRao ||
        amountRao === 0n
      ) {
        setQuote(null);
        return;
      }
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const response = await fetch(
          `/api/v1/chain/quote?netuid=${selectedNetuid}&taoRao=${amountRao}`,
          { cache: "no-store" },
        );
        const decoded = (await response.json()) as {
          alphaAmountRao?: string;
          alphaSlippageRao?: string;
          priceRao?: string;
          taoAmountRao?: string;
          taoFeeRao?: string;
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            decoded.error?.message ||
              "The burn quote is temporarily unavailable.",
          );
        const nextQuote = {
          alphaAmount: BigInt(decoded.alphaAmountRao ?? "0"),
          alphaSlippage: BigInt(decoded.alphaSlippageRao ?? "0"),
          priceRao: BigInt(decoded.priceRao ?? "0"),
          taoAmount: BigInt(decoded.taoAmountRao ?? "0"),
          taoFee: BigInt(decoded.taoFeeRao ?? "0"),
        };
        if (nextQuote.alphaAmount === 0n)
          throw new Error(
            "This amount cannot be quoted on the selected subnet.",
          );
        if (!cancelled) {
          setQuote(nextQuote);
          setMintReview(null);
          setMintState("idle");
        }
      } catch (cause) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(
            cause instanceof Error
              ? cause.message
              : "The burn quote is temporarily unavailable.",
          );
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

  const selectedSubnet = useMemo(
    () => subnets.find((subnet) => subnet.netuid === selectedNetuid) ?? null,
    [selectedNetuid, subnets],
  );

  async function connectWallet() {
    setWalletState("connecting");
    setWalletError("");
    try {
      const { web3Accounts, web3Enable } = await import(
        "@polkadot/extension-dapp"
      );
      const extensions = await web3Enable(APP_NAME);
      if (extensions.length === 0)
        throw new Error("Unlock TAOStats Wallet, then try connecting again.");
      const accounts = await web3Accounts();
      if (accounts.length === 0)
        throw new Error("Share one account from TAOStats Wallet to continue.");
      const preferred =
        accounts.find((item) =>
          /tao.?stats|bittensor/i.test(item.meta.source ?? ""),
        ) ?? accounts[0];
      const nextAccount = {
        address: preferred.address,
        name: preferred.meta.name || "TAOStats account",
        source: preferred.meta.source || extensions[0]?.name || "TAOStats",
      };

      let api = apiRef.current;
      if (!api) {
        try {
          api = await getSigningApi();
        } catch {
          api = null;
        }
      }
      if (api) {
        assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
        const accountInfo = await api.query.system.account(nextAccount.address);
        const raw = BigInt(
          (
            accountInfo as unknown as { data: { free: { toString(): string } } }
          ).data.free.toString(),
        );
        setBalance(raw);
      }

      setAccount(nextAccount);
      setWalletState("connected");
    } catch (cause) {
      setWalletError(
        cause instanceof Error
          ? cause.message
          : "The wallet connection could not be completed.",
      );
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
    let api = apiRef.current;
    const amountRao = taoToRao(taoAmount);
    if (dataState !== "ready")
      throw new Error("Finalized testnet data is not ready.");
    if (!api) {
      try {
        api = await getSigningApi();
      } catch {
        throw new Error(
          "The wallet signing connection is temporarily unavailable. Chain data is safe; retry review in a moment.",
        );
      }
    }
    assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
    if (!account) throw new Error("Connect the signing wallet first.");
    if (!selectedSubnet || selectedNetuid === null)
      throw new Error("Choose a subnet first.");
    if (!amountRao || amountRao === 0n)
      throw new Error("Enter a valid TAO amount.");
    if (!policyAccepted)
      throw new Error(
        "Confirm the Relics content covenant before reviewing the mint.",
      );

    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    const [apiAt, header] = await Promise.all([
      api.at(finalizedHash),
      api.rpc.chain.getHeader(finalizedHash),
    ]);
    const [
      generationResult,
      routeHotkeyResult,
      subtokenEnabledResult,
      priceResult,
      quoteResult,
    ] = await Promise.all([
      apiAt.query.subtensorModule.networkRegisteredAt(selectedNetuid),
      apiAt.query.subtensorModule.subnetOwnerHotkey(selectedNetuid),
      apiAt.query.subtensorModule.subtokenEnabled(selectedNetuid),
      apiAt.call.swapRuntimeApi.currentAlphaPrice(selectedNetuid),
      apiAt.call.swapRuntimeApi.simSwapTaoForAlpha(
        selectedNetuid,
        amountRao.toString(),
      ),
    ]);
    const currentGeneration = generationResult.toString();
    const routeHotkey = routeHotkeyResult.toString();

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
    if (freshQuote.alphaAmount === 0n)
      throw new Error("The selected burn no longer returns alpha.");
    const minimumStakeRao = BigInt(
      apiAt.consts.subtensorModule.initialMinStake.toString(),
    );

    const payload = onChainImage
      ? createOnChainImageMintPayload({
          netuid: selectedNetuid,
          subnetGeneration: currentGeneration,
          name: relicName,
          body: relicBody,
          purpose: relicPurpose,
          collection:
            relicPurpose === "collection" ? collectionLabel : undefined,
          contentPolicy: CONTENT_POLICY_ID,
          imageBytes: onChainImage.bytes,
          contentHash: onChainImage.contentHash,
          width: onChainImage.width,
          height: onChainImage.height,
        })
      : createInlineMintPayload({
          netuid: selectedNetuid,
          subnetGeneration: currentGeneration,
          name: relicName,
          body: relicBody,
          purpose: relicPurpose,
          collection:
            relicPurpose === "collection" ? collectionLabel : undefined,
          contentPolicy: CONTENT_POLICY_ID,
        });
    const signerAccountHex = api.registry
      .createType("AccountId32", account.address)
      .toHex()
      .toLowerCase();
    const routeHotkeyHex = api.registry
      .createType("AccountId32", routeHotkey)
      .toHex()
      .toLowerCase();
    if (routeHotkeyHex === `0x${"0".repeat(64)}`)
      throw new Error("The subnet does not expose a registered owner hotkey.");
    const routeOwner = await apiAt.query.subtensorModule.owner(routeHotkey);
    const routeOwnerHex = api.registry
      .createType("AccountId32", routeOwner.toString())
      .toHex()
      .toLowerCase();
    if (routeOwnerHex === `0x${"0".repeat(64)}`)
      throw new Error("The subnet owner hotkey is not registered for staking.");
    const { blake2AsHex } = await import("@polkadot/util-crypto");
    const receiptExpectation: MintReceiptExpectation = {
      signerAccountHex,
      routeHotkeyHex,
      netuid: selectedNetuid,
      taoAmountRao: amountRao,
      remarkHash: blake2AsHex(payload.hex, 256).toLowerCase(),
    };
    const limitPrice = calculateLimitPrice(
      freshQuote.priceRao,
      DEFAULT_SLIPPAGE_BPS,
    );
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
      (
        accountInfo as unknown as { data: { free: { toString(): string } } }
      ).data.free.toString(),
    );
    const existentialDeposit = BigInt(
      api.consts.balances.existentialDeposit.toString(),
    );
    try {
      assertMintPreflight({
        reviewedGeneration: selectedSubnet.generation,
        currentGeneration,
        subtokenEnabled: subtokenEnabledResult.toString() === "true",
        poolTaoRao: freshQuote.taoAmount,
        minimumPoolTaoRao: minimumStakeRao,
        freeBalanceRao: available,
        spendRao: amountRao,
        estimatedFeeRao: estimatedFee,
        existentialDepositRao: existentialDeposit,
      });
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message === "POOL_INPUT_BELOW_MINIMUM_STAKE"
      ) {
        throw new Error(
          `The pool must receive at least ${formatToken(minimumStakeRao, 9)} TAO after its swap fee.`,
        );
      }
      if (cause instanceof Error && cause.message === "INSUFFICIENT_FREE_TAO") {
        throw new Error(
          "The test wallet does not have enough free TAO for the burn and network fee.",
        );
      }
      throw cause;
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
        imageBytes: onChainImage?.bytes.length ?? 0,
        purpose: relicPurpose,
        collection: relicPurpose === "collection" ? collectionLabel.trim() : "",
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
      setMintError(
        cause instanceof Error
          ? cause.message
          : "The transaction review could not be prepared.",
      );
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
      const baselineHash = await assembled.api.rpc.chain.getFinalizedHead();
      const baselineHeader =
        await assembled.api.rpc.chain.getHeader(baselineHash);
      await assembled.batch.signAsync(account.address, {
        signer: injector.signer,
      });
      const txHash = assembled.batch.hash.toHex().toLowerCase();
      const submittedHash = await assembled.api.rpc.author.submitExtrinsic(
        assembled.batch,
      );
      if (submittedHash.toHex().toLowerCase() !== txHash)
        throw new Error("The node returned a different transaction hash.");
      setTransactionHash(txHash);
      setMintState("submitted");

      const finalized = await waitForFinalizedExtrinsic(
        assembled.api,
        txHash,
        baselineHeader.number.toNumber(),
      );
      const receipt = verifyFinalizedMintReceipt({
        eventRecords: finalized.eventRecords,
        expected: assembled.receiptExpectation,
      });
      setMintEvidence(
        createMintEvidence({
          genesisHash: assembled.api.genesisHash.toHex(),
          runtimeSpec: finalized.finalizedRuntime.specVersion.toString(),
          blockNumber: finalized.blockNumber.toString(),
          blockHash: finalized.blockHash,
          extrinsicIndex: finalized.extrinsicIndex,
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
          finalizedAt: new Date(
            Number(finalized.blockTimestamp.toString()),
          ).toISOString(),
        }),
      );
      setMintState("finalized");
    } catch (cause) {
      setMintError(
        cause instanceof Error
          ? cause.message
          : "The wallet did not complete the testnet mint.",
      );
      setMintState("error");
    }
  }

  function downloadMintEvidence() {
    if (!mintEvidence) return;
    const blob = new Blob([`${JSON.stringify(mintEvidence, null, 2)}\n`], {
      type: "application/json",
    });
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
      <SiteNav
        status={
          dataState === "ready"
            ? `Bittensor Testnet · v${runtimeVersion}`
            : dataState === "error"
              ? "Chain read paused"
              : "Reading chain"
        }
        tone={dataState}
      />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A decentralized relic proof network</p>
          <h1>
            Forge permanence<span>from alpha.</span>
          </h1>
          <p className="intro">
            Forge a numbered relic from one finalized alpha burn today. The
            protocol is being engineered to become a Bittensor subnet where
            miners serve the index and validators independently prove every
            result.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#forge">
              Enter the Forge <span aria-hidden="true">-&gt;</span>
            </a>
            <a className="text-link" href="#protocol">
              How the proof works
            </a>
          </div>
          <dl className="hero-facts">
            <div>
              <dt>Execution</dt>
              <dd>Native SS58</dd>
            </div>
            <div>
              <dt>Settlement</dt>
              <dd>Finalized blocks</dd>
            </div>
            <div>
              <dt>Contracts</dt>
              <dd>No EVM</dd>
            </div>
          </dl>
        </div>

        <div
          className="relic-preview founding-receipt"
          aria-label="Founding Relic burn receipt"
        >
          <div className="relic-topline">
            <span>Founding Relic</span>
            <span>Finalized proof</span>
          </div>
          <div className="relic-orbit" aria-hidden="true">
            <Image
              className="relic-scarab founding-chain-image"
              src="/founding-relic.webp"
              alt="Shizzy Unchained, the image stored in the founding Relic transaction"
              fill
              sizes="(max-width: 640px) 255px, 285px"
              priority
            />
          </div>
          <div className="relic-number">
            <span>Shizzy</span>
            <strong>SN1 / #1</strong>
          </div>
          <div className="receipt-grid">
            <div>
              <span>TAO committed</span>
              <strong>1 test TAO</strong>
            </div>
            <div>
              <span>Alpha relinquished</span>
              <strong>1,035.580333 α</strong>
            </div>
          </div>
          <p>Finalized at block 7,698,721 · extrinsic 6.</p>
          <a
            className="receipt-proof-link"
            href="/evidence/founding-testnet-relic.json"
          >
            Verify the evidence <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section className="forge-section" id="forge">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The Forge</p>
            <h2>See exactly what the mint will burn.</h2>
          </div>
          <p>
            The Forge re-quotes at the current block, checks the subnet
            generation and balance, then shows every limit before the wallet can
            sign.
          </p>
        </div>
        <div className="forge-guide" aria-label="Before you forge">
          <div>
            <span>01</span>
            <strong>Connect TAOStats Wallet</strong>
            <p>Your wallet signs. The site never sees your private key.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Use test TAO</strong>
            <p>
              Live testnet TAO is available by request; never send mainnet
              funds.
            </p>
            <a
              href="https://docs.learnbittensor.org/evm-tutorials/subtensor-networks"
              target="_blank"
              rel="noreferrer"
            >
              Network details →
            </a>
          </div>
          <div>
            <span>03</span>
            <strong>Create the artifact</strong>
            <p>
              Your image is compressed locally, then its exact bytes enter the
              finalized transaction.
            </p>
          </div>
        </div>
        <div className="forge-layout">
          <div className="forge-card">
            <div className="step-label">
              <span>01</span>Select a subnet
            </div>
            <SubnetPicker
              subnets={subnets}
              selectedNetuid={selectedNetuid}
              onSelect={setSelectedNetuid}
              disabled={dataState !== "ready"}
            />
            {dataError && (
              <div className="chain-read-error" role="alert">
                <span>{dataError}</span>
                <button
                  type="button"
                  onClick={() => setDataRetry((value) => value + 1)}
                >
                  Retry chain read
                </button>
              </div>
            )}
            {dataState === "ready" && (
              <p
                className={`signer-readiness ${signerReady ? "ready" : "waiting"}`}
              >
                <i aria-hidden="true" />
                Finalized data loaded
                {signerReady
                  ? " · wallet signer ready"
                  : " · signer connects when you review"}
              </p>
            )}
            <div className="subnet-meta">
              <div>
                <span>Subnet generation</span>
                <strong>{selectedSubnet?.generation ?? "--"}</strong>
              </div>
              <div>
                <span>Canonical identity</span>
                <strong>
                  {selectedSubnet
                    ? `SN${selectedSubnet.netuid}:${selectedSubnet.generation}`
                    : "--"}
                </strong>
              </div>
            </div>

            <div className="step-label amount-step">
              <span>02</span>Choose a burn amount
            </div>
            <label className="field amount-field">
              <span>TAO permanently committed</span>
              <div>
                <input
                  inputMode="decimal"
                  value={taoAmount}
                  onChange={(event) => setTaoAmount(event.target.value)}
                  aria-describedby="amount-help"
                />
                <em>TAO</em>
              </div>
              <small id="amount-help">
                Testnet TAO only. Nothing is submitted yet.
              </small>
            </label>
            <div className="amount-options" aria-label="Preset test amounts">
              {["0.005", "0.05", "0.5"].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={taoAmount === amount ? "active" : ""}
                  onClick={() => setTaoAmount(amount)}
                >
                  {amount} TAO
                </button>
              ))}
            </div>

            <div className="step-label content-step">
              <span>03</span>Write the relic
            </div>
            <label className="field">
              <span>Name</span>
              <input
                maxLength={80}
                value={relicName}
                onChange={(event) => {
                  setRelicName(event.target.value);
                  setMintReview(null);
                  setMintState("idle");
                }}
                placeholder="A name that survives the moment"
              />
            </label>
            <label className="field">
              <span>Purpose</span>
              <select
                value={relicPurpose}
                onChange={(event) => {
                  const purpose = event.target.value as RelicPurpose;
                  setRelicPurpose(purpose);
                  if (purpose !== "collection") setCollectionLabel("");
                  setMintReview(null);
                  setMintState("idle");
                }}
              >
                <option value="personal">Personal artifact</option>
                <option value="collection">Collection entry</option>
                <option value="subnet_milestone">Subnet milestone</option>
                <option value="community_message">Community message</option>
              </select>
              <small>The purpose is signed into the Relic manifest.</small>
            </label>
            {relicPurpose === "collection" && (
              <label className="field">
                <span>Collection label</span>
                <input
                  maxLength={80}
                  value={collectionLabel}
                  onChange={(event) => {
                    setCollectionLabel(event.target.value);
                    setMintReview(null);
                    setMintState("idle");
                  }}
                  placeholder="Example: SCORE Origins"
                />
                <small>
                  Creator-declared in protocol v1. Verified collection
                  authorities and rule manifests are the next protocol stage.
                </small>
              </label>
            )}
            <div className="onchain-upload">
              <div className="upload-heading">
                <div>
                  <span>On-chain image</span>
                  <strong>Stored inside the finalized transaction</strong>
                </div>
                {onChainImage && (
                  <button type="button" onClick={removeImage}>
                    Remove
                  </button>
                )}
              </div>
              {onChainImage ? (
                <div className="upload-preview">
                  <Image
                    src={onChainImage.previewUrl}
                    alt="On-chain relic preview"
                    width={256}
                    height={256}
                    unoptimized
                  />
                  <div>
                    <strong>
                      {onChainImage.width} × {onChainImage.height} WebP
                    </strong>
                    <span>
                      {onChainImage.bytes.length.toLocaleString()} /{" "}
                      {MAX_ONCHAIN_IMAGE_BYTES.toLocaleString()} bytes
                    </span>
                    <small>
                      No IPFS. No external URL. These exact bytes will be
                      signed.
                    </small>
                  </div>
                </div>
              ) : (
                <label className="upload-drop">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      void chooseImage(event.target.files?.[0])
                    }
                    disabled={imageState === "processing"}
                  />
                  <span aria-hidden="true">+</span>
                  <strong>
                    {imageState === "processing"
                      ? "Compressing for chain..."
                      : "Choose a personal image"}
                  </strong>
                  <small>
                    PNG, JPG, or WebP · automatically cropped and compressed
                  </small>
                </label>
              )}
              {imageError && (
                <p className="error-message" role="alert">
                  {imageError}
                </p>
              )}
            </div>
            <label className="field inscription-field">
              <span>
                {onChainImage ? "Inscription (optional)" : "Inscription"}
              </span>
              <textarea
                maxLength={1024}
                value={relicBody}
                onChange={(event) => {
                  setRelicBody(event.target.value);
                  setMintReview(null);
                  setMintState("idle");
                }}
                placeholder="The text permanently bound to this alpha burn"
              />
              <small>{Array.from(relicBody).length}/1,024 characters</small>
            </label>
            <div className="step-label wallet-step">
              <span>04</span>Connect the signer
            </div>
            {account ? (
              <div className="connected-wallet">
                <div className="account-avatar" aria-hidden="true">
                  N
                </div>
                <div>
                  <strong>{account.name}</strong>
                  <span>{shortAddress(account.address)}</span>
                </div>
                <div className="account-balance">
                  <span>Test balance</span>
                  <strong>
                    {balance === null ? "--" : `${formatToken(balance, 4)} TAO`}
                  </strong>
                </div>
                <button type="button" onClick={disconnectWallet}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                className="wallet-button"
                type="button"
                onClick={connectWallet}
                disabled={walletState === "connecting"}
              >
                <span className="wallet-symbol" aria-hidden="true">
                  N
                </span>
                {walletState === "connecting"
                  ? "Opening TAOStats Wallet..."
                  : "Connect TAOStats Wallet"}
                <span aria-hidden="true">-&gt;</span>
              </button>
            )}
            {walletError && (
              <p className="error-message" role="alert">
                {walletError}
              </p>
            )}
          </div>

          <aside className="quote-card" aria-live="polite">
            <div className="quote-header">
              <div>
                <span>Live chain quote</span>
                <strong>{selectedSubnet?.name ?? "Select a subnet"}</strong>
              </div>
              <span className="read-only">Testnet</span>
            </div>
            <div className="burn-output">
              <span>Estimated alpha burned</span>
              <strong className={quoteLoading ? "loading" : ""}>
                {quote ? formatToken(quote.alphaAmount, 6) : "--"}
              </strong>
              <em>{selectedSubnet?.symbol ?? "alpha"}</em>
            </div>
            <dl className="quote-details">
              <div>
                <dt>Spot price</dt>
                <dd>{quote ? formatPrice(quote.priceRao) : "--"}</dd>
              </div>
              <div>
                <dt>Pool fee</dt>
                <dd>{quote ? `${formatToken(quote.taoFee, 7)} TAO` : "--"}</dd>
              </div>
              <div>
                <dt>Price impact</dt>
                <dd>{quote ? formatBps(quoteImpactBps(quote)) : "--"}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>Atomic batch</dd>
              </div>
            </dl>
            {quoteError && <p className="quote-error">{quoteError}</p>}
            <div className="burn-warning">
              <span aria-hidden="true">!</span>
              <p>
                The finished mint will permanently spend the TAO and burn the
                purchased alpha. It cannot be reversed.
              </p>
            </div>
            {mintReview && (
              <div className="transaction-review">
                <div>
                  <span>Network</span>
                  <strong>Testnet / {shortAddress(genesisHash)}</strong>
                </div>
                <div>
                  <span>Fresh at block</span>
                  <strong>#{mintReview.quoteBlock}</strong>
                </div>
                <div>
                  <span>Relic purpose</span>
                  <strong>
                    {mintReview.purpose.replaceAll("_", " ")}
                    {mintReview.collection ? ` / ${mintReview.collection}` : ""}
                  </strong>
                </div>
                <div>
                  <span>Registered burn hotkey</span>
                  <strong>{shortAddress(mintReview.routeHotkey)}</strong>
                </div>
                <div>
                  <span>Maximum ending spot price (2%)</span>
                  <strong>{formatPrice(mintReview.limitPrice)}</strong>
                </div>
                <div>
                  <span>Estimated chain fee</span>
                  <strong>{formatToken(mintReview.estimatedFee, 7)} TAO</strong>
                </div>
                <div>
                  <span>
                    {mintReview.imageBytes
                      ? "On-chain image"
                      : "Inscription payload"}
                  </span>
                  <strong>
                    {mintReview.payloadBytes.toLocaleString()} /{" "}
                    {(mintReview.imageBytes
                      ? MAX_MINT_REMARK_BYTES
                      : 2_048
                    ).toLocaleString()}{" "}
                    bytes
                  </strong>
                </div>
              </div>
            )}
            {mintError && (
              <p className="error-message" role="alert">
                {mintError}
              </p>
            )}
            {mintState !== "finalized" && (
              <label className="content-covenant forge-covenant">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(event) => {
                    setPolicyAccepted(event.target.checked);
                    setMintReview(null);
                    setMintState("idle");
                  }}
                />
                <span>
                  <strong>Confirm before forging</strong>
                  <em>Experimental protocol · use testnet TAO only</em>
                  <small>
                    <b>Relics content covenant:</b> I confirm this Relic contains
                    no sexual or exploitative content, graphic violence,
                    weapons-focused imagery, hate, or illegal material. The{" "}
                    <code>{CONTENT_POLICY_ID}</code> attestation is included in
                    the signed manifest. On-chain bytes cannot be removed.
                  </small>
                </span>
              </label>
            )}
            {mintState === "finalized" && mintEvidence ? (
              <div className="mint-success">
                <div className="mint-success-head">
                  <i aria-hidden="true">✓</i>
                  <div>
                    <strong>Relic finalized</strong>
                    <p>Recorded in finalized Bittensor testnet history.</p>
                  </div>
                </div>
                <div className="mint-success-id">
                  <small>Relic ID</small>
                  <code title={mintEvidence.artifactId}>
                    {shortAddress(mintEvidence.artifactId)}
                  </code>
                </div>
                <dl>
                  <div>
                    <dt>Finalized block</dt>
                    <dd>
                      #{mintEvidence.blockNumber} /{" "}
                      {mintEvidence.extrinsicIndex}
                    </dd>
                  </div>
                  <div>
                    <dt>Alpha burned</dt>
                    <dd>
                      {formatToken(BigInt(mintEvidence.alphaBurnedRao), 7)}{" "}
                      {selectedSubnet?.symbol}
                    </dd>
                  </div>
                  <div>
                    <dt>Actual chain fee</dt>
                    <dd>
                      {formatToken(BigInt(mintEvidence.transactionFeeRao), 7)}{" "}
                      TAO
                    </dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd>{shortAddress(mintEvidence.extrinsicHash)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={downloadMintEvidence}>
                  Download finalized proof
                </button>
              </div>
            ) : mintState === "review" ? (
              <button
                className="forge-button danger"
                type="button"
                onClick={signMint}
              >
                Forge this Relic <span>Irreversible testnet action</span>
              </button>
            ) : (
              <button
                className="forge-button"
                type="button"
                onClick={reviewMint}
                disabled={
                  !account ||
                  !quote ||
                  !policyAccepted ||
                  quoteLoading ||
                  mintState === "signing" ||
                  mintState === "submitted"
                }
              >
                {mintState === "signing"
                  ? "Confirm in TAOStats Wallet"
                  : mintState === "submitted"
                    ? "Waiting for finality"
                    : account
                      ? "Review Relic"
                      : "Connect wallet to continue"}
                <span>
                  {mintState === "submitted"
                    ? shortAddress(transactionHash)
                    : "No mainnet funds"}
                </span>
              </button>
            )}
          </aside>
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div className="section-heading protocol-heading">
          <div>
            <p className="eyebrow">One signature, three facts</p>
            <h2>The chain proves the sacrifice.</h2>
          </div>
          <p>
            Bittensor Relics never pretends metadata lives inside a fungible
            alpha token. The artifact is derived from public, reproducible chain
            evidence.
          </p>
        </div>
        <div className="protocol-steps">
          <article>
            <span>01 / Buy</span>
            <h3>TAO enters the selected pool.</h3>
            <p>
              The native runtime swaps the committed TAO for that subnet&apos;s
              alpha.
            </p>
          </article>
          <article>
            <span>02 / Burn</span>
            <h3>The acquired alpha is relinquished.</h3>
            <p>
              A finalized AlphaBurned event records the exact amount, subnet,
              and signer. The present runtime operation is supply-neutral.
            </p>
          </article>
          <article>
            <span>03 / Inscribe</span>
            <h3>The Relic is permanently identified.</h3>
            <p>
              The matching remark and burn share one atomic transaction and one
              canonical number.
            </p>
          </article>
        </div>
        <div className="protocol-call">
          <span>Native call path</span>
          <code>batchAll[ addStakeBurn, remarkWithEvent ]</code>
          <em>No EVM. No custody. Finalized testnet only.</em>
        </div>
        <div className="subnet-vision">
          <div>
            <span>Relics proof network</span>
            <h3>Proof-serving, not database trust.</h3>
            <p>
              Relics can work before its own subnet. The current research
              network demonstrates deterministic three-miner challenges where
              the dapp requires matching checkpoint proofs.
            </p>
            <p>
              <a className="text-link" href="/network">
                Open the proof network -&gt;
              </a>
            </p>
          </div>
          <ol>
            <li>
              <span>Miners</span>
              <strong>
                Index burns, images, numbering, transfers, and ownership.
              </strong>
            </li>
            <li>
              <span>Validators</span>
              <strong>
                Challenge random chain positions and score exact correctness.
              </strong>
            </li>
            <li>
              <span>Dapp</span>
              <strong>
                Accepts threshold agreement instead of trusting one server.
              </strong>
            </li>
          </ol>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-sigil" aria-hidden="true">
            <i />
          </span>
          <span>Bittensor Relics</span>
        </a>
        <p>Alpha burn artifacts on Subtensor. Testnet research build.</p>
        <a
          href="https://taostats.io/bittensor-chrome-wallet"
          target="_blank"
          rel="noreferrer"
        >
          TAOStats Wallet -&gt;
        </a>
      </footer>
    </main>
  );
}
