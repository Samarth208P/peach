# Peach Protocol v2 — Testnet Deployment Guide

## Prerequisites

- Sui CLI installed (`sui --version` >= 1.67)
- Active Sui wallet with testnet SUI (`sui client active-address`)
- Gas budget: ~200M MIST recommended

## Step 1: Publish the Package

```bash
cd packages/peach_contracts
sui client publish --gas-budget 200000000
```

This will:
- Deploy `peach_stream` and `peach_registry` modules
- Call `init()` on both modules automatically
- Create and transfer `KeeperCap` to the publisher address
- Create and share `PeachRegistry` singleton

## Step 2: Record Published Objects

After publishing, note these from the transaction output:

```
PACKAGE_ID=<from "Published Objects" section>
KEEPER_CAP_OBJECT_ID=<from "Created Objects" — type ends in ::peach_stream::KeeperCap>
PEACH_REGISTRY_ID=<from "Created Objects" — type ends in ::peach_registry::PeachRegistry>
ADMIN_CAP_ID=<from "Created Objects" — type ends in ::peach_registry::AdminCap>
```

## Step 3: Transfer KeeperCap to Keeper Wallet

If your keeper runs on a separate wallet:

```bash
sui client transfer --to <KEEPER_WALLET_ADDRESS> --object-id <KEEPER_CAP_OBJECT_ID> --gas-budget 10000000
```

## Step 4: Update Frontend Environment

Create/update `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_PEACH_PACKAGE_ID=<PACKAGE_ID>
NEXT_PUBLIC_PEACH_REGISTRY_ID=<PEACH_REGISTRY_ID>
NEXT_PUBLIC_DEEPBOOK_PACKAGE_ID=0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270
NEXT_PUBLIC_DEEPBOOK_SUI_USDC_POOL_ID=<YOUR_POOL_ID>
NEXT_PUBLIC_DEEP_TOKEN_TYPE=0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP
NEXT_PUBLIC_PYTH_STATE_ID=0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c
NEXT_PUBLIC_PYTH_SUI_USD_PRICE_INFO_OBJECT_ID=0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266
NEXT_PUBLIC_PYTH_SUI_USD_FEED_ID=0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744
NEXT_PUBLIC_PYTH_PACKAGE_ID=0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837
NEXT_PUBLIC_WORMHOLE_STATE_ID=0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790
NEXT_PUBLIC_USDC_TYPE=<USDC_TYPE_FOR_YOUR_POOL>
NEXT_PUBLIC_PYTH_HERMES_URL=https://hermes.pyth.network
```

## Step 5: Configure Keeper Service

Create `apps/keeper/.env`:

```env
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
KEEPER_PRIVATE_KEY=<base64_private_key>
PEACH_PACKAGE_ID=<PACKAGE_ID>
KEEPER_CAP_OBJECT_ID=<KEEPER_CAP_OBJECT_ID>
DEEPBOOK_SUI_USDC_POOL_ID=<YOUR_POOL_ID>
PYTH_HERMES_URL=https://hermes.pyth.network
PYTH_SUI_USD_FEED_ID=0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744
PYTH_PRICE_INFO_OBJECT_ID=0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266
PYTH_STATE_ID=0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c
WORMHOLE_STATE_ID=0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790
USDC_TYPE=<USDC_TYPE_FOR_YOUR_POOL>
DASHBOARD_PORT=3001
```

## Step 6: Start the Keeper

```bash
cd apps/keeper
npm run dev
```

Verify at `http://localhost:3001/health`

## Step 7: Smoke Test

1. Open frontend: `cd apps/frontend && npm run dev`
2. Create a stream via `/dashboard/create`
3. Watch keeper logs for `StreamCreated` detection
4. Manipulate price below strike (testnet only)
5. Observe TWAP execution in keeper logs
6. Claim from receiver wallet — verify mixed payout

## Architecture Summary (v2)

```
┌────────────────────────────────────────────────────────────────┐
│ On-Chain (Sui Testnet)                                         │
│                                                                │
│  peach_stream module:                                          │
│    • PeachStream<USDC> — dual-asset (SUI + USDC) escrow       │
│    • KeeperCap — privileged trigger auth                       │
│    • initiate_hedge() — starts TWAP liquidation                │
│    • execute_tranche() — continues TWAP                        │
│    • fallback_hedge_trigger() — permissionless after 5min      │
│    • claim_stream() — mixed payout router                      │
│    • cancel_stream() — dual-asset SalvageVault                 │
│                                                                │
│  peach_registry module:                                        │
│    • PeachRegistry — audit ledger                              │
│    • AdminCap — fee withdrawal                                 │
└────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐      ┌──────────────────────────────┐
│ Frontend (Next.js)│      │ Keeper Service (Node.js)      │
│ • Create wizard   │      │ • Event indexer (all streams) │
│ • TWAP selector   │      │ • Pyth price monitor          │
│ • Dual-asset view │      │ • PTB builder + retry         │
│ • Claim/Cancel    │      │ • Dashboard API (:3001)       │
└──────────────────┘      └──────────────────────────────┘
```
