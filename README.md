# Neural Relics

Neural Relics is a non-EVM Bittensor application for forging numbered digital
artifacts by atomically buying and burning subnet alpha. The chain proves the
burn and inscription; a deterministic indexer derives artifact numbers and
ownership from finalized blocks.

The current branch is deliberately testnet-first. It reads live subnet
identities and alpha quotes, connects to an injected SS58 wallet, and keeps the
transaction action locked until the complete atomic mint path is verified.

## What makes a relic

A v1 mint is one `utility.batchAll` extrinsic containing:

1. `subtensorModule.addStakeBurn` for the selected subnet, with an explicit
   price limit.
2. `system.remarkWithEvent` containing a canonical Neural Relics inscription.

If either call fails, both calls roll back. See [the protocol](docs/PROTOCOL.md),
[indexer rules](docs/INDEXER.md), [security model](docs/SECURITY.md), and
[delivery roadmap](docs/ROADMAP.md).

## Safety boundary

- Testnet before mainnet
- No seed phrases or private keys handled by the website
- No EVM and no subnet
- Finalized blocks only
- Marketplace settlement remains disabled until payment and derived ownership
  can be made loss-safe

## Local development

```bash
npm install
npm run verify:runtime
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default RPC is
`wss://test.chain.opentensor.ai`; override it with
`NEXT_PUBLIC_SUBTENSOR_RPC`.

## Verification

```bash
npm run lint
npm run build
npm run verify:runtime
npm run test:indexer
```

The finalized-block worker lives in `indexer/`. It requires an explicit
`DATABASE_URL` and `START_BLOCK`; see `docs/INDEXER.md` before deploying it.

## Deployment

Production remains on the protected `main` branch. Feature work is deployed to
a Vercel preview first, verified against testnet, and only then considered for
promotion.
