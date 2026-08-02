import "server-only";
import pg from "pg";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export class IndexerUnavailableError extends Error {
  constructor(message = "The Neural Relics indexer is not configured.") {
    super(message);
    this.name = "IndexerUnavailableError";
  }
}

export type Artifact = {
  artifactId: string;
  blockNumber: string;
  blockHash: string;
  extrinsicIndex: number;
  extrinsicHash: string;
  globalNumber: string;
  subnetNumber: string;
  netuid: number;
  subnetGeneration: string;
  creatorAccountHex: string;
  ownerAccountHex: string;
  hotkeyAccountHex: string;
  name: string;
  mediaType: string;
  body: string | null;
  contentUri: string | null;
  contentHash: string | null;
  payloadHash: string;
  taoSpentRao: string;
  alphaBurnedRao: string;
  limitPriceRao: string;
  ownershipNonce: string;
};

type ArtifactRow = {
  artifact_id: string;
  block_number: string;
  block_hash: string;
  extrinsic_index: number;
  extrinsic_hash: string;
  global_number: string;
  subnet_number: string;
  netuid: number;
  subnet_generation: string;
  creator_account_hex: string;
  owner_account_hex: string;
  hotkey_account_hex: string;
  name: string;
  media_type: string;
  body: string | null;
  content_uri: string | null;
  content_hash: string | null;
  payload_hash: string;
  tao_spent_rao: string;
  alpha_burned_rao: string;
  limit_price_rao: string;
  ownership_nonce: string;
};

declare global {
  var neuralRelicsPool: pg.Pool | undefined;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new IndexerUnavailableError();
  return value;
}

function pool() {
  if (!globalThis.neuralRelicsPool) {
    const connectionString = databaseUrl();
    globalThis.neuralRelicsPool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 4_000,
      idleTimeoutMillis: 20_000,
    });
  }
  return globalThis.neuralRelicsPool;
}

function artifact(row: ArtifactRow): Artifact {
  return {
    artifactId: row.artifact_id,
    blockNumber: row.block_number,
    blockHash: row.block_hash,
    extrinsicIndex: row.extrinsic_index,
    extrinsicHash: row.extrinsic_hash,
    globalNumber: row.global_number,
    subnetNumber: row.subnet_number,
    netuid: row.netuid,
    subnetGeneration: row.subnet_generation,
    creatorAccountHex: row.creator_account_hex,
    ownerAccountHex: row.owner_account_hex,
    hotkeyAccountHex: row.hotkey_account_hex,
    name: row.name,
    mediaType: row.media_type,
    body: row.body,
    contentUri: row.content_uri,
    contentHash: row.content_hash,
    payloadHash: row.payload_hash,
    taoSpentRao: row.tao_spent_rao,
    alphaBurnedRao: row.alpha_burned_rao,
    limitPriceRao: row.limit_price_rao,
    ownershipNonce: row.ownership_nonce,
  };
}

export function pageLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
}

export function pageCursor(value: string | null) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed > 0n && parsed <= 9_223_372_036_854_775_807n ? parsed.toString() : null;
}

