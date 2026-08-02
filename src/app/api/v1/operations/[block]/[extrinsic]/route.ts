import { apiError, apiJson } from "@/lib/api-response";
import { parseChainPosition } from "@/lib/chain-position";
import { getOperation } from "@/lib/indexer-db";

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
    const operation = await getOperation(position.blockNumber, position.extrinsicIndex);
    return operation
      ? apiJson({ operation })
      : apiJson({ error: { code: "NOT_FOUND", message: "No protocol operation exists at this finalized position." } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
