# Neural Relics: next ten launch gates

The product build is substantially complete. These are the next ten gates from
the protected testnet preview to a controlled production launch. They are
ordered: a later gate never substitutes for missing evidence from an earlier
one.

## Current position

The Neural Relics brand, non-EVM mint protocol, testnet mint interface,
finalized-state indexer, wallet collection, canonical transfers, signed listing
discovery, replay audit, and launch controls are implemented on the feature
branch. Production remains unchanged. Real-value marketplace settlement is not
part of this release.

## 1. Freeze the release candidate

Lock the Neural Relics name and v1 protocol, choose one reviewed commit, and
keep all release evidence tied to that exact SHA. Any later code change creates
a new candidate and reruns the gates.

**Ready when:** protocol and brand docs are reviewed and a candidate SHA is
recorded.

## 2. Prove the exact candidate against Bittensor

Run deterministic CI, dependency audit, live runtime compatibility, and the
unsigned atomic transaction verifier on the candidate commit.

**Ready when:** both GitHub workflows and the transaction report pass on the
same SHA within 24 hours.

## 3. Rehearse wallet rejection and safety paths

Use TAOStats Wallet in the protected preview to reject a signature, then test
wrong genesis, stale quote, insufficient balance, and disconnect handling.
None may submit an extrinsic.

**Ready when:** each failure is recorded with its expected no-submission result.

## 4. Finalize one funded testnet mint

Sign one real `batchAll(addStakeBurn, remarkWithEvent)` mint using a dedicated,
low-value testnet account. Download the receipt from the site.

**Ready when:** the wallet and site both show finalization and the receipt
contains the burn, remark, fee, block, extrinsic, signer, and artifact evidence.

## 5. Independently verify the mint and activation block

Run `npm run verify:mint-evidence -- <proof.json>` against finalized chain
state. Freeze its verified `recommendedStartBlock` as the immutable indexer
activation block.

**Ready when:** the verifier reports `verified: true` and its JSON report is
retained.

## 6. Provision the two-database indexer

Create separate primary and replay Postgres databases and two manually deployed
Render workers. Use identical chain, activation, runtime, and stop-block
configuration. Automatic deploys stay disabled.

**Ready when:** migration and `indexer:doctor` pass independently for both
databases without exposing credentials.

## 7. Prove replay and publish finalized reads

Stop both workers at the same finalized checkpoint, run `indexer:audit`, then
allow only the primary worker to follow finalized heads. Connect the Vercel
preview to the read API.

**Ready when:** the audit has zero differences, `/api/v1/status` advances, and
real explore, wallet, subnet, and relic pages agree with chain evidence.

## 8. Exercise transfer and marketplace invalidation

Transfer the test relic to a second testnet account and download its receipt.
Create a signed discovery listing before transfer and prove that transfer,
cancellation, and expiry each remove it from active results.

**Ready when:** the transfer independently matches the indexed ownership
history and no stale listing remains active. Purchase and settlement stay off.

## 9. Run the adversarial beta

Complete an independent security review, configure indexer lag/error and Vercel
runtime alerts, and run a limited public testnet beta. Treat unknown runtime
specs, index divergence, and unexplained wallet behavior as stop conditions.

**Ready when:** no high-severity finding remains and the observation window is
recorded without an unresolved alert.

## 10. Approve, promote, observe, or roll back

Assemble the exact-SHA release record, obtain explicit approval, merge without
rewriting history, and promote the verified deployment. Recheck read paths and
wallet intent immediately, then observe the beta window continuously.

**Ready when:** production evidence and the previous known-good rollback target
are recorded. A failed check rolls the site back while preserving finalized
index data.

## Evidence control

Use [`docs/RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md) and
`npm run release:check -- <release-record.json>` to keep all ten gates attached
to one candidate. The checker cannot sign transactions or approve a release; it
prevents missing or mismatched evidence from being mistaken for readiness.
