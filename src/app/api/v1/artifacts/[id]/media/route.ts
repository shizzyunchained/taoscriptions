import { getArtifactMedia, IndexerUnavailableError } from "@/lib/indexer-db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!/^br1:0x[0-9a-f]{64}:\d+:\d+$/.test(id)) {
    return Response.json({ error: "INVALID_ARTIFACT_ID" }, { status: 400 });
  }
  try {
    const media = await getArtifactMedia(id);
    if (!media) return Response.json({ error: "ONCHAIN_MEDIA_NOT_FOUND" }, { status: 404 });
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "content-type": media.mediaType,
        "content-length": String(media.bytes.length),
        "cache-control": "public, max-age=31536000, immutable",
        "content-security-policy": "default-src 'none'; sandbox",
        "x-content-type-options": "nosniff",
        etag: `\"${media.contentHash}\"`,
      },
    });
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      return Response.json({ error: "INDEXER_UNAVAILABLE" }, { status: 503 });
    }
    throw error;
  }
}
