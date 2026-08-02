import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { newDb } from "pg-mem";
import { auditSnapshot, canonicalValue, compareSnapshots, digestRows } from "../src/audit.mjs";

const migration = await readFile(new URL("../sql/001_initial.sql", import.meta.url), "utf8");

test("audit digests are stable across object key order", () => {
  const left = [{ block: "10", evidence: { z: [2, 1], a: "proof" } }];
  const right = [{ evidence: { a: "proof", z: [2, 1] }, block: "10" }];
  assert.deepEqual(canonicalValue(left), canonicalValue(right));
  assert.equal(digestRows(left), digestRows(right));
  assert.notEqual(digestRows(left), digestRows([{ ...left[0], block: "11" }]));
});

test("snapshot comparison names every mismatched dataset", () => {
  const primary = { chainGenesis: `0x${"1".repeat(64)}`, datasets: { checkpoint: { count: 1, sha256: "a" }, blocks: { count: 2, sha256: "b" } } };
  const replay = { chainGenesis: primary.chainGenesis, datasets: { checkpoint: { count: 1, sha256: "a" }, blocks: { count: 1, sha256: "c" } } };
  assert.deepEqual(compareSnapshots(primary, replay), ["blocks"]);
});

test("audit snapshot covers every finalized-state dataset", async () => {
  const memory = newDb();
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  const chain = `0x${"2".repeat(64)}`;
  await pool.query(migration);
  await pool.query("INSERT INTO chain_checkpoints (chain_genesis, block_number, block_hash) VALUES ($1, 10, $2)", [chain, `0x${"3".repeat(64)}`]);
  await pool.query("INSERT INTO indexed_blocks (chain_genesis, block_number, block_hash, parent_hash, runtime_spec) VALUES ($1, 10, $2, $3, 440)", [chain, `0x${"3".repeat(64)}`, `0x${"4".repeat(64)}`]);
  const snapshot = await auditSnapshot(pool, chain);
  assert.deepEqual(Object.keys(snapshot.datasets), ["checkpoint", "blocks", "artifacts", "transfers", "rejections"]);
  assert.equal(snapshot.datasets.checkpoint.count, 1);
  assert.equal(snapshot.datasets.blocks.count, 1);
  assert.equal(snapshot.datasets.artifacts.count, 0);
  await pool.end();
});
