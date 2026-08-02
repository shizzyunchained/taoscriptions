import { ApiPromise, HttpProvider } from "@polkadot/api";
import { assertExpectedGenesis } from "./chain-guard";

const TESTNET_HTTP_RPC = process.env.SUBTENSOR_HTTP_RPC ?? "https://test.chain.opentensor.ai";
const TESTNET_GENESIS = process.env.CHAIN_GENESIS_HASH
  ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";

export type ChainSubnet = {
  netuid: number;
  generation: string;
  name: string;
  symbol: string;
  ownerHotkey: string;
};

function decodeHexText(hex: string) {
  if (!hex.startsWith("0x") || hex.length <= 2) return "";
  const bytes = Buffer.from(hex.slice(2), "hex");
  return bytes.toString("utf8").replace(/\0/g, "").trim();
}

export async function withTestnetApi<T>(read: (api: ApiPromise) => Promise<T>) {
  const api = await ApiPromise.create({
    provider: new HttpProvider(TESTNET_HTTP_RPC),
    noInitWarn: true,
  });
  try {
    assertExpectedGenesis(api.genesisHash.toHex(), TESTNET_GENESIS);
    return await read(api);
  } finally {
    await api.disconnect();
  }
}

export async function readTestnetSubnets() {
  return withTestnetApi(async (api) => {
    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    const [apiAt, header] = await Promise.all([
      api.at(finalizedHash),
      api.rpc.chain.getHeader(finalizedHash),
    ]);
    const entries = await apiAt.query.subtensorModule.networksAdded.entries();
    const netuids = entries
      .filter(([, enabled]) => enabled.toString() === "true")
      .map(([key]) => Number.parseInt(key.args[0].toString(), 10))
      .filter((netuid) => Number.isSafeInteger(netuid) && netuid > 0)
      .sort((left, right) => left - right);
    const [identities, symbols, generations, ownerHotkeys] = await Promise.all([
      apiAt.query.subtensorModule.subnetIdentitiesV3.multi(netuids),
      apiAt.query.subtensorModule.tokenSymbol.multi(netuids),
      apiAt.query.subtensorModule.networkRegisteredAt.multi(netuids),
      apiAt.query.subtensorModule.subnetOwnerHotkey.multi(netuids),
    ]);
    const subnets: ChainSubnet[] = netuids.map((netuid, index) => {
      const identity = identities[index].toHuman() as { subnetName?: string } | null;
      return {
        netuid,
        generation: generations[index].toString(),
        name: identity?.subnetName || `Subnet ${netuid}`,
        symbol: decodeHexText(symbols[index].toHex()) || `alpha-${netuid}`,
        ownerHotkey: ownerHotkeys[index].toString(),
      };
    });
    return {
      network: "testnet" as const,
      genesisHash: api.genesisHash.toHex(),
      runtimeVersion: api.runtimeVersion.specVersion.toString(),
      finalizedBlock: header.number.toString(),
      finalizedHash: finalizedHash.toHex(),
      subnets,
    };
  });
}

export async function readTestnetQuote(netuid: number, taoAmountRao: bigint) {
  return withTestnetApi(async (api) => {
    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    const [apiAt, header] = await Promise.all([
      api.at(finalizedHash),
      api.rpc.chain.getHeader(finalizedHash),
    ]);
    const [priceResult, quoteResult] = await Promise.all([
      apiAt.call.swapRuntimeApi.currentAlphaPrice(netuid),
      apiAt.call.swapRuntimeApi.simSwapTaoForAlpha(netuid, taoAmountRao.toString()),
    ]);
    const quote = quoteResult as unknown as {
      alphaAmount: { toString(): string };
      alphaSlippage: { toString(): string };
      taoAmount: { toString(): string };
      taoFee: { toString(): string };
    };
    if (BigInt(quote.alphaAmount.toString()) === 0n) {
      throw new Error("This amount cannot be quoted on the selected subnet.");
    }
    return {
      blockNumber: header.number.toString(),
      blockHash: finalizedHash.toHex(),
      alphaAmountRao: quote.alphaAmount.toString(),
      alphaSlippageRao: quote.alphaSlippage.toString(),
      priceRao: priceResult.toString(),
      taoAmountRao: quote.taoAmount.toString(),
      taoFeeRao: quote.taoFee.toString(),
    };
  });
}
