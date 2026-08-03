# Infrastructure decision

## Subnet-first rule

Bittensor Relics evaluates a Bittensor subnet before choosing conventional
infrastructure. A fallback is accepted only when no currently public subnet
meets the service requirement, and every fallback must remain replaceable.

## Current deployment split

| Responsibility | Current home | Why |
| --- | --- | --- |
| Canonical relic, image, burn and transfer evidence | Subtensor | Finalized chain data is the source of truth. |
| Public subnet lists and alpha quotes | Bittensor testnet HTTPS RPC through Vercel | Removes unreliable browser WebSocket reads while preserving genesis pinning. |
| Transaction signing | User's injected SS58 wallet | The site never receives a seed phrase or private key. |
| Search, numbering, ownership and marketplace views | Replaceable Node worker + PostgreSQL | Requires an always-on process and relational checkpoints. |
| Encrypted index snapshots and audit bundles | Hippius S3, once credentials are provisioned | Bittensor-native decentralized object storage is available today. |

## Why the indexer is not fully on a subnet yet

Hippius object storage is public and S3-compatible, but its Console virtual
machine workflow is still documented as coming soon. ComputeHorde is designed
for on-demand compute jobs, and Chutes is oriented toward containerized AI/GPU
applications; neither currently supplies the durable Node worker plus managed
PostgreSQL contract this indexer requires.

The conventional worker and database are therefore derived caches, never the
authority. They can be erased and rebuilt from finalized Subtensor blocks. The
deployment should migrate to a Bittensor-native VM/database service when one is
public, persistent, observable, and supports deterministic replay.

## Hippius activation gate

Do not upload user images to Hippius as the canonical copy. On-chain image bytes
remain canonical. Enable Hippius only for encrypted snapshots after access keys
are provisioned, bucket lifecycle and recovery are tested, and a restored
database produces the same checkpoint and artifact hashes as a clean chain
replay.
