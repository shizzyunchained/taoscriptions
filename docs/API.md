# Neural Relics read API v1

The API exposes only state derived from finalized Bittensor blocks. It never
creates artifacts, changes ownership, or treats a pending transaction as
canonical.

Base path:

```text
/api/v1
```

All successful responses are JSON. Finalized reads may be cached for 10 seconds
and are accessible cross-origin. When the database is intentionally absent, the
API returns HTTP 503 with `INDEXER_UNAVAILABLE` instead of an empty collection.

## Status

```text
GET /api/v1/status
```

Returns protocol version, chain genesis hash, finalized checkpoint, checkpoint
time, and accepted artifact count.

## Artifacts

```text
GET /api/v1/artifacts?limit=24&cursor=120
GET /api/v1/artifacts/:artifactId
GET /api/v1/artifacts/:artifactId/transfers
```

Lists artifacts newest-first. `limit` is capped at 100. `cursor` is the last
global artifact number from the previous response. The detail endpoint requires
the canonical `nr1:<genesis>:<block>:<extrinsic>` identifier.
Artifact detail includes up to 100 accepted transfers in nonce order. The
transfer-specific endpoint returns the same provenance plus the current owner
and ownership nonce.

## Owner collection

```text
GET /api/v1/accounts/:ss58OrAccountId32/artifacts?limit=24&cursor=120
```

The account is decoded and normalized to a 32-byte hex AccountId before the
database query. The returned owner is Neural Relics protocol ownership, not a
native NFT state recognized by Subtensor.

## Subnet-generation collection

```text
GET /api/v1/subnets/:netuid/:generation/artifacts?limit=24&cursor=120
```

Both subnet number and registration generation are mandatory. This prevents a
reused `netuid` from merging artifacts belonging to different subnet lives.

## Operation audit

```text
GET /api/v1/operations/:block/:extrinsic
GET /api/v1/rejections/:block/:extrinsic
```

The operation endpoint returns either an accepted artifact or a deterministic
rejection record. Rejection details are bounded diagnostic strings and never
render inscription bytes as HTML.

## Error shape

```json
{
  "error": {
    "code": "INDEXER_UNAVAILABLE",
    "message": "The Neural Relics indexer is not configured."
  }
}
```

Defined codes currently include `INVALID_ARTIFACT_ID`, `INVALID_ACCOUNT`,
`INVALID_SUBNET`, `INVALID_CHAIN_POSITION`, `NOT_FOUND`, `INDEXER_NOT_READY`,
`INDEXER_UNAVAILABLE`, and `INTERNAL_ERROR`.
