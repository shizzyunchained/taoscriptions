# TAOscriptions

The native inscription experience for Subtensor. This first milestone connects
to an injected Bittensor wallet, displays the selected SS58 account, and reads
its testnet TAO balance.

## Safety

- Testnet only
- No minting or transfer calls
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
