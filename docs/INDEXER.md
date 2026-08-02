# Neural Relics Indexer v1

This document turns `PROTOCOL.md` into an implementation boundary. The protocol
document wins if these notes conflict.

## Pipeline

```text
Subtensor finalized head
  -> fetch block, signed extrinsics, events, runtime version
  -> decode operations using metadata for that block
  -> strict protocol validation
  -> one database transaction per block
  -> derived artifacts, ownership, numbering, and rejection records
  -> read-only API
```

The indexer follows finalized heads, not best heads.

## Minimum persisted evidence

For every processed finalized block:

- genesis hash, block number, block hash, parent hash, and runtime spec version;
- raw or reproducibly encoded extrinsic data;
- signer AccountId32, extrinsic hash, index, success, and relevant events;
- original remark bytes and BLAKE2-256 payload hash;
- validation result and stable reason code;
- indexer build version.

For every accepted mint:

- canonical artifact ID, global number, and subnet number;
- netuid and subnet registration block;
- creator and current owner;
- TAO input, actual alpha burned, hotkey, limit price, and transaction fee;
- media manifest and content verification status;
- full creation chain position.

## Suggested database constraints

- unique `(genesis_hash, block_number)`;
- unique `(genesis_hash, block_hash)`;
- unique `(genesis_hash, block_number, extrinsic_index, operation_index)`;
- unique `artifact_id`;
- unique `(genesis_hash, global_number)`;
- unique `(genesis_hash, netuid, subnet_generation, subnet_number)`;
- unique accepted ownership nonce per artifact;
- unique listing ID.

Numbers are allocated inside the same serializable database transaction that
accepts the mint. Replaying a block returns the previously stored result.

## Runtime upgrades

Metadata is selected by block hash. The indexer maintains an allowlist of tested
spec versions. At an unknown version it records the boundary, stops advancing,
and alerts operators. It never guesses a new call or event layout.

## API boundary

The public API is read-only for canonical state. Write endpoints may relay
signed listings or media uploads, but must not create ownership or accepted
protocol operations. All state-changing truth comes from finalized chain data.

Initial endpoints:

```text
GET /health
GET /v1/status
GET /v1/artifacts
GET /v1/artifacts/:id
GET /v1/subnets/:netuid/:generation/artifacts
GET /v1/accounts/:account/artifacts
GET /v1/operations/:block/:extrinsic
GET /v1/rejections/:block/:extrinsic
```

## Recovery

A complete rebuild from genesis or a documented checkpoint must reproduce all
artifact IDs, numbers, ownership states, and payload hashes. A release is not
production-ready until this reproducibility test passes against a second empty
database.