export async function indexerStatus() {
  const result = await pool().query<{
    block_number: string;
    block_hash: string;
    updated_at: Date;
    artifact_count: string;
  }>(
    `SELECT c.block_number, c.block_hash, c.updated_at,
      (SELECT COUNT(*) FROM artifacts a WHERE a.chain_genesis = c.chain_genesis) AS artifact_count
     FROM chain_checkpoints c
     WHERE c.chain_genesis = $1`,
    [process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105"],
  );
  return result.rows[0] ?? null;
}

type ListFilters = {
  limit: number;
  cursor: string | null;
  ownerAccountHex?: string;
  netuid?: number;
  subnetGeneration?: string;
};

export async function listArtifacts(filters: ListFilters) {
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  const add = (condition: string, value: string | number) => {
    values.push(value);
    conditions.push(condition.replace("?", `$${values.length}`));
  };
  if (filters.cursor) add("global_number < ?", filters.cursor);
  if (filters.ownerAccountHex) add("owner_account_hex = ?", filters.ownerAccountHex);
  if (filters.netuid !== undefined) add("netuid = ?", filters.netuid);
  if (filters.subnetGeneration) add("subnet_generation = ?", filters.subnetGeneration);
  values.push(filters.limit + 1);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool().query<ArtifactRow>(
    `SELECT artifact_id, block_number, block_hash, extrinsic_index, extrinsic_hash,
      global_number, subnet_number, netuid, subnet_generation,
      creator_account_hex, owner_account_hex, hotkey_account_hex,
      name, media_type, body, content_uri, content_hash, payload_hash,
      tao_spent_rao, alpha_burned_rao, limit_price_rao, ownership_nonce
     FROM artifacts ${where}
     ORDER BY global_number DESC
     LIMIT $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > filters.limit;
  const rows = result.rows.slice(0, filters.limit).map(artifact);
  return { artifacts: rows, nextCursor: hasMore ? rows.at(-1)?.globalNumber ?? null : null };
}

export async function getArtifact(artifactId: string) {
  const result = await pool().query<ArtifactRow>(
    `SELECT artifact_id, block_number, block_hash, extrinsic_index, extrinsic_hash,
      global_number, subnet_number, netuid, subnet_generation,
      creator_account_hex, owner_account_hex, hotkey_account_hex,
      name, media_type, body, content_uri, content_hash, payload_hash,
      tao_spent_rao, alpha_burned_rao, limit_price_rao, ownership_nonce
     FROM artifacts WHERE artifact_id = $1`,
    [artifactId],
  );
  return result.rows[0] ? artifact(result.rows[0]) : null;
}

export type RejectedOperation = {
  blockNumber: string;
  blockHash: string;
  extrinsicIndex: number;
  extrinsicHash: string;
  payloadHash: string | null;
  reasonCode: string;
  detail: string;
  indexerVersion: string;
};

export async function getRejection(blockNumber: string, extrinsicIndex: number) {
  const result = await pool().query<{
    block_number: string;
    block_hash: string;
    extrinsic_index: number;
    extrinsic_hash: string;
    payload_hash: string | null;
    reason_code: string;
    detail: string;
    indexer_version: string;
  }>(
    `SELECT block_number, block_hash, extrinsic_index, extrinsic_hash,
      payload_hash, reason_code, detail, indexer_version
     FROM rejected_operations
     WHERE chain_genesis = $1 AND block_number = $2 AND extrinsic_index = $3`,
    [
      process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105",
      blockNumber,
      extrinsicIndex,
    ],
  );
  const row = result.rows[0];
  return row
    ? {
        blockNumber: row.block_number,
        blockHash: row.block_hash,
        extrinsicIndex: row.extrinsic_index,
        extrinsicHash: row.extrinsic_hash,
        payloadHash: row.payload_hash,
        reasonCode: row.reason_code,
        detail: row.detail,
        indexerVersion: row.indexer_version,
      } satisfies RejectedOperation
    : null;
}

export async function getOperation(blockNumber: string, extrinsicIndex: number) {
  const artifactId = `nr1:${process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105"}:${blockNumber}:${extrinsicIndex}`;
  const [accepted, rejected] = await Promise.all([
    getArtifact(artifactId),
    getRejection(blockNumber, extrinsicIndex),
  ]);
  if (accepted) return { status: "accepted" as const, artifact: accepted };
  if (rejected) return { status: "rejected" as const, rejection: rejected };
  return null;
}

export type ArtifactTransfer = {
  transferId: string;
  blockNumber: string;
  blockHash: string;
  extrinsicIndex: number;
  extrinsicHash: string;
  fromAccountHex: string;
  toAccountHex: string;
  ownershipNonce: string;
  payloadHash: string;
};

export async function listArtifactTransfers(artifactId: string, limit = 100) {
  const result = await pool().query<{
    transfer_id: string;
    block_number: string;
    block_hash: string;
    extrinsic_index: number;
    extrinsic_hash: string;
    from_account_hex: string;
    to_account_hex: string;
    ownership_nonce: string;
    payload_hash: string;
  }>(
    `SELECT transfer_id, block_number, block_hash, extrinsic_index, extrinsic_hash,
      from_account_hex, to_account_hex, ownership_nonce, payload_hash
     FROM transfers WHERE artifact_id = $1
     ORDER BY ownership_nonce ASC LIMIT $2`,
    [artifactId, Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map((row) => ({
    transferId: row.transfer_id,
    blockNumber: row.block_number,
    blockHash: row.block_hash,
    extrinsicIndex: row.extrinsic_index,
    extrinsicHash: row.extrinsic_hash,
    fromAccountHex: row.from_account_hex,
    toAccountHex: row.to_account_hex,
    ownershipNonce: row.ownership_nonce,
    payloadHash: row.payload_hash,
  } satisfies ArtifactTransfer));
}
