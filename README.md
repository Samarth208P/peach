# Peach Protocol 🍑

> **Volatility-Insured Payment Streaming on Sui**

## 🛑 The Problem
In the fast-moving world of decentralized finance (DeFi), real-time payment streams often suffer from price volatility. If a contributor is being streamed $1,000 worth of SUI over a month, a market crash can drastically reduce the real-world value of that stream before they can claim it. This creates uncertainty and financial risk for receivers relying on these streams.

## 💡 The Solution
**Peach** is a DeFi protocol that converts static payment streams into **Autonomous Self-Hedging Insurance Vaults**. By pairing real-time **Pyth oracle price feeds** with **DeepBook V3 CLOB** on-chain liquidity, Peach automatically triggers asset adjustments (hedging) to guarantee the real-world USD value of the payment stream. If the price of SUI drops, the protocol automatically swaps a portion of the stream into stablecoins (USDC) to maintain the original value.

## 🏗️ Project Details
The Peach architecture consists of three main components:
1. **Frontend Dashboard (`apps/frontend`)**: A modern, highly interactive UI built with Next.js 16, React 19, Tailwind CSS 4, and GSAP. It allows users to create, monitor, and claim from their insured payment streams.
2. **Autonomous Keeper (`apps/keeper`)**: A backend Node.js service that monitors Pyth Network websockets for price updates. When a hedge breach is detected, it executes TWAP trades on DeepBook V3. It also auto-claims matured streams and exposes a dashboard API.
3. **Smart Contracts (`packages/peach_contracts`)**: Sui Move smart contracts that govern the logic of the streaming, vault balances, oracle interactions, and DeepBook swaps.

## 📦 Monorepo Structure

- `apps/frontend`: Next.js dashboard & landing page
- `apps/keeper`: Autonomous keeper service for price monitoring & TWAP hedging
- `packages/peach_contracts`: Sui Move smart contracts
- `packages/pyth_sdk` & `packages/wormhole_sdk`: Local SDK dependencies

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, GSAP, Recharts
- **Keeper**: Node.js 22, TypeScript, Fastify (dashboard API), Pino (logging)
- **Blockchain**: Sui (Move), DeepBook V3
- **Oracle**: Pyth Network
- **Tooling**: Turborepo, npm workspaces

## 📄 Smart Contract & Package IDs (Testnet)

| Component | Object / Package ID |
|-----------|----------------------|
| **Peach Package ID** | `0x6cc1814b41fb9572ca24ec48594413dc439cd03366e7586155eb566a87618eb4` |
| **Peach Registry ID** | `0x2c1cc04d4fee1a0a4a24a93f38850168451ab4f0052f6264daf155f8af5657aa` |
| **Keeper Cap Object** | `0xd38a923561d0c69212e09dffa6838f4223a349e610edaf8078d9a23523aca8e6` |
| **DeepBook V3 Package**| `0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c` |
| **DeepBook SUI/USDC Pool**| `0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5` |
| **DEEP Token Type** | `0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP` |
| **Pyth Package ID** | `0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837` |
| **Pyth State ID** | `0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c` |
| **Pyth SUI/USD Feed** | `0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266` |
| **Pyth Price Info Object** | `0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0` |
| **Wormhole State ID** | `0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790` |
| **USDC Type (DBUSDC)** | `0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC` |

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22
- npm >= 11
- Sui CLI

### Environment Setup

All environment variables live in a **single root `.env` file**. Copy the example and fill in your values:

```bash
cp .env.example .env
```

Both `apps/frontend` and `apps/keeper` load from this root file — no app-level `.env` files needed.

### Running Locally

```bash
# Install dependencies
npm install

# Start all services (frontend + keeper)
npm run start

# Or start individually
npm run dev:frontend
npm run dev:keeper
```

### Smart Contracts

```bash
cd packages/peach_contracts
sui move test
```

## 🤖 Keeper Service Resilient Architecture

The keeper uses a multi-endpoint RPC client with automatic failover:

- **Multiple RPC endpoints** configured via `SUI_RPC_ENDPOINTS` (comma-separated, with priority weights)
- **Round-robin rotation** on timeout/5xx errors — never stuck on a dead endpoint
- **Build → Sign → Execute pipeline** — separates transaction construction from submission for independent retries
- **Per-step timeouts** (90s for PTB build/resolve, 30s for signed TX submission)
- **Exponential backoff with jitter** between retries
- **Background health checks** to recover failed endpoints

Configure endpoints in `.env`:
```bash
SUI_RPC_ENDPOINTS=https://fullnode.testnet.sui.io:443|10,https://sui-testnet-rpc.publicnode.com:443|8,https://rpc-testnet.suiscan.xyz|5
```
