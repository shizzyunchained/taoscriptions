import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const blueprint = await readFile(new URL("../../render.yaml", import.meta.url), "utf8");

test("Render blueprint keeps primary and replay workers gated identically", () => {
  assert.match(blueprint, /name: neural-relics-indexer\r?\n/);
  assert.match(blueprint, /name: neural-relics-indexer-replay\r?\n/);
  assert.equal((blueprint.match(/autoDeployTrigger: "off"/g) ?? []).length, 2);
  assert.equal((blueprint.match(/preDeployCommand: npm run indexer:migrate && npm run indexer:doctor/g) ?? []).length, 2);
  assert.equal((blueprint.match(/- key: DATABASE_URL/g) ?? []).length, 2);
  assert.equal((blueprint.match(/- key: START_BLOCK/g) ?? []).length, 2);
  assert.equal((blueprint.match(/- key: STOP_BLOCK/g) ?? []).length, 2);
});
