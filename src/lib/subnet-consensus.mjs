import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const INDEX_DATASETS = Object.freeze([
  "protocolConfig",
  "checkpoint",
  "blocks",
  "artifacts",
  "transfers",
  "rejections",
]);

const PROTOCOL = "bittensor-relics";
const VERSION = 1;
const CHECKPOINT_DOMAIN = "BITTENSOR_RELICS_CHECKPOINT_V1\n";
const CHALLENGE_DOMAIN = "BITTENSOR_RELICS_CHALLENGE_V1\n";
const HASH = /^[0-9a-f]{64}$/;
const CHAIN_HASH = /^0x[0-9a-f]{64}$/;

export function canonicalValue(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  throw new Error(`Unsupported canonical value: ${typeof value}`);
}

function sha256(domain, value) {
  return createHash("sha256")
    .update(domain, "utf8")
    .update(JSON.stringify(canonicalValue(value)), "utf8")
    .digest("hex");
}

export function digestRows(rows) {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(`${JSON.stringify(canonicalValue(row))}\n`, "utf8");
  return hash.digest("hex");
}

function validateDatasets(datasets) {
  if (!datasets || typeof datasets !== "object") throw new Error("Checkpoint datasets are required.");
  const names = Object.keys(datasets).sort();
  if (names.join(",") !== [...INDEX_DATASETS].sort().join(",")) throw new Error("Checkpoint must commit every canonical dataset.");
  for (const name of INDEX_DATASETS) {
    const dataset = datasets[name];
    if (!Number.isSafeInteger(dataset?.count) || dataset.count < 0 || !HASH.test(dataset?.sha256 ?? "")) {
      throw new Error(`Invalid ${name} dataset commitment.`);
    }
  }
}

export function createCheckpointCommitment(snapshot, position) {
  if (!CHAIN_HASH.test(snapshot?.chainGenesis ?? "")) throw new Error("A full lowercase chain genesis hash is required.");
  if (!/^(0|[1-9][0-9]*)$/.test(String(position?.blockNumber ?? ""))) throw new Error("A canonical block number is required.");
  if (!CHAIN_HASH.test(position?.blockHash ?? "")) throw new Error("A full lowercase block hash is required.");
  validateDatasets(snapshot.datasets);
  const body = {
    protocol: PROTOCOL,
    version: VERSION,
    chainGenesis: snapshot.chainGenesis,
    blockNumber: String(position.blockNumber),
    blockHash: position.blockHash,
    datasets: canonicalValue(snapshot.datasets),
  };
  return { ...body, stateRoot: `sha256:${sha256(CHECKPOINT_DOMAIN, body)}` };
}

export function createValidatorChallenge(checkpoint, { dataset, nonce }) {
  if (!INDEX_DATASETS.includes(dataset)) throw new Error("Challenge dataset is not canonical.");
  if (!/^[0-9a-f]{32,128}$/.test(nonce ?? "")) throw new Error("Challenge nonce must be lowercase hexadecimal.");
  const body = {
    protocol: PROTOCOL,
    version: VERSION,
    chainGenesis: checkpoint.chainGenesis,
    blockNumber: checkpoint.blockNumber,
    blockHash: checkpoint.blockHash,
    stateRoot: checkpoint.stateRoot,
    dataset,
    nonce,
  };
  return { ...body, challengeId: `sha256:${sha256(CHALLENGE_DOMAIN, body)}` };
}

export function createMinerResponse({ minerId, checkpoint, challenge, latencyMs, datasetOverride }) {
  if (!/^[a-z0-9-]{1,32}$/.test(minerId ?? "")) throw new Error("Miner ID must be a stable lowercase label.");
  if (!Number.isSafeInteger(latencyMs) || latencyMs < 0) throw new Error("Latency must be a non-negative integer.");
  const committed = checkpoint.datasets[challenge.dataset];
  return {
    minerId,
    challengeId: challenge.challengeId,
    latencyMs,
    answer: {
      chainGenesis: checkpoint.chainGenesis,
      blockNumber: checkpoint.blockNumber,
      blockHash: checkpoint.blockHash,
      stateRoot: checkpoint.stateRoot,
      dataset: challenge.dataset,
      rowCount: datasetOverride?.count ?? committed.count,
      datasetHash: datasetOverride?.sha256 ?? committed.sha256,
    },
  };
}

