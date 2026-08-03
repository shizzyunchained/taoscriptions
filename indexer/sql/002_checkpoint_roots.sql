BEGIN;

ALTER TABLE chain_checkpoints
  ADD COLUMN IF NOT EXISTS checkpoint_version INTEGER,
  ADD COLUMN IF NOT EXISTS state_root TEXT,
  ADD COLUMN IF NOT EXISTS transcript_hash TEXT;

COMMIT;
