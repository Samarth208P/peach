# Peach Protocol 🍑

> **Volatility-Insured Payment Streaming on Sui**

Peach is a DeFi protocol that converts static payment streams into Autonomous Self-Hedging Insurance Vaults. By pairing real-time Pyth oracle price feeds with DeepBook V3 CLOB on-chain liquidity, it automatically triggers asset adjustments to guarantee the real-world value of the payment stream.

## 📦 Monorepo Structure

- `apps/frontend`: Next.js 16 + React 19 dashboard & landing
- `apps/keeper`: Autonomous keeper service (TWAP hedge engine, auto-claim, price monitoring)
- `packages/peach_contracts`: Sui Move smart contracts
- `packages/pyth_sdk` & `packages/wormhole_sdk`: Local SDK dependencies

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, GSAP, Recharts
- **Keeper**: Node.js 22, TypeScript, Fastify (dashboard API), Pino (logging)
- **Blockchain**: Sui (Move), DeepBook V3
- **Oracle**: Pyth Network
- **Tooling**: Turborepo, npm workspaces

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

## 🤖 Keeper Service

The keeper (`apps/keeper`) is an autonomous service that:

- **Monitors price feeds** via Pyth Network websocket
- **Detects hedge breaches** and executes TWAP trades on DeepBook V3
- **Auto-claims matured streams** pushing funds to receivers
- **Exposes a dashboard API** on port 3001

### Resilient RPC Architecture

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
