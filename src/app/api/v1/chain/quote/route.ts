import { apiJson } from "@/lib/api-response";
import { readTestnetQuote } from "@/lib/chain-reader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const netuid = Number.parseInt(url.searchParams.get("netuid") ?? "", 10);
  const taoRao = url.searchParams.get("taoRao") ?? "";
  if (!Number.isSafeInteger(netuid) || netuid <= 0 || !/^\d{1,19}$/.test(taoRao) || BigInt(taoRao) === 0n) {
    return apiJson(
      { error: { code: "INVALID_QUOTE_REQUEST", message: "Choose a subnet and enter a valid TAO amount." } },
      { status: 400 },
    );
  }
  try {
    return apiJson(await readTestnetQuote(netuid, BigInt(taoRao)), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return apiJson(
      { error: { code: "CHAIN_QUOTE_UNAVAILABLE", message: "The finalized testnet quote is temporarily unavailable." } },
      { status: 503 },
    );
  }
}
