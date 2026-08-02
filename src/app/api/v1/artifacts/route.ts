import { apiError, apiJson } from "@/lib/api-response";
import { listArtifacts, pageCursor, pageLimit } from "@/lib/indexer-db";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = await listArtifacts({
      limit: pageLimit(params.get("limit")),
      cursor: pageCursor(params.get("cursor")),
    });
    return apiJson(result);
  } catch (error) {
    return apiError(error);
  }
}
