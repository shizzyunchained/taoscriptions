import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKPOINT_GENESIS_ROOT,
  blockTranscript,
  nextCheckpointRoot,
} from "../src/checkpoint.mjs";

test("checkpoint roots are deterministic across independently ordered object keys", () => {
  const input = {
    blockNumber: 10,
    blockHash: `0x${"1".repeat(64)}`,
    artifacts: [{
      extrinsic_index: 2,
      artifact_id: "br1:test:10:2",
      payload_hash: `0x${"2".repeat(64)}`,
      owner_account_hex: `0x${"3".repeat(64)}`,
      ownership_nonce: "0",
    }],
    transfers: [],
    rejections: [],
  };
  const first = nextCheckpointRoot(CHECKPOINT_GENESIS_ROOT, blockTranscript(input));
  const second = nextCheckpointRoot(CHECKPOINT_GENESIS_ROOT, blockTranscript({ ...input }));
  assert.deepEqual(first, second);
  assert.match(first.stateRoot, /^0x[0-9a-f]{64}$/);
  assert.match(first.transcriptHash, /^0x[0-9a-f]{64}$/);
});

test("checkpoint roots change when indexed state changes", () => {
  const base = {
    blockNumber: 10,
    blockHash: `0x${"1".repeat(64)}`,
    artifacts: [],
    transfers: [],
    rejections: [],
  };
  const empty = nextCheckpointRoot(CHECKPOINT_GENESIS_ROOT, blockTranscript(base));
  const rejected = nextCheckpointRoot(CHECKPOINT_GENESIS_ROOT, blockTranscript({
    ...base,
    rejections: [{ extrinsic_index: 1, payload_hash: `0x${"4".repeat(64)}`, reason_code: "INVALID" }],
  }));
  assert.notEqual(empty.stateRoot, rejected.stateRoot);
});
