# Neural Relics Protocol v1

Status: Draft for testnet implementation  
Network: Bittensor Subtensor, non-EVM  
Runtime baseline: spec version 440  
Protocol identifier: `neural-relics`  

## 1. Purpose

Neural Relics is an open protocol for creating numbered digital artifacts from
native Subtensor transactions. A valid v1 mint atomically:

1. spends TAO to buy a selected subnet's alpha;
2. permanently burns the alpha received from that swap; and
3. records an inscription with `System.remark_with_event`.

The burn and inscription are native chain facts. Artifact numbering, ownership,
collections, and marketplace state are deterministic derived state. Any indexer
implementing this document against the same finalized chain must produce the
same result.

Neural Relics is not an EVM NFT contract, a subnet, or a claim that arbitrary
metadata is stored inside an individual alpha token.

## 2. Normative language

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## 3. Trust boundary

- Subtensor is authoritative for block order, transaction success, signer,
  TAO movement, alpha swaps, and alpha burns.
- The indexer is authoritative only as an implementation of these public rules.
- A Relic is a protocol object derived from chain history; it is not a native
  asset recognized by the Subtensor runtime.
- A UI MUST describe ownership as Neural Relics protocol ownership and MUST NOT
  imply that Subtensor itself provides an NFT ownership primitive.
- Only finalized blocks may affect canonical protocol state.

## 4. Chain identity and subnet identity

Every index belongs to one Subtensor genesis hash. State from different genesis
hashes MUST never be combined.

A subnet is identified by both:

```text
(netuid, NetworkRegisteredAt[netuid])
```

The registration block is called `subnet_generation` in this protocol. A
`netuid` alone is insufficient because a deregistered number can later identify
a different subnet.

Root, `netuid = 0`, is not eligible for alpha-burn minting.

## 5. Canonical artifact identity and numbering

The canonical artifact ID is:

```text
nr1:<full-genesis-hash>:<finalized-block-number>:<extrinsic-index>
```

Version 1 permits exactly one mint inscription in the qualifying extrinsic, so
an inner-call index is not required. Indexers MUST still store the decoded call
path for auditability.

Valid mints receive two deterministic numbers:

- `global_number`: sequence of all valid mints on the genesis hash;
- `subnet_number`: sequence within `(netuid, subnet_generation)`.

Ordering is ascending `(block_number, extrinsic_index)`. Invalid operations do
not consume a number. Numbers are assigned only after finality and therefore do
not change during ordinary fork resolution.

## 6. Mint inscription

The remark is UTF-8 JSON with no duplicate keys. A v1 mint has this shape:

```json
{
  "p": "neural-relics",
  "v": 1,
  "op": "mint",
  "netuid": 64,
  "subnet_generation": 4920351,
  "name": "Example Relic",
  "media_type": "text/plain;charset=utf-8",
  "body": "An inline text artifact"
}
```

For externally stored media, `body` is replaced with both `content_uri` and
`content_hash`:

```json
{
  "p": "neural-relics",
  "v": 1,
  "op": "mint",
  "netuid": 64,
  "subnet_generation": 4920351,
  "name": "Example Image",
  "media_type": "image/png",
  "content_uri": "ipfs://bafy...",
  "content_hash": "sha256:<64-lowercase-hex-characters>"
}
```

Rules:

- The encoded remark MUST be at most 2,048 bytes.
- `p`, `v`, `op`, `netuid`, `subnet_generation`, `name`, and `media_type` are
  required.
- `name` MUST contain 1 to 80 Unicode scalar values after trimming.
- A mint MUST contain either `body`, or both `content_uri` and `content_hash`,
  but not both forms.
- Inline `body` MUST contain 1 to 1,024 Unicode scalar values after trimming.
- `content_hash` MUST identify the exact retrieved bytes, not a transformed or
  rendered representation.
- Integer fields MUST be JSON integers. Floating-point values are forbidden.
- Indexers MUST preserve the original remark bytes for audit and calculate a
  BLAKE2-256 payload hash.
- Unknown fields are invalid in v1. Extensions require a later protocol version.

## 7. Valid mint transaction

A v1 mint extrinsic MUST be signed by the initial owner and MUST contain this
exact outer call:

```text
Utility.batch_all([
  SubtensorModule.add_stake_burn(hotkey, netuid, amount, Some(limit_price)),
  System.remark_with_event(mint_payload)
])
```

The order is mandatory. Additional inner calls invalidate a v1 mint.

