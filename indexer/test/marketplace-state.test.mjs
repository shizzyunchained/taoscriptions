import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { newDb } from "pg-mem";
import { ACTIVE_LISTING_STATE_SQL } from "../../src/lib/marketplace-state.mjs";

const migration = await readFile(new URL("../sql/001_initial.sql", import.meta.url), "utf8");

test("transfer, expiry, and cancellation each invalidate marketplace discovery", async () => {
  const memory = newDb();
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  await pool.query(migration);
  const chain = `0x${"1".repeat(64)}`;
  const owner = `0x${"2".repeat(64)}`;
  const artifactId = `br1:${chain}:101:1`;
  await pool.query("INSERT INTO protocol_config (chain_genesis, activation_block) VALUES ($1, 100)", [chain]);
  await pool.query("INSERT INTO chain_checkpoints (chain_genesis, block_number, block_hash) VALUES ($1, 110, $2)", [chain, `0x${"3".repeat(64)}`]);
  await pool.query(
    `INSERT INTO artifacts (
      artifact_id, chain_genesis, block_number, block_hash, extrinsic_index,
      extrinsic_hash, extrinsic_hex, global_number, subnet_number, netuid,
      subnet_generation, creator_account_hex, owner_account_hex, hotkey_account_hex,
      name, media_type, body, payload_json, payload_hex, payload_hash,
      tao_spent_rao, alpha_burned_rao, limit_price_rao, transaction_fee_rao, evidence_json
    ) VALUES ($1,$2,101,$3,1,$4,'0x01',1,1,1,1,$5,$5,$6,'Relic','text/plain','proof',$7::jsonb,'0x02',$8,5000000,5000000,1000000,900000,$9::jsonb)`,
    [artifactId, chain, `0x${"4".repeat(64)}`, `0x${"5".repeat(64)}`, owner,
      `0x${"6".repeat(64)}`, JSON.stringify({ p: "bittensor-relics" }), `0x${"7".repeat(64)}`, JSON.stringify({ events: [] })],
  );
  await pool.query(
    `INSERT INTO listings (
      listing_id, artifact_id, chain_genesis, seller_account_hex, ownership_nonce,
      price_rao, expiry_block, nonce, message_text, signature
    ) VALUES ($1,$2,$3,$4,0,1000000,120,$5,'message','0xsignature')`,
    [`0x${"8".repeat(64)}`, artifactId, chain, owner, "a".repeat(64)],
  );
  const active = () => pool.query(
    `SELECT l.listing_id FROM listings l
     JOIN artifacts a ON a.artifact_id = l.artifact_id
     JOIN chain_checkpoints c ON c.chain_genesis = l.chain_genesis
     WHERE l.chain_genesis = $1 AND ${ACTIVE_LISTING_STATE_SQL}`,
    [chain],
  );
  assert.equal((await active()).rowCount, 1);
  await pool.query("UPDATE artifacts SET owner_account_hex = $1, ownership_nonce = 1 WHERE artifact_id = $2", [`0x${"9".repeat(64)}`, artifactId]);
  assert.equal((await active()).rowCount, 0);
  await pool.query("UPDATE artifacts SET owner_account_hex = $1, ownership_nonce = 0 WHERE artifact_id = $2", [owner, artifactId]);
  await pool.query("UPDATE chain_checkpoints SET block_number = 120 WHERE chain_genesis = $1", [chain]);
  assert.equal((await active()).rowCount, 0);
  await pool.query("UPDATE chain_checkpoints SET block_number = 110 WHERE chain_genesis = $1", [chain]);
  await pool.query("UPDATE listings SET cancelled_at = NOW() WHERE artifact_id = $1", [artifactId]);
  assert.equal((await active()).rowCount, 0);
  await pool.end();
});
