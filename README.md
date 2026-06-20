# Peach Protocol 🍑

> **Volatility-Insured Payment Streaming on Sui**

Peach is a DeFi protocol that converts static payment streams into Autonomous Self-Hedging Insurance Vaults. By pairing real-time Pyth oracle price feeds with DeepBook V3 CLOB on-chain liquidity, it automatically triggers asset adjustments to guarantee the real-world value of the payment stream.

## 📦 Monorepo Structure

- `apps/frontend`: Next.js 16 + React 19 dashboard & landing
- `packages/peach_contracts`: Sui Move smart contracts
- `packages/pyth_sdk` & `packages/wormhole_sdk`: Local SDK dependencies

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, GSAP, Recharts
- **Blockchain**: Sui (Move), DeepBook V3
- **Oracle**: Pyth Network
- **Tooling**: Turborepo, npm workspaces

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22
- npm >= 11
- Sui CLI

### Running Locally

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

### Smart Contracts

```bash
cd packages/peach_contracts
sui move test
```
