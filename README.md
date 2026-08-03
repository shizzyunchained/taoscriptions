# Bittensor Relics

Bittensor Relics is a non-EVM Bittensor application for forging numbered digital
artifacts by atomically buying and burning subnet alpha. The chain proves the
burn and inscription; a deterministic indexer derives artifact numbers and
ownership from finalized blocks. The dapp is the first product; the planned
destination is a miner-served, validator-verified Bittensor subnet for relic
indexing and proofs.

The current branch is deliberately testnet-first. It reads live subnet
identities and alpha quotes, connects to an injected SS58 wallet, builds atomic
mint transactions, exposes finalized collections and proof pages, and provides
wallet-native ownership transfers plus signed marketplace discovery.

## What makes a relic

A v1 mint is one `utility.batchAll` extrinsic containing:

1. `subtensorModule.addStakeBurn` for the selected subnet, with an explicit
   price limit.
2. `system.remarkWithEvent` containing a canonical Bittensor Relics inscription.

If either call fails, both calls roll back. See [the protocol](docs/PROTOCOL.md),
[indexer rules](docs/INDEXER.md), [security model](docs/SECURITY.md), and
[next ten launch gates](docs/ROADMAP.md). The finalized-state endpoints are
described in [the API reference](docs/API.md). Preview promotion is governed by
the [launch checklist](docs/LAUNCH_CHECKLIST.md) and a machine-checked
[release evidence record](docs/RELEASE_EVIDENCE.md).

## Safety boundary

- Testnet before mainnet
- No seed phrases or private keys handled by the website
- No EVM; the current dapp does not require a subnet to work
- Finalized blocks only
- Marketplace settlement remains disabled until payment and derived ownership
  can be made loss-safe
- Listings are discovery authorizations only and cannot move funds or ownership

The `/wallet` workspace reads the connected account's finalized collection.
Transfer review refreshes ownership without CDN caching, validates the next
nonce and destination, estimates the testnet fee, and asks TAOStats Wallet to
sign the exact standalone `remarkWithEvent` call. Relic pages also let the
signing owner cancel an active listing without an on-chain transaction.

## Local development

```bash
npm install
npm run verify:runtime
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default RPC is
`wss://test.chain.opentensor.ai`; override it with
`NEXT_PUBLIC_SUBTENSOR_RPC`. The browser also pins
`NEXT_PUBLIC_CHAIN_GENESIS_HASH` and fails closed if that endpoint serves a
different chain. Public subnet lists and quotes are read through the server-side
HTTPS endpoint configured by `SUBTENSOR_HTTP_RPC`, so a browser WebSocket outage
cannot leave the forge selector blank. The forge also uses the public HTTPS RPC
for transaction construction, submission, and finalized-block polling, avoiding
shared WebSocket subscription exhaustion while preserving wallet-native signing.

## Verification

```bash
npm run lint
npm run build
npm run verify:runtime
npm run verify:transaction # constructs and quotes; never signs or submits
npm run verify:mint-evidence -- downloaded-proof.json # read-only chain replay
npm run release:check -- release-record.json # fails until all ten gates agree
npm run test:indexer
npm run indexer:doctor # requires a migrated database and explicit START_BLOCK
npm run indexer:audit # requires primary + independent replay databases
```

The finalized-block worker lives in `indexer/`. It requires an explicit
`DATABASE_URL` and `START_BLOCK`; see `docs/INDEXER.md` before deploying it.

## Deployment

Production remains on the protected `main` branch. Feature work is deployed to
a Vercel preview first, verified against testnet, and only then considered for
promotion. Pull requests run deterministic CI and live Bittensor compatibility
against their exact head commit; the compatibility workflow also runs daily and
can be triggered manually before a release.
