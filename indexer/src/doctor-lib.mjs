export const REQUIRED_TABLES = [
  "artifacts",
  "chain_checkpoints",
  "indexed_blocks",
  "listings",
  "rejected_operations",
  "transfers",
];

export const REQUIRED_ARTIFACT_COLUMNS = [
  "alpha_burned_rao",
  "artifact_id",
  "block_hash",
  "block_number",
  "chain_genesis",
  "evidence_json",
  "extrinsic_hash",
  "extrinsic_index",
  "limit_price_rao",
  "payload_hash",
  "tao_spent_rao",
  "transaction_fee_rao",
];

export const REQUIRED_TRANSFER_COLUMNS = [
  "artifact_id", "block_hash", "block_number", "chain_genesis", "evidence_json",
  "extrinsic_hash", "extrinsic_index", "from_account_hex", "ownership_nonce",
  "payload_hash", "to_account_hex", "transaction_fee_rao", "transfer_id",
];

function missing(required, actual) {
  const values = new Set(actual);
  return required.filter((value) => !values.has(value));
}

export function validateDoctorState(input) {
  const {
    expectedGenesis, actualGenesis, supportedSpec, actualSpec,
    startBlock, stopBlock, finalizedHead, checkpoint, tables, artifactColumns, transferColumns,
  } = input;
  if (actualGenesis !== expectedGenesis) throw new Error(`GENESIS_HASH_MISMATCH:${actualGenesis}`);
  if (actualSpec !== supportedSpec) throw new Error(`UNSUPPORTED_RUNTIME_SPEC:${actualSpec}`);
  if (!Number.isSafeInteger(finalizedHead) || finalizedHead < startBlock) {
    throw new Error(`START_BLOCK_NOT_FINALIZED:${startBlock}`);
  }
  if (stopBlock !== null && stopBlock > finalizedHead) {
    throw new Error(`STOP_BLOCK_NOT_FINALIZED:${stopBlock}`);
  }
  if (checkpoint !== null) {
    if (!Number.isSafeInteger(checkpoint) || checkpoint < startBlock - 1) {
      throw new Error(`CHECKPOINT_BEFORE_CONFIGURED_START:${checkpoint}`);
    }
    if (checkpoint > finalizedHead) throw new Error(`CHECKPOINT_AHEAD_OF_FINALITY:${checkpoint}`);
    if (stopBlock !== null && checkpoint > stopBlock) throw new Error(`CHECKPOINT_PAST_STOP_BLOCK:${checkpoint}`);
  }
  const missingTables = missing(REQUIRED_TABLES, tables);
  if (missingTables.length) throw new Error(`MISSING_SCHEMA_TABLES:${missingTables.join(",")}`);
  const missingColumns = missing(REQUIRED_ARTIFACT_COLUMNS, artifactColumns);
  if (missingColumns.length) throw new Error(`MISSING_ARTIFACT_COLUMNS:${missingColumns.join(",")}`);
  const missingTransferColumns = missing(REQUIRED_TRANSFER_COLUMNS, transferColumns);
  if (missingTransferColumns.length) throw new Error(`MISSING_TRANSFER_COLUMNS:${missingTransferColumns.join(",")}`);
  return {
    status: "ready",
    chainGenesis: actualGenesis,
    runtimeSpec: actualSpec,
    finalizedHead,
    startBlock,
    stopBlock,
    checkpoint,
    schema: {
      tables: REQUIRED_TABLES.length,
      artifactColumns: REQUIRED_ARTIFACT_COLUMNS.length,
      transferColumns: REQUIRED_TRANSFER_COLUMNS.length,
    },
  };
}
