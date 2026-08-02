import { apiError, apiJson } from "@/lib/api-response";
import { indexerStatus } from "@/lib/indexer-db";

export async function GET() {
  try {
    const status = await indexerStatus();
    if (!status) {
      return apiJson(
        { error: { code: "INDEXER_NOT_READY", message: "No finalized checkpoint exists yet." } },
        { status: 503 },
      );
    }
    return apiJson({
      protocol: "bittensor-relics",
      version: 1,
      chainGenesis: process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105",
      activationBlock: status.activation_block,
      checkpoint: {
        blockNumber: status.block_number,
        blockHash: status.block_hash,
        updatedAt: status.updated_at.toISOString(),
      },
      artifactCount: status.artifact_count,
    });
  } catch (error) {
    return apiError(error);
  }
}