The reference client routes the temporary stake through the selected subnet's
registered `SubnetOwnerHotkey` read from the same finalized snapshot as the
quote. This lets a coldkey-only TAOStats user mint without owning or registering
a hotkey. The purchased alpha is burned inside the same atomic call; no stake is
left with the route hotkey. The chosen hotkey remains part of the permanent
event evidence and MUST be shown in the signing review.

The indexer MUST verify all of the following:

1. The containing block is finalized.
2. The outer extrinsic and `Utility.batch_all` completed successfully.
3. The signer is available and matches the remark sender.
4. The first inner call is `add_stake_burn` with a non-root `netuid`, nonzero
   TAO amount, and an explicit price limit.
5. The second inner call is exactly one `remark_with_event` with a valid mint
   payload.
6. Payload `netuid` equals call `netuid`.
7. Payload `subnet_generation` equals `NetworkRegisteredAt[netuid]` in the
   state applicable to that extrinsic.
8. A matching `SubtensorModule.AlphaBurned` event exists for signer, hotkey,
   netuid, and actual alpha amount.
9. A matching `SubtensorModule.AddStakeBurn` event exists for hotkey, netuid,
   TAO input, and actual alpha amount.
10. The actual alpha amount is greater than zero.
11. The `System.Remarked` event matches the signer and remark hash.

The event values, not values claimed in JSON, are the source of truth for TAO
spent and alpha burned. Transaction fees, including alpha-paid transaction
fees, MUST NOT count toward the Relic's burn proof.

`Utility.batch_all` is required because it rolls back all inner calls if an
inner call fails. A plain `Utility.batch` is invalid.

## 8. Initial state

For every valid mint:

- `creator` is the extrinsic signer;
- `owner` is the extrinsic signer;
- `created_at` is the finalized block and extrinsic position;
- burn provenance is the matching chain events and call arguments;
- subnet metadata is snapshotted for display but does not replace the canonical
  `(netuid, subnet_generation)` identity.

Duplicate content is allowed but MUST be disclosed. Indexers SHOULD link
artifacts sharing an identical content hash and identify the earliest valid
mint.

## 9. Direct-alpha burn mode

A future compatible mint mode MAY consume alpha already held by the signer:

```text
Utility.batch_all([
  SubtensorModule.burn_alpha(hotkey, amount_alpha, netuid),
  System.remark_with_event(mint_payload)
])
```

This mode is reserved until it receives a distinct operation or protocol
version. A v1 indexer MUST NOT accept it as a normal `mint` because
`burn_alpha` caps the requested amount at available unlocked alpha. Validation
must use the actual `AlphaBurned` event, never the requested amount.

## 10. Transfers

The transfer operation is a successful, finalized, signer-authenticated
`System.remark_with_event` extrinsic. It MUST be the exact outer call; transfers
nested in a batch or combined with any other call are invalid:

```json
{
  "p": "neural-relics",
  "v": 1,
  "op": "transfer",
  "artifact": "nr1:<genesis>:<block>:<index>",
  "to": "<SS58 address>",
  "nonce": 1
}
```

An indexer accepts a transfer only when:

- the signer is the current owner immediately before the extrinsic;
- `to` decodes to a valid AccountId32 on the indexed chain;
- `to` is not the current owner;
- `nonce` equals the artifact's next ownership nonce; and
- the artifact is not locked by a future settlement mechanism.

The destination address is normalized to AccountId32. The nonce starts at 1
and increments on each accepted ownership change. Invalid transfers do not
change state.

## 11. Marketplace foundation

Version 1 may support signed, non-custodial listings for discovery, but real
value settlement MUST remain disabled until the no-loss invariant below is
satisfied.

A listing authorization is signed off-chain by the current owner using the
wallet's raw-byte signing capability. Addresses are normalized to AccountId32
before constructing the message.

```text
NEURAL_RELICS_LISTING_V1
chain=<full genesis hash>
artifact=<canonical artifact id>
seller=<0x account-id-32>
ownership_nonce=<current unsigned ownership nonce>
price_rao=<unsigned decimal integer>
expiry_block=<unsigned decimal integer>
nonce=<64 lowercase hex characters>
buyer=<* or 0x account-id-32>
```

The message ends with one newline. `listing_id` is BLAKE2-256 of these exact
UTF-8 bytes. The seller signature, canonical message, and listing ID form the
portable listing; an API may relay it but cannot alter it. A listing is active
only while the indexed owner and ownership nonce still exactly match the
authorization. Any accepted transfer invalidates it, including if the relic
later returns to the same account under a newer ownership nonce.

The seller may cancel a listing with a second raw signature:

```text
NEURAL_RELICS_CANCEL_LISTING_V1
chain=<full genesis hash>
listing=<listing id>
seller=<0x account-id-32>
```

