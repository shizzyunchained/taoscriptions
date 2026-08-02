# Bittensor Relics read API v1

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
time, immutable activation block, and accepted artifact count.

## Artifacts

```text
GET /api/v1/artifacts?limit=24&cursor=120
GET /api/v1/artifacts/:artifactId
GET /api/v1/artifacts/:artifactId/transfers
GET /api/v1/artifacts/:artifactId/media
```

Lists artifacts newest-first. `limit` is capped at 100. `cursor` is the last
global artifact number from the previous response. The detail endpoint requires
the canonical `br1:<genesis>:<block>:<extrinsic>` identifier.
Artifact detail includes up to 100 accepted transfers in nonce order. The
transfer-specific endpoint returns the same provenance plus the current owner
and ownership nonce.
Finalized transfer records also expose their actual chain fee in rao.
Artifact responses include the requested TAO input, actual alpha burned,
execution limit price, and actual finalized transaction fee in rao.

The media endpoint returns the exact WebP bytes reconstructed from an on-chain
binary mint envelope. It never redirects to external storage. Responses are
immutable, use the indexed media type, and include the on-chain SHA-256 hash as
the ETag.

Wallet review may add `fresh=1` to artifact detail or owner collection requests.
Successful responses then use `Cache-Control: no-store` so a signing decision is
checked against the newest indexed ownership state rather than the public
ten-second read cache.

## Marketplace discovery

`GET /api/v1/listings` returns active signed listings. An optional `artifact`
query parameter filters to one relic. Listings are active only while their
seller and ownership nonce match finalized indexed state and their expiry is
after the finalized checkpoint.

`POST /api/v1/listings` accepts the exact signed fields defined in the protocol:
`chain`, `artifact`, `seller`, `ownershipNonce`, `priceRao`, `expiryBlock`,
`nonce`, `buyer`, and `signature`. Integer fields are canonical decimal strings.
The server reconstructs the message and verifies the raw wallet signature; it
does not accept caller-supplied message text or listing IDs.

`DELETE /api/v1/listings/:id` accepts `seller` and `signature` for the canonical
cancellation message. This only removes the listing from discovery.

Marketplace settlement is intentionally unavailable. Listing responses include
`settlementEnabled: false`; there is no purchase endpoint.

## Owner collection

```text
GET /api/v1/accounts/:ss58OrAccountId32/artifacts?limit=24&cursor=120
```

The account is decoded and normalized to a 32-byte hex AccountId before the
database query. The returned owner is Bittensor Relics protocol ownership, not a
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
    "message": "The Bittensor Relics indexer is not configured."
  }
}
```

Defined codes currently include `INVALID_ARTIFACT_ID`, `INVALID_ACCOUNT`,
`INVALID_SUBNET`, `INVALID_CHAIN_POSITION`, `NOT_FOUND`, `INDEXER_NOT_READY`,
`INDEXER_UNAVAILABLE`, and `INTERNAL_ERROR`.

## Proof-network prototype

```text
GET /api/v1/network/prototype
```

Returns the deterministic three-miner conformance fixture used by the public
Network page: canonical checkpoint and challenge commitments, validator scores,
and a 2-of-3 gateway decision. This endpoint is explicitly a simulation. It
does not report live miners, a registered netuid, emissions, or chain writes.
