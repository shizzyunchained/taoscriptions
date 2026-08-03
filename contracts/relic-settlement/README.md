# Bittensor Relics Settlement v2

This is the non-EVM ink!/WASM settlement contract for future contract-owned Relics on Subtensor.

Status: compiled prototype, not deployed, not audited, and not approved for real value.

## Safety model

- A v2 Relic is registered inside the same successful `utility.batch_all` as its alpha burn and canonical manifest.
- The indexer recognizes a registration only when the burn, manifest, and `Registered` contract event agree.
- Contract storage, rather than an off-chain listing interpretation, is authoritative for v2 ownership.
- `buy` is payable and verifies the seller, ownership nonce, price, expiry, and buyer before transferring TAO.
- Every rejected payable purchase explicitly returns with the pallet-contracts `REVERT` flag, returning attached value.
- A successful call transfers the exact price to the seller, changes ownership to the buyer, increments the nonce, removes the listing, and emits `Purchased` in one contract execution.

## Important boundary

The existing v1 Relics were created before contract-native ownership. They cannot be placed under this contract merely by trusting the current web indexer. A separately specified migration must prove the current v1 owner before importing a legacy Relic. Until that mechanism is reviewed, v1 listings remain discovery-only.

## Reference v2 mint shape

```text
Utility.batch_all([
  SubtensorModule.add_stake_burn(...),
  Contracts.call(settlement_contract, 0, register_v2(mint_nonce, content_hash)),
  System.remark_with_event(v2_manifest_with_relic_key)
])
```

The indexer must reject any v2 mint unless all three calls succeed in this exact order and the derived Relic key matches the contract event and manifest.

## Reproduce the prototype

The project pins Rust 1.85.0, ink! 5.1.1, and compatible SCALE dependencies. With `cargo-contract` 5.0.3 installed:

```text
cargo test
cargo contract build --release
```

The current release build produces a 13,924-byte Wasm file with SHA-256:

```text
73e3f2760f2da7c6e514b9c7982b1492e0d9498df111c6cde39ab819ec117d8f
```

The local ink simulator cannot execute balance transfers for Subtensor's `u64` balance environment. Unit tests cover registration, authorization, stale listings, expiry, payment validation, listing invalidation, and the ownership transition. Actual payment, seller receipt, and revert/refund behavior remain mandatory public-testnet gates.
