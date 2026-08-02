# Neural Relics: ten-step delivery roadmap

This roadmap is ordered by risk. A later stage never weakens an earlier safety
gate to move faster.

## 1. Preserve the existing product

Work from a dedicated feature branch, keep `main` deployable, and require lint,
production build, and runtime verification before every preview deployment.

**Status:** complete.

## 2. Freeze the protocol before minting

Define canonical payload bytes, the exact atomic call shape, artifact IDs,
ordering, subnet generations, transfer rules, and invalid transaction cases.

**Status:** complete for protocol v1.

## 3. Rebrand as Neural Relics

Replace TAOscriptions copy and visuals with an original product identity focused
on subnet alpha destruction, not generic text remarks.

**Status:** complete on the feature branch.

## 4. Build the live alpha forge preview

Read active subnet identities, symbols, registration generations, prices, fees,
and simulated TAO-to-alpha output directly from testnet.

**Status:** complete; read-only and transaction-locked.

## 5. Harden wallet and transaction intent

Require an injected SS58 wallet, show the signing account and network, validate
balances and quote freshness, apply explicit slippage, and render a complete
human-readable transaction review before requesting a signature.

**Status:** implemented on the feature branch; live wallet review pending.
An unsigned live-runtime verifier also constructs, encodes, round-trips, quotes,
and fee-estimates the exact atomic mint without submitting it.

## 6. Prove atomic minting on testnet

Submit `batchAll(addStakeBurn, remarkWithEvent)`, follow it to finalization, and
verify the expected burn, remark, and batch-complete events before showing a
receipt. Test rejection, rollback, stale quote, and disconnect paths.

**Status:** transaction construction and finalized-event checks implemented;
one funded-wallet testnet mint is still required before this gate is complete.

## 7. Run a reorg-safe indexer

Use a long-running service and Postgres to process finalized blocks, retain a
checkpoint, enforce unique event coordinates, and deterministically assign relic
numbers. Rebuild from genesis data and compare outputs before trusting it.

**Status:** worker, schema, strict parser, finalized checkpoints, Render
blueprint, and deterministic two-database replay audit are implemented;
database deployment and execution of the independent replay still remain.

## 8. Add collection and transfer views

Expose relic detail pages, owner collections, subnet collections, provenance,
and canonical transfer inscriptions. Every UI claim must link back to its block
and extrinsic.

**Status:** finalized read API, Explore collection, proof detail pages, canonical
transfer processing, ownership history, wallet-owned collection, transfer
review/signing flow, and fresh-state signing checks are implemented; live
indexed data and one real transfer test remain pending.

## 9. Add marketplace discovery safely

Start with signed listings, offers, and discovery. Do not enable real-value
settlement until the protocol can guarantee that TAO payment and derived relic
ownership cannot diverge.

**Status:** signed listing and cancellation protocol, signature verification,
discovery API, owner listing and cancellation flows, and locked marketplace
view are implemented. Live database testing and a chain-enforced settlement
design remain pending; there is deliberately no purchase endpoint.

## 10. Audit, document, and launch progressively

Publish protocol and indexer docs, threat-model wallet and indexer boundaries,
monitor RPC/indexer health, deploy a public testnet preview, run a limited beta,
and promote to mainnet only after reproducible finalization tests and an
independent review.

**Status:** ongoing.

Structured worker heartbeats and finalized-lag fields are implemented. External
log alerts, public beta observation, independent review, and production
promotion remain pending. Deterministic pull-request CI, scheduled live runtime
compatibility checks, dependency update automation, and the preview-to-
production launch/rollback checklist are implemented.
