import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const DATASETS = [
  ["checkpoint", `SELECT block_number, block_hash FROM chain_checkpoints WHERE chain_genesis = $1`],
  ["blocks", `SELECT block_number, block_hash, parent_hash, runtime_spec
    FROM indexed_blocks WHERE chain_genesis = $1 ORDER BY block_number ASC`],
  ["artifacts", `SELECT artifact_id, block_number, block_hash, extrinsic_index,
    extrinsic_hash, extrinsic_hex, global_number, subnet_number, netuid,
    subnet_generation, creator_account_hex, owner_account_hex, hotkey_account_hex,
    name, media_type, body, content_uri, content_hash, payload_json, payload_hex,
    payload_hash, tao_spent_rao, alpha_burned_rao, limit_price_rao,
    ownership_nonce, evidence_json
    FROM artifacts WHERE chain_genesis = $1
    ORDER BY block_number ASC, extrinsic_index ASC`],
  ["transfers", `SELECT transfer_id, artifact_id, block_number, block_hash,
    extrinsic_index, extrinsic_hash, extrinsic_hex, from_account_hex,
    to_account_hex, ownership_nonce, payload_json, payload_hex, payload_hash,
    evidence_json FROM transfers WHERE chain_genesis = $1
    ORDER BY block_number ASC, extrinsic_index ASC`],
  ["rejections", `SELECT block_number, block_hash, extrinsic_index,
    extrinsic_hash, payload_hash, reason_code, detail, indexer_version
    FROM rejected_operations WHERE chain_genesis = $1
    ORDER BY block_number ASC, extrinsic_index ASC`],
];

export function canonicalValue(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  throw new Error(`Unsupported audit value: ${typeof value}`);
}

export function digestRows(rows) {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(`${JSON.stringify(canonicalValue(row))}\n`, "utf8");
  return hash.digest("hex");
}

export async function auditSnapshot(client, chainGenesis) {
  if (!/^0x[0-9a-f]{64}$/.test(chainGenesis)) throw new Error("CHAIN_GENESIS_HASH must be a full lowercase hash.");
  const entries = await Promise.all(DATASETS.map(async ([name, sql]) => {
    const result = await client.query(sql, [chainGenesis]);
    return [name, { count: result.rowCount, sha256: digestRows(result.rows) }];
  }));
  const snapshot = Object.fromEntries(entries);
  if (snapshot.checkpoint.count !== 1) throw new Error("Each audit database must contain exactly one checkpoint for the configured chain.");
  return { chainGenesis, datasets: snapshot };
}

export function compareSnapshots(primary, replay) {
  const differences = [];
  if (primary.chainGenesis !== replay.chainGenesis) differences.push("chainGenesis");
  for (const name of DATASETS.map(([dataset]) => dataset)) {
    if (primary.datasets[name]?.count !== replay.datasets[name]?.count || primary.datasets[name]?.sha256 !== replay.datasets[name]?.sha256) differences.push(name);
  }
  return differences;
}
