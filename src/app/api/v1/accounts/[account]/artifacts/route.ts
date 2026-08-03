import { u8aToHex } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";
import { apiError, apiJson } from "@/lib/api-response";
import { listArtifacts, pageCursor, pageLimit } from "@/lib/indexer-db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  try {
    const { account } = await params;
    let ownerAccountHex: string;
    try {
      ownerAccountHex = u8aToHex(decodeAddress(account));
    } catch {
      return apiJson({ error: { code: "INVALID_ACCOUNT", message: "The SS58 or AccountId32 value is invalid." } }, { status: 400 });
    }
    const search = new URL(request.url).searchParams;
    const result = await listArtifacts({
      ownerAccountHex,
      limit: pageLimit(search.get("limit")),
      cursor: pageCursor(search.get("cursor")),
    });
    return apiJson(
      { ownerAccountHex, ...result },
      search.get("fresh") === "1" ? { headers: { "cache-control": "no-store" } } : {},
    );
  } catch (error) {
    return apiError(error);
  }
}
