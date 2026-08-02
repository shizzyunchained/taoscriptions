# Neural Relics Security Model

## Protected assets

- user TAO and alpha;
- wallet authorization and signatures;
- deterministic artifact numbering and ownership;
- burn provenance;
- media integrity;
- production index and database availability.

## Non-negotiable invariants

1. The application never receives or stores a seed phrase or private key.
2. A mint is accepted only when its matching alpha burn and inscription
   succeeded in the same finalized atomic extrinsic.
3. Requested burn amounts never substitute for actual burn events.
4. Best-chain or pending operations never receive canonical numbers.
5. A runtime upgrade never gets decoded using guessed metadata.
6. Mainnet remains disabled until testnet replay and adversarial tests pass.
7. Marketplace payment remains disabled until payment and protocol ownership
   transfer are chain-enforced as one no-loss outcome.

## Initial threat checklist

- copied or front-run inscription payload;
- forged burn amount in JSON;
- `batch` substituted for `batch_all`;
- failed inner call with apparently successful outer submission;
- subnet deregistration and netuid reuse;
- duplicate JSON keys or parser differences;
- reorg before finality;
- replayed transfer or listing signatures;
- malicious media, MIME confusion, and gateway substitution;
- wallet connected to the wrong genesis hash;
- stale quote or intentionally loose price limit;
- indexer restart, duplicate block delivery, and partial database commit;
- unknown runtime call/event layout after an upgrade;
- seller cancellation, double sale, or ownership race during marketplace
  settlement.

Each item requires an automated test or an explicit documented launch-time
mitigation before mainnet activation.
