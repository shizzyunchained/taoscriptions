import { apiError, apiJson } from "@/lib/api-response";
import { createListingAuthorization, listActiveListings, pageLimit } from "@/lib/indexer-db";
import { marketplaceRequestError, verifiedListingRequest } from "@/lib/marketplace-request";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const artifact = params.get("artifact");
    if (artifact && !/^nr1:0x[0-9a-f]{64}:\d+:\d+$/.test(artifact)) {
      return apiJson({ error: { code: "INVALID_ARTIFACT", message: "The artifact filter is invalid." } }, { status: 400 });
    }
    return apiJson({ listings: await listActiveListings(artifact, pageLimit(params.get("limit"))), settlementEnabled: false });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const verified = await verifiedListingRequest(request);
    const saved = await createListingAuthorization(verified);
    return apiJson({ listing: saved, settlementEnabled: false }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const requestError = marketplaceRequestError(error);
    if (requestError) return apiJson({ error: { code: requestError.code, message: requestError.message } }, { status: requestError.status });
    return apiError(error);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } });
}
