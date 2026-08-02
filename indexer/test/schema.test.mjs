import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { newDb } from "pg-mem";

const migration = await readFile(new URL("../sql/001_initial.sql", import.meta.url), "utf8");

test("migration creates the finalized-state schema", async () => {
  const memory = newDb();
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  await pool.query(migration);
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  assert.deepEqual(
    tables.rows.map((row) => row.table_name),
    ["artifacts", "chain_checkpoints", "indexed_blocks", "rejected_operations", "transfers"],
  );
  await pool.end();
});

test("artifact numbering and chain positions are unique", async () => {
  const memory = newDb();
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  await pool.query(migration);
  const genesis = `0x${"1".repeat(64)}`;
  const values = [
    `nr1:${genesis}:10:2`, genesis, "10", `0x${"2".repeat(64)}`, 2,
    `0x${"3".repeat(64)}`, "0x0102", "1", "1", 1, "5",
    `0x${"4".repeat(64)}`, `0x${"5".repeat(64)}`, "Test", "text/plain;charset=utf-8",
    "hello", null, null, JSON.stringify({ p: "neural-relics" }), "0x7b7d",
    `0x${"6".repeat(64)}`, "5000000", "5200000000", "1000000", JSON.stringify({ events: [] }),
  ];
  const insert = `INSERT INTO artifacts (
    artifact_id, chain_genesis, block_number, block_hash, extrinsic_index,
    extrinsic_hash, extrinsic_hex, global_number, subnet_number, netuid,
    subnet_generation, creator_account_hex, owner_account_hex, hotkey_account_hex,
    name, media_type, body, content_uri, content_hash, payload_json, payload_hex,
    payload_hash, tao_spent_rao, alpha_burned_rao, limit_price_rao, evidence_json
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,
    $19::jsonb,$20,$21,$22,$23,$24,$25::jsonb
  )`;
  await pool.query(insert, values);
  const duplicate = [...values];
  duplicate[0] = `nr1:${genesis}:11:1`;
  duplicate[2] = "11";
  duplicate[4] = 1;
  await assert.rejects(pool.query(insert, duplicate), /unique/i);

  const transferValues = [
    `nrt1:${genesis}:12:1`, values[0], genesis, "12", `0x${"7".repeat(64)}`, 1,
    `0x${"8".repeat(64)}`, "0x0304", values[11], `0x${"9".repeat(64)}`, "1",
    JSON.stringify({ p: "neural-relics", v: 1, op: "transfer" }), "0x7b7d",
    `0x${"a".repeat(64)}`, JSON.stringify({ events: [] }),
  ];
  const transferInsert = `INSERT INTO transfers (
    transfer_id, artifact_id, chain_genesis, block_number, block_hash,
    extrinsic_index, extrinsic_hash, extrinsic_hex, from_account_hex,
    to_account_hex, ownership_nonce, payload_json, payload_hex, payload_hash,
    evidence_json
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15::jsonb)`;
  await pool.query(transferInsert, transferValues);
  const duplicateNonce = [...transferValues];
  duplicateNonce[0] = `nrt1:${genesis}:13:1`;
  duplicateNonce[3] = "13";
  await assert.rejects(pool.query(transferInsert, duplicateNonce), /unique/i);
  await pool.end();
});
