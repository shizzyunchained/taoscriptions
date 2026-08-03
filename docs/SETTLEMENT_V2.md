# Settlement v2: native ink!/WASM ownership

Status: release Wasm compiled; not deployed; not audited; not authorized for value

Prototype Wasm SHA-256: `73e3f2760f2da7c6e514b9c7982b1492e0d9498df111c6cde39ab819ec117d8f`

## Decision

The current signed-remark ownership protocol cannot provide safe paid settlement. `utility.batch_all` can make a TAO payment and remark succeed together, but Subtensor does not interpret the remark as Relic ownership. A stale listing can therefore pay the seller while a deterministic indexer rejects the claimed ownership change.

Subtensor testnet runtime spec 440 exposes `pallet-contracts`. The upstream Subtensor repository explicitly supports WASM smart contracts and provides an ink! 5.1.1 environment using a `u64` TAO balance. Settlement v2 therefore uses a non-EVM ink! contract as the native ownership and sale state machine for future Relics.

## Buyer no-loss invariant

For every attempted purchase, exactly one outcome is permitted:

1. the contract transfers the exact asking price to the seller, assigns ownership to the buyer, increments the ownership nonce, deletes the listing, and emits the purchase event; or
2. the contract call reverts and the buyer retains the attached TAO.

Returning `Err` from an ink! message is not sufficient for a payable safety path. Every validation failure in `buy` therefore uses `ReturnFlags::REVERT`. The successful path validates before transfer, transfers to the seller, then performs only infallible storage updates. A contract trap or exhausted weight reverts changes at the current contract call level, including balance transfers.

## Why this applies to v2 only

The existing v1 owner is derived from signed Subtensor remarks. A newly deployed contract cannot independently inspect that complete historical state and must not trust a single hosted indexer to import owners. Existing Relics remain discovery-only unless a reviewed migration is added.

Future v2 mints solve this by registering contract ownership inside the same `utility.batch_all` as the burn and manifest. A caller-bound key prevents another account from pre-registering the same key. The indexer accepts the Relic only when the burn evidence, contract event, manifest, caller, content hash, and derived key agree.

## Required gates before deployment

1. Compile reproducibly against ink! 5.1.1 and the current Subtensor contract environment.
2. Pass unit, property, adversarial, and contract e2e tests on a local Subtensor node.
3. Dry-run code upload, instantiation, registration, listing, cancellation, transfer, failed purchase, and successful purchase against public testnet.
4. Publish the Wasm code hash, metadata, source commit, constructor salt, and deployed AccountId32.
5. Add indexer support for exact v2 mint and contract event validation.
6. Complete an independent contract security review.
7. Keep mainnet and real-value buying disabled until all evidence is published.

## Verified prototype evidence

- The contract compiles against the Subtensor-compatible ink! 5.1.1 environment with `Balance = u64`.
- Four unit tests pass for registration/authorization, invalid purchase conditions, listing invalidation, and the successful ownership state transition.
- The optimized native Wasm is 13,924 bytes and is bundled with machine-readable contract metadata.
- No contract AccountId exists yet. No website purchase flow calls this contract. No TAO can be moved by the current buyer interface.

The next irreversible step is a wallet-signed upload and instantiation on public testnet. That step must be followed by live tests proving exact seller payment, buyer ownership, stale-listing rejection, wrong-value refund, expiry rejection, and replay resistance before the interface can enable buying.
