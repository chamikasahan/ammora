# Ammora LaunchPad

A React + TypeScript launchpad for the reviewed Ammora V4 deployment on GIWA Sepolia. It reads launches and enabled Configs from the Ammora Data API, reads curve/config state from chain, and uses the official SDK to build wallet-confirmed launch, trade, and migration transactions.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
- wagmi + viem
- @ammora-protocol/sdk 0.3.9
- React Router

## Network

The app is configured for GIWA Sepolia:

- Chain ID: 91342
- RPC: https://sepolia-rpc.giwa.io
- Explorer: https://sepolia-explorer.giwa.io
- Data API: https://ammora-giwa-sepolia-data.fly.dev

RPC and explorer endpoints can be overridden with the Vite variables in `.env`. The Data API is routed through `/ammora-api` to avoid browser CORS restrictions; Vite and Vercel proxy that same-origin path to the public Ammora Data API.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm run dev
```

## Production build

```bash
npm run build
```

## Notes

- The app writes only against the SDK's reviewed GIWA Sepolia V4 auto-route deployment. Earlier protocol generations remain discoverable but are read-only here.
- Token metadata must already be hosted at an HTTPS or IPFS URI; the browser app does not upload or pin files.
- Curve trades use an exact-input SDK quote, approval preflight, transaction simulation, and receipt parsing. Graduation migration is a separate transaction.
- This testnet app is not audited and should not be used with real funds.
- GitHub hosting and Vercel deployment are external steps that must be completed in the deployment environment with repository access and a Vercel account.
