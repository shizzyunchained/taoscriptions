import { apiError, apiJson } from "@/lib/api-response";
import { cancelListingAuthorization, getListing, getListingStatus } from "@/lib/indexer-db";
import { marketplaceRequestError, verifiedCancellationRequest } from "@/lib/marketplace-request";

type Props = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Props) {
  try {
    const { id } = await params;
    const listing = await getListingStatus(id);
    if (!listing) return apiJson({ error: { code: "LISTING_NOT_FOUND", message: "The listing was not found." } }, { status: 404 });
    return apiJson({ listing, settlementEnabled: false });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const listing = await getListing(id);
    if (!listing) return apiJson({ error: { code: "LISTING_NOT_FOUND", message: "The listing was not found." } }, { status: 404 });
    const cancellation = await verifiedCancellationRequest(request, id, listing.seller_account_hex, listing.chain_genesis);
    return apiJson(await cancelListingAuthorization(id, cancellation.seller, cancellation.message, cancellation.signature), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const requestError = marketplaceRequestError(error);
    if (requestError) return apiJson({ error: { code: requestError.code, message: requestError.message } }, { status: requestError.status });
    return apiError(error);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "DELETE, OPTIONS", "access-control-allow-headers": "content-type" } });
}
