BEGIN;

CREATE TABLE IF NOT EXISTS indexed_blocks (
  chain_genesis TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  parent_hash TEXT NOT NULL,
  runtime_spec INTEGER NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_genesis, block_number),
  UNIQUE (chain_genesis, block_hash)
);

CREATE TABLE IF NOT EXISTS chain_checkpoints (
  chain_genesis TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  chain_genesis TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  extrinsic_index INTEGER NOT NULL,
  extrinsic_hash TEXT NOT NULL,
  extrinsic_hex TEXT NOT NULL,
  global_number BIGINT NOT NULL,
  subnet_number BIGINT NOT NULL,
  netuid INTEGER NOT NULL,
  subnet_generation BIGINT NOT NULL,
  creator_account_hex TEXT NOT NULL,
  owner_account_hex TEXT NOT NULL,
  hotkey_account_hex TEXT NOT NULL,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  body TEXT,
  content_uri TEXT,
  content_hash TEXT,
  payload_json JSONB NOT NULL,
  payload_hex TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  tao_spent_rao NUMERIC(20, 0) NOT NULL,
  alpha_burned_rao NUMERIC(20, 0) NOT NULL,
  limit_price_rao NUMERIC(20, 0) NOT NULL,
  evidence_json JSONB NOT NULL,
  ownership_nonce BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_genesis, block_number, extrinsic_index),
  UNIQUE (chain_genesis, global_number),
  UNIQUE (chain_genesis, netuid, subnet_generation, subnet_number)
);

CREATE INDEX IF NOT EXISTS artifacts_owner_idx
  ON artifacts (chain_genesis, owner_account_hex, global_number DESC);
CREATE INDEX IF NOT EXISTS artifacts_subnet_idx
  ON artifacts (chain_genesis, netuid, subnet_generation, subnet_number DESC);
CREATE INDEX IF NOT EXISTS artifacts_payload_hash_idx
  ON artifacts (chain_genesis, payload_hash);

CREATE TABLE IF NOT EXISTS transfers (
  transfer_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  chain_genesis TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  extrinsic_index INTEGER NOT NULL,
  extrinsic_hash TEXT NOT NULL,
  extrinsic_hex TEXT NOT NULL,
  from_account_hex TEXT NOT NULL,
  to_account_hex TEXT NOT NULL,
  ownership_nonce BIGINT NOT NULL,
  payload_json JSONB NOT NULL,
  payload_hex TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_genesis, block_number, extrinsic_index),
  UNIQUE (artifact_id, ownership_nonce)
);

CREATE INDEX IF NOT EXISTS transfers_artifact_idx
  ON transfers (artifact_id, ownership_nonce);
CREATE INDEX IF NOT EXISTS transfers_destination_idx
  ON transfers (chain_genesis, to_account_hex, block_number DESC);

CREATE TABLE IF NOT EXISTS listings (
  listing_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  chain_genesis TEXT NOT NULL,
  seller_account_hex TEXT NOT NULL,
  ownership_nonce BIGINT NOT NULL,
  price_rao NUMERIC(39, 0) NOT NULL CHECK (price_rao > 0),
  expiry_block BIGINT NOT NULL,
  nonce TEXT NOT NULL,
  buyer_account_hex TEXT,
  message_text TEXT NOT NULL,
  signature TEXT NOT NULL,
  cancellation_message TEXT,
  cancellation_signature TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artifact_id, ownership_nonce, nonce),
  CHECK (buyer_account_hex IS NULL OR buyer_account_hex <> seller_account_hex)
);

CREATE INDEX IF NOT EXISTS listings_active_idx
  ON listings (chain_genesis, expiry_block DESC, created_at DESC)
  WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS listings_artifact_idx
  ON listings (artifact_id, ownership_nonce, created_at DESC);

CREATE TABLE IF NOT EXISTS rejected_operations (
  chain_genesis TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  extrinsic_index INTEGER NOT NULL,
  extrinsic_hash TEXT NOT NULL,
  payload_hash TEXT,
  reason_code TEXT NOT NULL,
  detail TEXT NOT NULL,
  indexer_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_genesis, block_number, extrinsic_index)
);

ALTER TABLE indexed_blocks ADD COLUMN IF NOT EXISTS parent_hash TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS extrinsic_hash TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS extrinsic_hex TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS evidence_json JSONB;
ALTER TABLE rejected_operations ADD COLUMN IF NOT EXISTS extrinsic_hash TEXT;

COMMIT;
