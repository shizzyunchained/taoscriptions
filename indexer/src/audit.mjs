import { digestRows } from "../../src/lib/subnet-consensus.mjs";

export { canonicalValue, digestRows } from "../../src/lib/subnet-consensus.mjs";

const DATASETS = [
  ["protocolConfig", `SELECT activation_block FROM protocol_config WHERE chain_genesis = $1`],
  ["checkpoint", `SELECT block_number, block_hash FROM chain_checkpoints WHERE chain_genesis = $1`],
  ["blocks", `SELECT block_number, block_hash, parent_hash, runtime_spec
    FROM indexed_blocks WHERE chain_genesis = $1 ORDER BY block_number ASC`],
  ["artifacts", `SELECT artifact_id, block_number, block_hash, extrinsic_index,
    extrinsic_hash, extrinsic_hex, global_number, subnet_number, netuid,
    subnet_generation, creator_account_hex, owner_account_hex, hotkey_account_hex,
    name, media_type, body, content_uri, content_hash, payload_json, payload_hex,
    payload_hash, tao_spent_rao, alpha_burned_rao, limit_price_rao,
    transaction_fee_rao,
    ownership_nonce, evidence_json
    FROM artifacts WHERE chain_genesis = $1
    ORDER BY block_number ASC, extrinsic_index ASC`],
  ["transfers", `SELECT transfer_id, artifact_id, block_number, block_hash,
    extrinsic_index, extrinsic_hash, extrinsic_hex, from_account_hex,
    to_account_hex, ownership_nonce, payload_json, payload_hex, payload_hash,
    transaction_fee_rao,
    evidence_json FROM transfers WHERE chain_genesis = $1
    ORDER BY block_number ASC, extrinsic_index ASC`],
  ["rejections", `SELECT block_number, block_hash, extrinsic_index,
    extrinsic_hash, payload_hash, reason_code, detail, indexer_version
    FROM rejected_operations WHERE chain_genesis = $1
    ORDER BY block_number ASC, extrinsic_index ASC`],
];

export async function auditSnapshot(client, chainGenesis) {
  if (!/^0x[0-9a-f]{64}$/.test(chainGenesis)) throw new Error("CHAIN_GENESIS_HASH must be a full lowercase hash.");
  const entries = await Promise.all(DATASETS.map(async ([name, sql]) => {
    const result = await client.query(sql, [chainGenesis]);
    return [name, { count: result.rowCount, sha256: digestRows(result.rows) }];
  }));
  const snapshot = Object.fromEntries(entries);
  if (snapshot.protocolConfig.count !== 1) throw new Error("Each audit database must contain exactly one protocol activation for the configured chain.");
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
