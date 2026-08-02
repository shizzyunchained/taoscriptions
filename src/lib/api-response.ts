import { IndexerUnavailableError } from "./indexer-db";

export function apiJson(data: unknown, init: ResponseInit = {}) {
  const cacheControl = (init.status ?? 200) >= 400
    ? "no-store"
    : "public, s-maxage=10, stale-while-revalidate=30";
  return Response.json(data, {
    ...init,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": cacheControl,
      ...init.headers,
    },
  });
}

export function apiError(error: unknown) {
  if (error instanceof IndexerUnavailableError) {
    return apiJson({ error: { code: "INDEXER_UNAVAILABLE", message: error.message } }, { status: 503 });
  }
  console.error(error);
  return apiJson(
    { error: { code: "INTERNAL_ERROR", message: "The indexed state could not be read." } },
    { status: 500 },
  );
}
