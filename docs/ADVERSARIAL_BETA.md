# Bittensor Relics adversarial beta runbook

This runbook is the evidence boundary for launch gates 8–10. A green build is
not a substitute for the wallet-signed chain action, independent review, or
observation time required by these gates.

## Gate 8: transfer and invalidate a listing

1. Connect the current owner in **My Relics** and list one low-value testnet
   Relic. Save its listing ID.
2. Transfer that same Relic to a second testnet account and download the
   finalized transfer receipt.
3. Wait for the finalized indexer to show the new owner and incremented
   ownership nonce.
4. Run:

   ```bash
   npm run verify:marketplace-beta -- \
     --artifact "br1:..." \
     --listing "0x..." \
     --out "marketplace-invalidation.json"
   ```

The verifier requires a finalized transfer, matching current ownership, an
ownership-invalidated pre-transfer listing, and absence of that listing from
active marketplace results. Cancellation or expiry does not pass the transfer
test.

## Gate 9: adversarial beta

The scheduled production-health workflow checks the production pages, expected
testnet genesis, indexer checkpoint age, security headers, disabled settlement,
and every active listing's current owner and ownership nonce four times per
hour. A failed scheduled workflow is an alert and a stop condition.

An independent reviewer must still examine wallet intent construction,
signature verification, indexer parsing, listing invalidation, transfer replay,
API authorization, denial-of-service limits, dependency risk, and the disabled
settlement boundary. Record the reviewer, scope, commit SHA, findings, fixes,
and retest evidence. The beta observation clock starts only after no high
severity finding remains.

## Gate 10: approve or roll back

Do not mark gate 10 complete until gates 1–9 have immutable evidence tied to
one commit. Record the approver, production deployment ID, production URL,
promotion time, and immediately previous verified deployment. Re-run
`npm run verify:production` after promotion. Any wrong genesis, stale
checkpoint, stale listing, failed proof page, or unexpected settlement state
requires rollback of the website while leaving finalized index data intact.
