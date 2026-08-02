# Neural Relics launch checklist

This is the promotion contract from a protected testnet preview to production.
No single green build overrides a missing chain, indexer, or wallet gate.

## 1. Source and review evidence

- [ ] Release commit is on a reviewed pull request from a feature branch.
- [ ] `Neural Relics CI / Build and protocol verification` passes on that exact
      commit.
- [ ] No unresolved high-severity review or security findings remain.
- [ ] Production dependency audit reports no high or critical vulnerabilities.
- [ ] `main` still points to the previously known-good production release until
      every later section is signed off.

## 2. Runtime compatibility

- [ ] A `Bittensor Runtime Compatibility` run passed on the release commit in
      the previous 24 hours.
      Pull requests trigger this live workflow on every revision, binding the
      result to the exact head SHA.
- [ ] The recorded genesis hashes match the intended mainnet and testnet.
- [ ] The recorded runtime specs are explicitly supported by the indexer.
- [ ] Required calls, storage entries, and events all remain present.
- [ ] `npm run verify:transaction` passed on the release commit and its report
      says `submitted: false`, with the expected atomic call path.

## 3. Wallet and testnet transaction evidence

- [ ] TAOStats Wallet review was exercised in the Vercel preview.
- [ ] One real testnet mint finalized through
      `batchAll(addStakeBurn, remarkWithEvent)`.
- [ ] The launch record contains genesis hash, block number/hash, extrinsic
      index/hash, signer, subnet generation, requested TAO, limit price, actual
      alpha burned, payload hash, and transaction fee.
- [ ] Finalized events include `BatchCompleted`, `AlphaBurned`, `AddStakeBurn`,
      `Remarked`, and `ExtrinsicSuccess`, with no dispatch error.
- [ ] Stale quote, insufficient balance, wallet rejection, and wrong-genesis
      paths fail without submission.

## 4. Indexer and replay evidence

- [ ] `START_BLOCK` is the finalized block immediately before the first accepted
      protocol candidate.
- [ ] Primary Postgres migration completed before the worker started.
- [ ] The primary worker reached the current finalized head and emits healthy
      heartbeats with bounded lag.
- [ ] A second empty Postgres database replayed the identical block range.
- [ ] `npm run indexer:audit` passed with zero dataset differences; its JSON
      output is retained with the release record.
- [ ] Read APIs return the same artifact IDs, numbers, ownership, transfers, and
      rejection decisions as the audit databases.

## 5. Marketplace safety

- [ ] Listing creation and cancellation signatures verify in TAOStats Wallet.
- [ ] Transfer or expiry invalidates an active listing.
- [ ] No purchase, payment, escrow, or settlement endpoint is enabled.
- [ ] UI still labels marketplace data as signed discovery only.

## 6. Vercel preview verification

- [ ] Preview deployment is built from the exact release commit.
- [ ] `/`, `/explore`, `/marketplace`, `/wallet`, and a real `/relic/:id` load.
- [ ] `/api/v1/status` reports the intended chain and an advancing checkpoint.
- [ ] Wallet actions target the intended genesis and show all reviewed values.
- [ ] Vercel build and runtime error logs contain no unexplained failures.
- [ ] Production domain and deployment remain unchanged during verification.

## 7. Promotion and observation

- [ ] Merge the reviewed release commit to `main` without rewriting history.
- [ ] Promote the verified deployment or allow the protected production build;
      do not upload an unrelated local tree.
- [ ] Recheck the production domain, status API, wallet connection, and one
      read-only artifact proof immediately after promotion.
- [ ] Observe Vercel errors and indexer heartbeats continuously during the beta
      window before enabling any broader mainnet action.
- [ ] Record approver, commit SHA, deployment ID, UTC time, and all evidence links.

## Rollback

If the website regresses, roll Vercel back to the immediately previous verified
production deployment and leave the indexer database intact. If the worker
encounters an unknown runtime or inconsistent evidence, stop or pause the
worker at its last committed checkpoint; never skip the block or rewrite
accepted finalized history. Marketplace settlement and mainnet minting remain
disabled during investigation. Resume only with a reviewed compatibility fix
and a fresh replay audit.
