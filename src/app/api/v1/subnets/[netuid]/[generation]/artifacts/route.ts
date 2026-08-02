import { apiError, apiJson } from "@/lib/api-response";
import { listArtifacts, pageCursor, pageLimit } from "@/lib/indexer-db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ netuid: string; generation: string }> },
) {
  try {
    const { netuid: rawNetuid, generation } = await params;
    const netuid = Number.parseInt(rawNetuid, 10);
    if (!/^\d+$/.test(rawNetuid) || netuid <= 0 || netuid > 65_535 || !/^\d+$/.test(generation)) {
      return apiJson({ error: { code: "INVALID_SUBNET", message: "The subnet generation is invalid." } }, { status: 400 });
    }
    const search = new URL(request.url).searchParams;
    const result = await listArtifacts({
      netuid,
      subnetGeneration: generation,
      limit: pageLimit(search.get("limit")),
      cursor: pageCursor(search.get("cursor")),
    });
    return apiJson({ netuid, subnetGeneration: generation, ...result });
  } catch (error) {
    return apiError(error);
  }
}