export function scoreMinerResponse(checkpoint, challenge, response, { maxLatencyMs = 2_000 } = {}) {
  const expected = checkpoint.datasets[challenge.dataset];
  const answer = response?.answer;
  const checks = {
    challenge: response?.challengeId === challenge.challengeId,
    chain: answer?.chainGenesis === checkpoint.chainGenesis,
    position: answer?.blockNumber === checkpoint.blockNumber && answer?.blockHash === checkpoint.blockHash,
    root: answer?.stateRoot === checkpoint.stateRoot,
    dataset: answer?.dataset === challenge.dataset && answer?.rowCount === expected.count && answer?.datasetHash === expected.sha256,
  };
  const failures = Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => name);
  if (failures.length > 0) return { valid: false, scoreBps: 0, failures };
  const latency = Math.max(0, Number(response.latencyMs));
  const latencyBps = Math.max(0, Math.round(2_000 * (1 - Math.min(latency, maxLatencyMs) / maxLatencyMs)));
  return { valid: true, scoreBps: 8_000 + latencyBps, failures: [] };
}

export function reachThresholdConsensus(responses, { threshold = 2, totalMiners = 3 } = {}) {
  if (!Number.isSafeInteger(threshold) || !Number.isSafeInteger(totalMiners) || threshold < 2 || threshold > totalMiners) {
    throw new Error("Consensus threshold must require between two and all configured miners.");
  }
  const miners = new Set();
  const challengeIds = new Set();
  const groups = new Map();
  for (const response of responses) {
    if (miners.has(response.minerId)) throw new Error(`Duplicate miner response: ${response.minerId}`);
    miners.add(response.minerId);
    challengeIds.add(response.challengeId);
    const answer = response.answer;
    const key = JSON.stringify([answer.chainGenesis, answer.blockNumber, answer.blockHash, answer.stateRoot, answer.dataset, answer.rowCount, answer.datasetHash]);
    const group = groups.get(key) ?? { answer, miners: [] };
    group.miners.push(response.minerId);
    groups.set(key, group);
  }
  if (challengeIds.size !== 1) throw new Error("Consensus responses must answer one challenge.");
  const winners = [...groups.values()].filter((group) => group.miners.length >= threshold);
  if (winners.length !== 1) {
    return { status: "no-consensus", threshold, totalMiners, participants: [...miners], agreedMiners: [], dissentingMiners: [...miners], answer: null };
  }
  const winner = winners[0];
  return {
    status: "consensus",
    threshold,
    totalMiners,
    participants: [...miners],
    agreedMiners: winner.miners,
    dissentingMiners: [...miners].filter((miner) => !winner.miners.includes(miner)),
    answer: winner.answer,
  };
}

export function buildPrototypeReport() {
  const chainGenesis = `0x${"8f".repeat(32)}`;
  const snapshot = {
    chainGenesis,
    datasets: Object.fromEntries(INDEX_DATASETS.map((name, index) => [name, {
      count: name === "artifacts" || name === "transfers" || name === "rejections" ? 0 : index + 1,
      sha256: digestRows([{ fixture: name, revision: 1 }]),
    }])),
  };
  const checkpoint = createCheckpointCommitment(snapshot, { blockNumber: "1000", blockHash: `0x${"a1".repeat(32)}` });
  const challenge = createValidatorChallenge(checkpoint, { dataset: "artifacts", nonce: "00000000000000000000000000000001" });
  const badHash = `${checkpoint.datasets.artifacts.sha256[0] === "0" ? "1" : "0"}${checkpoint.datasets.artifacts.sha256.slice(1)}`;
  const responses = [
    createMinerResponse({ minerId: "atlas", checkpoint, challenge, latencyMs: 110 }),
    createMinerResponse({ minerId: "scarab", checkpoint, challenge, latencyMs: 180 }),
    createMinerResponse({ minerId: "obelisk", checkpoint, challenge, latencyMs: 90, datasetOverride: { sha256: badHash } }),
  ];
  const scores = responses.map((response) => ({ minerId: response.minerId, latencyMs: response.latencyMs, ...scoreMinerResponse(checkpoint, challenge, response) }));
  return {
    protocol: PROTOCOL,
    version: VERSION,
    phase: "simulation",
    network: "synthetic-testnet-fixture",
    registeredSubnet: false,
    emissionsEnabled: false,
    chainWrites: false,
    checkpoint,
    challenge,
    scores,
    consensus: reachThresholdConsensus(responses, { threshold: 2, totalMiners: 3 }),
  };
}
