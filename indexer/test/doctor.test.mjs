import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_ARTIFACT_COLUMNS, REQUIRED_TABLES, REQUIRED_TRANSFER_COLUMNS, validateDoctorState } from "../src/doctor-lib.mjs";

const genesis = `0x${"1".repeat(64)}`;
const valid = (overrides = {}) => ({
  expectedGenesis: genesis,
  actualGenesis: genesis,
  supportedSpec: 440,
  actualSpec: 440,
  startBlock: 100,
  stopBlock: 150,
  finalizedHead: 200,
  checkpoint: null,
  activationBlock: null,
  tables: REQUIRED_TABLES,
  artifactColumns: REQUIRED_ARTIFACT_COLUMNS,
  transferColumns: REQUIRED_TRANSFER_COLUMNS,
  ...overrides,
});

test("deployment doctor accepts a migrated empty database at finalized bounds", () => {
  assert.deepEqual(validateDoctorState(valid()), {
    status: "ready", chainGenesis: genesis, runtimeSpec: 440, finalizedHead: 200,
    startBlock: 100, stopBlock: 150, checkpoint: null, activationBlock: 100,
    schema: { tables: 7, artifactColumns: 12, transferColumns: 13 },
  });
});

test("deployment doctor fails closed on chain, runtime, schema, or checkpoint drift", () => {
  assert.throws(() => validateDoctorState(valid({ actualGenesis: `0x${"2".repeat(64)}` })), /GENESIS_HASH_MISMATCH/);
  assert.throws(() => validateDoctorState(valid({ actualSpec: 441 })), /UNSUPPORTED_RUNTIME_SPEC/);
  assert.throws(() => validateDoctorState(valid({ finalizedHead: 99 })), /START_BLOCK_NOT_FINALIZED/);
  assert.throws(() => validateDoctorState(valid({ stopBlock: 201 })), /STOP_BLOCK_NOT_FINALIZED/);
  assert.throws(() => validateDoctorState(valid({ checkpoint: 98 })), /CHECKPOINT_BEFORE_CONFIGURED_START/);
  assert.throws(() => validateDoctorState(valid({ checkpoint: 201 })), /CHECKPOINT_AHEAD_OF_FINALITY/);
  assert.throws(() => validateDoctorState(valid({ checkpoint: 151 })), /CHECKPOINT_PAST_STOP_BLOCK/);
  assert.throws(() => validateDoctorState(valid({ activationBlock: 99 })), /ACTIVATION_BLOCK_MISMATCH/);
  assert.throws(() => validateDoctorState(valid({ tables: REQUIRED_TABLES.slice(1) })), /MISSING_SCHEMA_TABLES/);
  assert.throws(() => validateDoctorState(valid({ artifactColumns: REQUIRED_ARTIFACT_COLUMNS.slice(1) })), /MISSING_ARTIFACT_COLUMNS/);
  assert.throws(() => validateDoctorState(valid({ transferColumns: REQUIRED_TRANSFER_COLUMNS.slice(1) })), /MISSING_TRANSFER_COLUMNS/);
});
