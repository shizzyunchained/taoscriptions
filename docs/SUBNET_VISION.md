# Bittensor Relics subnet vision

## Narrative

Bittensor Relics begins as a useful non-EVM dapp and is designed to mature into
a decentralized relic proof network. The website is the first consumer of that
network, not the network itself.

The commodity is not generic database hosting. Miners continuously reconstruct
canonical Relics state from finalized Subtensor history and serve fast,
verifiable answers. Validators independently replay the same public history,
challenge miners, and reward exactness, freshness, availability, historical
coverage, and proof quality.

## Miner responsibilities

- Follow finalized Subtensor blocks from the published activation block.
- Apply the normative mint, transfer, ownership, numbering, and rejection rules.
- Preserve and verify exact on-chain image bytes.
- Publish deterministic checkpoint roots and signed service manifests.
- Answer current-state, historical, proof, and media queries.
- Support clean replay from chain without a privileged database snapshot.

## Validator responsibilities

- Maintain an independent reference replay.
- Sample unpredictable finalized blocks and artifact histories.
- Verify checkpoint roots, accepted and rejected operations, ownership, ordinal
  numbers, media hashes, and response freshness.
- Penalize missing history, divergent state, unverifiable answers, and downtime.
- Use commit-reveal weights so copying another validator is less useful.

## Dapp trust rule

The production gateway should query multiple miners. It accepts a response only
when a configured threshold agrees on the canonical checkpoint and answer. A
single miner may improve latency but can never redefine ownership or numbering.
Subtensor remains the ultimate source of truth.

## Path to launch

1. Ship and exercise the deterministic reference indexer on testnet.
2. Publish canonical fixtures, checkpoint hashing, and challenge vectors.
3. Run several independent indexers and measure divergence and recovery.
4. Build miner and validator processes around the same conformance suite.
5. Test adversarial scoring on localnet and Bittensor testnet.
6. Budget live registration cost, validator operations, security review, and
   runway using current chain state—not an assumed future slot price.
7. Register only after the commodity and incentive mechanism work without
   privileged validators.

## Capacity expansion

Additional subnet slots improve the strategic opening for specialized
commodities such as verifiable indexing. They do not guarantee an inexpensive
registration: the live registration lock is dynamic. Public language should
describe Bittensor Relics as subnet-bound or subnet-ready until registration is
finalized, and should never imply that a netuid is already secured.
