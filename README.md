# TAOscriptions

The native inscription experience for Subtensor. This milestone connects to an
injected Bittensor wallet, displays the selected SS58 account, reads its testnet
TAO balance, and lets the user mint a small text inscription with a signed
`system.remarkWithEvent` transaction.

## Safety

- Testnet only
- Text inscription minting through `system.remarkWithEvent`
- No transfers, marketplace ownership rules, or image storage
- No seed phrases or private keys handled by the application
- No EVM and no subnet

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The wallet connector expects
an injected Substrate-compatible browser wallet such as the TAOStats extension.

## Deploy on Vercel

Create a new Vercel project from this repository. The public testnet endpoint is
used by default and can be overridden with `NEXT_PUBLIC_SUBTENSOR_RPC`.
