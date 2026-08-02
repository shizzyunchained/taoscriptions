import assert from "node:assert/strict";
import test from "node:test";
import {
  INDEX_DATASETS,
  buildPrototypeReport,
  createCheckpointCommitment,
  createMinerResponse,
  createValidatorChallenge,
  digestRows,
  reachThresholdConsensus,
  scoreMinerResponse,
} from "../../src/lib/subnet-consensus.mjs";

const chainGenesis = `0x${"1".repeat(64)}`;
const blockHash = `0x${"2".repeat(64)}`;
const datasets = Object.fromEntries(INDEX_DATASETS.map((name) => [name, { count: 1, sha256: digestRows([{ name }]) }]));

function fixture() {
  const checkpoint = createCheckpointCommitment({ chainGenesis, datasets }, { blockNumber: "42", blockHash });
  const challenge = createValidatorChallenge(checkpoint, { dataset: "artifacts", nonce: "0123456789abcdef0123456789abcdef" });
  return { checkpoint, challenge };
}

test("checkpoint commitments are canonical and bind every dataset", () => {
  const left = createCheckpointCommitment({ chainGenesis, datasets }, { blockNumber: 42, blockHash });
  const reversed = Object.fromEntries(Object.entries(datasets).reverse());
  const right = createCheckpointCommitment({ datasets: reversed, chainGenesis }, { blockHash, blockNumber: "42" });
  assert.equal(left.stateRoot, right.stateRoot);
  const changed = structuredClone(datasets);
  changed.artifacts.count = 2;
  assert.notEqual(left.stateRoot, createCheckpointCommitment({ chainGenesis, datasets: changed }, { blockNumber: 42, blockHash }).stateRoot);
});

test("validator challenges bind a checkpoint, dataset, and nonce", () => {
  const { checkpoint } = fixture();
  const one = createValidatorChallenge(checkpoint, { dataset: "artifacts", nonce: "0123456789abcdef0123456789abcdef" });
  const two = createValidatorChallenge(checkpoint, { dataset: "blocks", nonce: "0123456789abcdef0123456789abcdef" });
  assert.notEqual(one.challengeId, two.challengeId);
});

test("validator scoring rejects a divergent miner", () => {
  const { checkpoint, challenge } = fixture();
  const honest = createMinerResponse({ minerId: "honest", checkpoint, challenge, latencyMs: 100 });
  const divergent = createMinerResponse({ minerId: "divergent", checkpoint, challenge, latencyMs: 20, datasetOverride: { count: 99 } });
  assert.equal(scoreMinerResponse(checkpoint, challenge, honest).valid, true);
  assert.equal(scoreMinerResponse(checkpoint, challenge, honest).scoreBps, 9900);
  assert.deepEqual(scoreMinerResponse(checkpoint, challenge, divergent), { valid: false, scoreBps: 0, failures: ["dataset"] });
});

test("two matching miners establish consensus while a divergent miner cannot", () => {
  const { checkpoint, challenge } = fixture();
  const responses = [
    createMinerResponse({ minerId: "one", checkpoint, challenge, latencyMs: 100 }),
    createMinerResponse({ minerId: "two", checkpoint, challenge, latencyMs: 120 }),
    createMinerResponse({ minerId: "three", checkpoint, challenge, latencyMs: 80, datasetOverride: { count: 99 } }),
  ];
  const result = reachThresholdConsensus(responses);
  assert.equal(result.status, "consensus");
  assert.deepEqual(result.agreedMiners, ["one", "two"]);
  assert.deepEqual(result.dissentingMiners, ["three"]);
});

test("split answers fail closed and duplicate miner identities are rejected", () => {
  const { checkpoint, challenge } = fixture();
  const responses = [0, 1, 2].map((count) => createMinerResponse({ minerId: `miner-${count}`, checkpoint, challenge, latencyMs: 100, datasetOverride: { count } }));
  assert.equal(reachThresholdConsensus(responses).status, "no-consensus");
  assert.throws(() => reachThresholdConsensus([responses[0], responses[0]]), /Duplicate miner response/);
});

test("the published three-miner simulation reaches 2-of-3 consensus", () => {
  const report = buildPrototypeReport();
  assert.equal(report.phase, "simulation");
  assert.equal(report.chainWrites, false);
  assert.equal(report.consensus.status, "consensus");
  assert.equal(report.consensus.agreedMiners.length, 2);
  assert.equal(report.scores.find((score) => score.minerId === "obelisk").scoreBps, 0);
});
