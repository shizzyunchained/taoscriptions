import "server-only";
import pg from "pg";
import { ACTIVE_LISTING_STATE_SQL } from "@/lib/marketplace-state.mjs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export class IndexerUnavailableError extends Error {
  constructor(message = "The Bittensor Relics indexer is not configured.") {
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
  purpose: string;
  mediaType: string;
  body: string | null;
  contentUri: string | null;
  contentHash: string | null;
  mediaByteLength: number | null;
  payloadHash: string;
  taoSpentRao: string;
  alphaBurnedRao: string;
  limitPriceRao: string;
  transactionFeeRao: string | null;
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
  purpose: string | null;
  media_type: string;
  body: string | null;
  content_uri: string | null;
  content_hash: string | null;
  media_byte_length: number | null;
  payload_hash: string;
  tao_spent_rao: string;
  alpha_burned_rao: string;
  limit_price_rao: string;
  transaction_fee_rao: string | null;
  ownership_nonce: string;
};

declare global {
  var bittensorRelicsPool: pg.Pool | undefined;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new IndexerUnavailableError();
  return value;
}

function pool() {
  if (!globalThis.bittensorRelicsPool) {
    const connectionString = databaseUrl();
    globalThis.bittensorRelicsPool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 4_000,
      idleTimeoutMillis: 20_000,
    });
  }
  return globalThis.bittensorRelicsPool;
}

const configuredGenesis = () => process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";

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
    purpose: row.purpose ?? "personal",
    mediaType: row.media_type,
    body: row.body,
    contentUri: row.content_uri,
    contentHash: row.content_hash,
    mediaByteLength: row.media_byte_length,
    payloadHash: row.payload_hash,
    taoSpentRao: row.tao_spent_rao,
    alphaBurnedRao: row.alpha_burned_rao,
    limitPriceRao: row.limit_price_rao,
    transactionFeeRao: row.transaction_fee_rao,
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
    activation_block: string;
    checkpoint_version: number | null;
    state_root: string | null;
    transcript_hash: string | null;
  }>(
    `SELECT c.block_number, c.block_hash, c.updated_at, c.checkpoint_version,
      c.state_root, c.transcript_hash, p.activation_block,
      (SELECT COUNT(*) FROM artifacts a WHERE a.chain_genesis = c.chain_genesis) AS artifact_count
     FROM chain_checkpoints c
     JOIN protocol_config p ON p.chain_genesis = c.chain_genesis
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
      name, payload_json ->> 'purpose' AS purpose, media_type, body, content_uri, content_hash, media_byte_length, payload_hash,
      tao_spent_rao, alpha_burned_rao, limit_price_rao, transaction_fee_rao, ownership_nonce
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
      name, payload_json ->> 'purpose' AS purpose, media_type, body, content_uri, content_hash, media_byte_length, payload_hash,
      tao_spent_rao, alpha_burned_rao, limit_price_rao, transaction_fee_rao, ownership_nonce
     FROM artifacts WHERE artifact_id = $1`,
    [artifactId],
  );
  return result.rows[0] ? artifact(result.rows[0]) : null;
}

