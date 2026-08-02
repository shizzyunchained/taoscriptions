import { apiError, apiJson } from "@/lib/api-response";
import { getArtifact, listArtifactTransfers } from "@/lib/indexer-db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^nr1:0x[0-9a-f]{64}:\d+:\d+$/.test(id)) {
      return apiJson({ error: { code: "INVALID_ARTIFACT_ID", message: "The artifact ID is invalid." } }, { status: 400 });
    }
    const [artifact, transfers] = await Promise.all([getArtifact(id), listArtifactTransfers(id)]);
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    return artifact
      ? apiJson({ artifact, transfers }, fresh ? { headers: { "cache-control": "no-store" } } : {})
      : apiJson({ error: { code: "NOT_FOUND", message: "No finalized artifact has this ID." } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