This message also ends with one newline. Cancellation changes marketplace
discovery state only; it is not an on-chain ownership operation.

A proposed buyer settlement is:

```text
Utility.batch_all([
  Balances.transfer_keep_alive(seller, price_rao),
  System.remark_with_event(purchase_payload_with_listing_authorization)
])
```

This makes payment and the purchase remark atomic at the runtime level, but the
runtime does not know Neural Relics ownership. A seller transfer, cancellation,
or competing purchase ordered before the buyer can cause a deterministic
indexer rejection after TAO has moved. Therefore the UI MUST NOT enable this
settlement for real value merely because the two calls are batched.

Before production marketplace launch, the design MUST prove this invariant:

> A conforming buyer cannot irreversibly pay TAO unless the same finalized
> state transition makes that buyer the artifact owner.

Acceptable solutions include a reviewed native non-EVM settlement mechanism or
another chain-enforced construction. An indexer-only promise is insufficient.

## 12. Reorganizations, replay, and idempotency

- Only finalized blocks enter canonical state.
- Processing the same finalized block more than once MUST be idempotent.
- The database MUST enforce uniqueness on artifact ID, chain position, accepted
  operation position, and listing ID.
- All off-chain signatures MUST include the full genesis hash and a domain
  string to prevent cross-chain and cross-protocol replay.
- Ownership nonces prevent replay of accepted transfers.

## 13. Indexer failure behavior

The indexer MUST fail closed. Unknown runtime metadata, undecodable calls,
missing events, duplicate JSON keys, mismatched burn values, or unsupported
protocol versions result in a recorded rejected operation, never an accepted
artifact.

Rejected operation records SHOULD include chain position, payload hash, reason
code, and indexer version without displaying unsafe payloads as executable
content.

If runtime metadata changes, indexing pauses at the first unsupported spec
version until compatibility is tested. Previously finalized state remains
queryable.

## 14. Media safety

- Media is rendered from content-addressed bytes and checked against
  `content_hash` before display.
- SVG, HTML, and other active formats MUST be sandboxed or served as downloads.
- User text MUST be escaped; inscription content is never trusted HTML.
- External gateways are availability helpers, not the source of truth.

## 15. Client safety requirements

Before requesting a mint signature, the site MUST display:

- selected subnet and its generation;
- TAO permanently spent;
- quoted alpha expected to be burned;
- price impact and explicit limit price;
- estimated transaction fee;
- current network and genesis hash;
- a plain warning that the spend and burn are irreversible.

The client MUST also fail before requesting a signature when the subnet's
subtoken is disabled, its registered route hotkey no longer exists, or the
simulated TAO paid into the pool after swap fees is below `DefaultMinStake`.

The client MUST simulate or quote using the current runtime, pin the generation,
spot price, quote, and review block to one finalized chain snapshot, recheck
immediately before signing, and never silently replace a failed limited order
with a market order.

For a TAO-to-alpha burn, `limit_price` is the maximum acceptable **ending spot
price** in rao per alpha. It is not an average execution price. The client MUST
derive it from a fresh `SwapRuntimeApi.current_alpha_price` result and the
explicit user tolerance. The v1 client uses a 2% cap and rounds upward:

```text
limit_price = ceil(current_spot_price_rao * 1.02)
```

Because `add_stake_burn` sets `allow_partial = false`, a swap whose ending pool
price would cross that cap fails atomically; the client MUST NOT widen the cap
or retry as a market order without a new user review and signature.

Mainnet minting remains disabled until the testnet implementation, indexer,
documentation, and security gates are complete.

An accepted mint receipt MUST include a matching
`TransactionPayment.TransactionFeePaid` event for the signer. Its `actual_fee`
is stored as finalized chain evidence; the estimated fee shown before signing is
not canonical.

Accepted transfers apply the same fee rule: the finalized fee payer must match
the transfer signer, and the index stores `actual_fee` rather than the client
estimate.

## 16. Reference implementation sources

- Bittensor stake-burn transaction:
  <https://www.bittensor.com/docs/tx/stake-burn>
- Bittensor staking and pool mechanics:
  <https://www.bittensor.com/docs/concepts/staking-pools>
- Bittensor runtime source:
  <https://github.com/RaoFoundation/subtensor>
- Atomic `Utility.batch_all` behavior:
  <https://docs.rs/pallet-utility/latest/pallet_utility/pallet/enum.Call.html#variant.batch_all>

The live mainnet and testnet runtime metadata were checked at spec version 440
before drafting this document. Implementations MUST inspect live metadata rather
than assuming call availability from this statement.
