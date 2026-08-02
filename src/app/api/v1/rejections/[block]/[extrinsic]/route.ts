import { apiError, apiJson } from "@/lib/api-response";
import { parseChainPosition } from "@/lib/chain-position";
import { getRejection } from "@/lib/indexer-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ block: string; extrinsic: string }> },
) {
  try {
    const { block, extrinsic } = await params;
    const position = parseChainPosition(block, extrinsic);
    if (!position) {
      return apiJson({ error: { code: "INVALID_CHAIN_POSITION", message: "The block or extrinsic index is invalid." } }, { status: 400 });
    }
    const rejection = await getRejection(position.blockNumber, position.extrinsicIndex);
    return rejection
      ? apiJson({ rejection })
      : apiJson({ error: { code: "NOT_FOUND", message: "No rejected protocol operation exists at this position." } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
