import { apiJson } from "@/lib/api-response";
import { readTestnetSubnets } from "@/lib/chain-reader";

export const runtime = "nodejs";

export async function GET() {
  try {
    return apiJson(await readTestnetSubnets(), {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error(error);
    return apiJson(
      { error: { code: "CHAIN_READ_UNAVAILABLE", message: "Finalized Bittensor testnet data is temporarily unavailable." } },
      { status: 503 },
    );
  }
}
