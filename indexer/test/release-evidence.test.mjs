import assert from "node:assert/strict";
import test from "node:test";
import { checkReleaseRecord, REQUIRED_RELEASE_EVIDENCE } from "../../scripts/release-evidence-lib.mjs";

const commitSha = "a".repeat(40);

function completeRecord() {
  return {
    schemaVersion: 1,
    product: "Bittensor Relics",
    network: "Bittensor testnet",
    release: {
      commitSha,
      pullRequestUrl: "https://github.com/shizzyunchained/taoscriptions/pull/3",
      previewUrl: "https://example.vercel.app",
      createdAt: "2026-08-02T12:00:00.000Z",
    },
    steps: Object.entries(REQUIRED_RELEASE_EVIDENCE).map(([id, keys]) => ({
      id: Number(id),
      status: "complete",
      evidence: keys.map((key) => ({ key, value: `evidence/${key}.json`, commitSha })),
    })),
  };
}

test("a complete exact-SHA release record passes", () => {
  assert.deepEqual(checkReleaseRecord(completeRecord()), {
    ready: true,
    completedSteps: 10,
    totalSteps: 10,
    errors: [],
  });
});

test("pending gates and mismatched evidence fail closed", () => {
  const record = completeRecord();
  record.steps[3] = { id: 4, status: "pending", evidence: [] };
  record.steps[4].evidence[0].commitSha = "b".repeat(40);
  const report = checkReleaseRecord(record);
  assert.equal(report.ready, false);
  assert.equal(report.completedSteps, 9);
  assert.ok(report.errors.includes("1 release step(s) remain pending."));
  assert.ok(report.errors.some((error) => error.includes("does not match the release SHA")));
});

test("a completed gate cannot omit its required evidence", () => {
  const record = completeRecord();
  record.steps[7].evidence = record.steps[7].evidence.filter(({ key }) => key !== "listing_invalidation");
  const report = checkReleaseRecord(record);
  assert.equal(report.ready, false);
  assert.ok(report.errors.includes("Step 8 is complete but missing listing_invalidation."));
});
