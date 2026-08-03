# Bittensor Relics release evidence

Every production candidate gets one JSON release record. Copy
`docs/release-record.template.json`, fill it as gates are completed, and keep
the evidence references immutable. Never place database URLs, wallet secrets,
API tokens, or seed phrases in the record.

Run:

```bash
npm run release:check -- path/to/release-record.json
```

The command reports every missing gate and exits unsuccessfully until all ten
steps are complete. It also rejects a malformed candidate SHA, non-testnet
release, duplicate or out-of-order steps, missing required evidence keys, and
evidence attached to a different commit.

Each evidence item has:

- `key`: one of the stable evidence names below;
- `value`: a URL, deployment ID, transaction identifier, or retained report
  path that a reviewer can open;
- `commitSha`: the exact release candidate SHA.

Required keys by gate:

1. `brand_protocol_review`, `candidate_commit`
2. `ci_run`, `runtime_run`, `transaction_report`
3. `wallet_rejection`, `wrong_genesis`, `stale_quote`, `insufficient_balance`
4. `mint_receipt`
5. `mint_verification`
6. `primary_doctor`, `replay_doctor`
7. `replay_audit`, `status_api`
8. `transfer_receipt`, `listing_invalidation`
9. `security_review`, `monitoring`, `beta_observation`
10. `approval`, `production_deployment`, `rollback_target`

The evidence checker is a completeness and consistency gate. Reviewers still
inspect the referenced reports, chain proofs, wallet recordings, security
findings, and deployment before approving promotion.