export async function getArtifactMedia(artifactId: string) {
  const result = await pool().query<{ media_type: string; media_bytes: Buffer; content_hash: string }>(
    `SELECT media_type, media_bytes, content_hash FROM artifacts
     WHERE artifact_id = $1 AND media_bytes IS NOT NULL`,
    [artifactId],
  );
  const row = result.rows[0];
  return row ? { mediaType: row.media_type, bytes: row.media_bytes, contentHash: row.content_hash } : null;
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
  const artifactId = `br1:${process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105"}:${blockNumber}:${extrinsicIndex}`;
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
  transactionFeeRao: string | null;
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
    transaction_fee_rao: string | null;
  }>(
    `SELECT transfer_id, block_number, block_hash, extrinsic_index, extrinsic_hash,
      from_account_hex, to_account_hex, ownership_nonce, payload_hash,
      transaction_fee_rao
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
    transactionFeeRao: row.transaction_fee_rao,
  } satisfies ArtifactTransfer));
}

export class MarketplaceStateError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "MarketplaceStateError";
  }
}

export type Listing = {
  listingId: string;
  artifactId: string;
  artifactName: string | null;
  mediaByteLength: number | null;
  sellerAccountHex: string;
  ownershipNonce: string;
  priceRao: string;
  expiryBlock: string;
  nonce: string;
  buyerAccountHex: string | null;
  message: string;
  signature: string;
  createdAt: string;
};

type ListingRow = {
  listing_id: string;
  artifact_id: string;
  artifact_name?: string | null;
  media_byte_length?: number | null;
  seller_account_hex: string;
  ownership_nonce: string;
  price_rao: string;
  expiry_block: string;
  nonce: string;
  buyer_account_hex: string | null;
  message_text: string;
  signature: string;
  created_at: Date;
};

function listing(row: ListingRow): Listing {
  return {
    listingId: row.listing_id,
    artifactId: row.artifact_id,
    artifactName: row.artifact_name ?? null,
    mediaByteLength: row.media_byte_length ?? null,
    sellerAccountHex: row.seller_account_hex,
    ownershipNonce: row.ownership_nonce,
    priceRao: row.price_rao,
    expiryBlock: row.expiry_block,
    nonce: row.nonce,
    buyerAccountHex: row.buyer_account_hex,
    message: row.message_text,
    signature: row.signature,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listActiveListings(artifactId: string | null, limit = DEFAULT_LIMIT) {
  const values: Array<string | number> = [configuredGenesis()];
  const artifactFilter = artifactId ? `AND l.artifact_id = $${values.push(artifactId)}` : "";
  values.push(Math.min(Math.max(limit, 1), MAX_LIMIT));
  const result = await pool().query<ListingRow>(
    `SELECT l.listing_id, l.artifact_id, a.name AS artifact_name,
      a.media_byte_length, l.seller_account_hex, l.ownership_nonce,
      l.price_rao, l.expiry_block, l.nonce, l.buyer_account_hex,
      l.message_text, l.signature, l.created_at
     FROM listings l
     JOIN artifacts a ON a.artifact_id = l.artifact_id
     JOIN chain_checkpoints c ON c.chain_genesis = l.chain_genesis
     WHERE l.chain_genesis = $1 AND ${ACTIVE_LISTING_STATE_SQL}
       ${artifactFilter}
     ORDER BY l.created_at DESC, l.listing_id DESC
     LIMIT $${values.length}`,
    values,
  );
  return result.rows.map(listing);
}

type NewListing = Omit<Listing, "createdAt" | "artifactName" | "mediaByteLength"> & { chainGenesis: string };

export async function createListingAuthorization(input: NewListing) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const state = await client.query<{
      owner_account_hex: string;
      ownership_nonce: string;
      block_number: string;
    }>(
      `SELECT a.owner_account_hex, a.ownership_nonce, c.block_number
       FROM artifacts a
       JOIN chain_checkpoints c ON c.chain_genesis = a.chain_genesis
       WHERE a.artifact_id = $1 AND a.chain_genesis = $2
       FOR UPDATE OF a`,
      [input.artifactId, input.chainGenesis],
    );
    if (!state.rowCount) throw new MarketplaceStateError("ARTIFACT_NOT_FOUND", "The relic is not in finalized indexed state.");
    const current = state.rows[0];
    if (current.owner_account_hex !== input.sellerAccountHex || current.ownership_nonce !== input.ownershipNonce) {
      throw new MarketplaceStateError("STALE_OWNERSHIP", "The signed seller or ownership version is no longer current.");
    }
    const expiry = BigInt(input.expiryBlock);
    const checkpoint = BigInt(current.block_number);
    if (expiry <= checkpoint) throw new MarketplaceStateError("LISTING_EXPIRED", "The listing expiry must be after the finalized checkpoint.");
    if (expiry > checkpoint + 1_000_000n) throw new MarketplaceStateError("EXPIRY_TOO_FAR", "The listing expiry is too far in the future.");
    const active = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM listings
       WHERE artifact_id = $1 AND ownership_nonce = $2
         AND cancelled_at IS NULL AND expiry_block > $3`,
      [input.artifactId, input.ownershipNonce, current.block_number],
    );
    if (Number(active.rows[0].count) >= 20) throw new MarketplaceStateError("LISTING_LIMIT", "This relic already has too many active listings.");
    await client.query(
      `INSERT INTO listings (
        listing_id, artifact_id, chain_genesis, seller_account_hex,
        ownership_nonce, price_rao, expiry_block, nonce, buyer_account_hex,
        message_text, signature
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (listing_id) DO NOTHING`,
      [input.listingId, input.artifactId, input.chainGenesis, input.sellerAccountHex,
        input.ownershipNonce, input.priceRao, input.expiryBlock, input.nonce,
        input.buyerAccountHex, input.message, input.signature],
    );
    const saved = await client.query<ListingRow>(
      `SELECT listing_id, artifact_id, seller_account_hex, ownership_nonce,
        price_rao, expiry_block, nonce, buyer_account_hex, message_text,
        signature, created_at FROM listings WHERE listing_id = $1`,
      [input.listingId],
    );
    await client.query("COMMIT");
    return listing(saved.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (databaseCode === "23505") throw new MarketplaceStateError("DUPLICATE_LISTING", "This signed listing nonce has already been used.");
    if (databaseCode === "40001") throw new MarketplaceStateError("STATE_CHANGED", "Finalized ownership changed while the listing was saved. Try again.");
    throw error;
  } finally {
    client.release();
  }
}

export async function getListing(listingId: string) {
  const result = await pool().query<ListingRow & { chain_genesis: string; cancelled_at: Date | null }>(
    `SELECT listing_id, artifact_id, chain_genesis, seller_account_hex,
      ownership_nonce, price_rao, expiry_block, nonce, buyer_account_hex,
      message_text, signature, created_at, cancelled_at
     FROM listings WHERE listing_id = $1`,
    [listingId],
  );
  return result.rows[0] ?? null;
}

export async function cancelListingAuthorization(listingId: string, seller: string, message: string, signature: string) {
  const result = await pool().query(
    `UPDATE listings SET cancellation_message = $1, cancellation_signature = $2,
      cancelled_at = COALESCE(cancelled_at, NOW())
     WHERE listing_id = $3 AND seller_account_hex = $4
     RETURNING listing_id`,
    [message, signature, listingId, seller],
  );
  if (!result.rowCount) throw new MarketplaceStateError("LISTING_NOT_FOUND", "The listing was not found for this seller.");
  return { listingId, cancelled: true };
}
