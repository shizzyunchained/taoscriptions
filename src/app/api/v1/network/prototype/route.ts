import { apiJson } from "@/lib/api-response";
import { buildPrototypeReport } from "@/lib/subnet-consensus.mjs";

export const runtime = "nodejs";

export function GET() {
  return apiJson(buildPrototypeReport(), {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
