# Peach Protocol — Pre-Production Architecture & Bug Audit

> **Volatility-Insured Payment Streaming on Sui**
> Automated downside protection via Pyth Network oracles + DeepBook V3 CLOB spot swaps.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack](#tech-stack)
4. [Smart Contract Architecture](#smart-contract-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [On-Chain Constants (Testnet)](#on-chain-constants-testnet)
7. [Data Flow](#data-flow)
8. [Bug Audit — Pre-Prod Issues](#bug-audit--pre-prod-issues)
9. [Running Locally](#running-locally)

---

## Architecture Overview

Peach is a DeFi protocol that wraps standard payment streams with an automated volatility-insurance layer. When an employer streams SUI to an employee, the contract monitors the live SUI/USD price via Pyth Network. If the spot price falls below a user-defined strike price, the contract atomically swaps the claimable SUI into USDC through DeepBook V3's on-chain CLOB — preserving the employee's purchasing power without requiring any manual intervention.

```
Employer (Sender)
    │
    ▼  create_stream(SUI, strike_price)
┌──────────────────────────────────────────┐
│        PeachStream Shared Object         │
│  ┌────────────┐    ┌──────────────────┐  │
│  │ SUI Escrow │    │  Strike Config   │  │
│  │  (Balance) │    │  (Pyth 8-dp)    │  │
│  └────────────┘    └──────────────────┘  │
└──────────────────────────────────────────┘
    │                          │
    ▼  claim_stream()          ▼  Pyth Oracle Check
┌────────────┐          ┌─────────────────┐
│  spot >= strike        │  spot < strike  │
│  → Transfer SUI       │  → DeepBook V3  │
│    directly            │    swap SUI→USDC│
└────────────┘          └─────────────────┘
    │                          │
    ▼                          ▼
  Employee receives SUI    Employee receives USDC
```

---

## Monorepo Structure

```
peach-monorepo/
├── apps/
│   └── frontend/          # Next.js 16 + React 19 dashboard & landing
│       ├── .agents/skills/  # AI agent skill files (22 skills)
│       ├── design.md        # Comprehensive design system document
│       └── src/             # Application source
├── packages/
│   ├── peach_contracts/   # Move smart contracts (Sui)
│   ├── pyth_sdk/          # Pyth Network SDK (local git dep for Move)
│   └── wormhole_sdk/      # Wormhole SDK (local git dep for Move)
├── package.json           # Root workspace config (npm workspaces)
├── turbo.json             # Turborepo pipeline (build, lint, dev)
└── README.md              # This file
```

- **Workspace Manager:** npm workspaces + Turborepo v2.9
- **Node Requirement:** >= 22
- **Package Manager:** npm 11.4.2

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.9 |
| UI Library | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Animation | GSAP + @gsap/react | 3.15 |
| Charts | Recharts | 3.8 |
| Blockchain | Sui (Move) | Testnet |
| Wallet | @mysten/dapp-kit | 1.1+ |
| Sui SDK | @mysten/sui | 2.18+ |
| Oracle | Pyth Network (pyth-sui-js) | 3.0 |
| DEX | DeepBook V3 (@mysten/deepbook-v3) | 1.5 |
| Build | Turborepo | 2.9 |

---

## Smart Contract Architecture

**Package:** `peach_contracts`
**Language:** Move (Sui, 2024 edition)
**Deployed:** Sui Testnet at `0x2aa14e462834baf26ab9c223f0a202005cd21db392d07bcc1654eb1068b399f5`

### Core Struct: `PeachStream<USDC>`

```move
public struct PeachStream<phantom USDC> has key {
    id: UID,
    sender: address,          // Employer
    receiver: address,        // Employee
    total_amount: u64,        // Total escrowed SUI (in MIST)
    withdrawn: u64,           // Cumulative SUI already settled
    balance: Balance<SUI>,    // Live SUI escrow pool
    start_time: u64,          // Stream start (ms epoch)
    end_time: u64,            // Stream end (ms epoch)
    strike_price: u64,        // Pyth-scaled floor (8dp: $1.00 = 100_000_000)
    usdc_balance: Balance<USDC>,
    is_fully_hedged: bool,
}
```

### Entry Functions

| Function | Caller | Description |
|----------|--------|-------------|
| `create_stream<USDC>` | Sender | Escrows SUI, sets timeline + strike price |
| `claim_stream<USDC>` | Receiver | Claims time-unlocked portion; auto-hedges if spot < strike |
| `cancel_stream<USDC>` | Sender | Settles earned amount to receiver, refunds remainder |

### External Dependencies (On-Chain)

- **Pyth Network** — `get_price_no_older_than()` for live SUI/USD price (max 60s staleness)
- **DeepBook V3** — `swap_exact_base_for_quote<SUI, USDC>()` for atomic spot swap
- **DEEP Token** — DeepBook taker fee token (passed as zero-coin when unused)

### Events Emitted

- `StreamCreated { stream_id, sender, receiver, total_amount, strike_price }`
- `StreamClaimed { stream_id, claimer, sui_claimed, usdc_hedge_out, execution_price }`
- `HedgeTriggered { stream_id, spot_price, strike_price, sui_swapped }`
- `StreamCanceled { stream_id, sender, receiver, receiver_settled_sui, sender_refunded_sui }`

---

## Frontend Architecture

### Route Map

| Route | Purpose |
|-------|---------|
| `/` | Landing page (GSAP cinematic hero, scroll animations) |
| `/login` | Sui wallet connect (auto-redirect if already connected) |
| `/docs` | Whitepaper / technical documentation |
| `/dashboard` | Main overview: stream queue, metrics, DeepBook chart |
| `/dashboard/create` | Deploy new stream form (PTB builder) |
| `/dashboard/streams` | Live active streams with claim/cancel actions |
| `/dashboard/insurance` | Pyth-gated protection status + hedge fire log |
| `/dashboard/treasury` | Corporate treasury: locked SUI, salvage ledger |
| `/dashboard/history` | Full on-chain transaction history |

### Key Components

| Component | Role |
|-----------|------|
| `SuiProvider` | @mysten/dapp-kit wallet + chain context |
| `ToastProvider` | Global notification system |
| `TickingStreamRow` | Real-time animated stream with claim/cancel PTB |
| `ProtectionShieldGraph` | Live DeepBook V3 mid-price chart (Recharts) |
| `MicroPremiumLedger` | On-chain event feed for StreamCreated |

### PTB (Programmable Transaction Block) Patterns

The frontend builds complex multi-step transactions:

1. **Create Stream:** `splitCoins(gas) → moveCall(create_stream)`
2. **Claim Stream:** `updatePythFeed() → coin::zero<DEEP>() → moveCall(claim_stream)`
3. **Cancel Stream:** `updatePythFeed() → coin::zero<DEEP>() → moveCall(cancel_stream)`

---

## On-Chain Constants (Testnet)

| Constant | Address |
|----------|---------|
| PEACH_PACKAGE_ID | `0x2aa14e462834baf26ab9c223f0a202005cd21db392d07bcc1654eb1068b399f5` |
| DEEPBOOK_SUI_USDC_POOL_ID | `0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5` |
| PYTH_STATE_ID | `0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c` |
| PYTH_SUI_USD_PRICE_INFO | `0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266` |
| WORMHOLE_STATE_ID | `0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790` |
| USDC_TYPE | `0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC` |

---

## Data Flow

```
┌─────────────────── CLIENT (Next.js) ───────────────────┐
│                                                         │
│  1. User fills form (amount, recipient, strike)         │
│  2. Frontend builds PTB:                                │
│     a. Fetch Pyth VAA from Hermes REST API              │
│     b. Call pyth::update_single_price_feed()            │
│     c. Call peach_stream::claim_stream() or create      │
│  3. Sign via @mysten/dapp-kit wallet adapter            │
│  4. Submit to Sui Testnet full node                     │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────── ON-CHAIN (Sui) ─────────────────────┐
│                                                         │
│  PeachStream shared object:                             │
│    • Linear time-decay unlock (compute_claimable)       │
│    • Pyth oracle price check (60s max staleness)        │
│    • If spot < strike → DeepBook V3 swap SUI→USDC      │
│    • Events emitted for frontend indexing               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Bug Audit — Pre-Prod Issues

### Critical (P0) — Causes Incorrect Behavior

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 1 | `src/components/MicroPremiumLedger.tsx:14` | **Hardcoded stale `PACKAGE_ID`** (`0x23b6...`) instead of importing from `@/lib/constants.ts` (`0x2aa1...`). | Component queries events from the wrong (old) contract deployment. Dashboard shows no data or stale data. |
| 2 | `src/app/dashboard/treasury/page.tsx:56-63` | **Race condition in Pyth price fetch.** The `fetch()` for live spot price is async but `activeSpot` is used synchronously below it in the same `useEffect`. The state calculations use the initial `1.42` fallback before the fetch resolves. | Treasury USDC Value and Hedging Premium always show stale/incorrect USD amounts on first render. |

### High (P1) — Performance / React Anti-Patterns

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 3 | `src/app/dashboard/insurance/page.tsx:83` | **`setState` called synchronously inside `useEffect` body** (`setHedgeEvents(events)`). React 19 strict mode flags this as triggering cascading renders. | Unnecessary re-render cascade; potential performance issues with large event sets. |
| 4 | `src/components/TickingStreamRow.tsx:146` | **`setBalance()` called synchronously in effect** before `requestAnimationFrame` loop starts. | ESLint error; extra initial render cycle. |
| 5 | `src/components/ProtectionShieldGraph.tsx:33` | **Missing `suiClient` in `useEffect` dependency array.** The effect uses `suiClient` but only has `[]` deps. | If the Sui client instance changes (network switch), the chart will not reconnect. Stale closure risk. |

### Medium (P2) — Code Quality / DX

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 6 | `create-pyth-feed.ts:4` | **Uses deprecated `getFullnodeUrl` and `SuiClient` imports** from `@mysten/sui/client`. The v2.18+ SDK moved these. | TypeScript compilation error — script cannot be executed without patching. |
| 7 | `src/app/dashboard/create/page.tsx:13` | **Unused import `SUI_CLOCK_OBJECT_ID`**. | Lint warning; dead code. |
| 8 | `src/app/dashboard/insurance/page.tsx:4` | **Unused import `DollarSign`** from lucide-react. | Lint warning; increases bundle. |
| 9 | `src/components/TickingStreamRow.tsx:5` | **Unused import `useRef`** from React, unused `useState` for `isProcessing`. | Lint warnings. |
| 10 | `packages/peach_contracts/tests/` | **All tests are commented-out stubs.** No unit or integration tests for the Move contract. | Zero test coverage on safety-critical financial logic. |

### Low (P3) — UX / Documentation Gaps

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 11 | `TickingStreamRow.tsx` (claim/cancel handlers) | **No user-facing success/error toast** after claim or cancel. Only `console.log`. | Users get no feedback on whether their transaction succeeded (unlike create which toasts). |
| 12 | Root project | **No `.env.example` file.** | New developers have no guidance on required environment variables. |
| 13 | Dashboard/README | **"DeepBook Predict" terminology** used in UI copy and README, but the actual contract implements spot swaps via `swap_exact_base_for_quote`, not options/predict. | Misleading UX copy. The "Implied Volatility" and "Put Options" display on the dashboard is cosmetic/aspirational. |
| 14 | `src/app/dashboard/page.tsx` | **`impliedVolatility` is a fake calculated metric** (`42.1 + (totalVolume * 0.15)`). Not derived from any real oracle or model. | Potentially misleading to users who expect real data. |

---

## Design System

The frontend follows a strict design document located at `apps/frontend/design.md`. Key principles:

- **Dark mode only.** No light theme. Near-black surfaces with layered luminance depth.
- **Zero gradients.** Flat fills exclusively. Glow via blurred pseudo-elements at extreme low opacity.
- **Glassmorphism** for overlays and sidebars only; solid backgrounds for data cards.
- **GSAP motion** via `useGSAP` hook with `scope` for automatic cleanup. No raw `useEffect` + GSAP.
- **Peach accent (#FF8B5E)** on a maximum of 2 elements per viewport.

Full component guidelines, typography scale, spacing grid, and anti-pattern list are in `design.md`.

## Installed Skill Agents

| Package | Skills | Purpose |
|---------|--------|---------|
| `emilkowalski/skill` | `emil-design-eng` | UI polish, animation philosophy |
| `Leonxlnx/taste-skill` | 13 skills | Design heuristics, brand consistency |
| `greensock/gsap-skills` | 8 skills (core, react, scrolltrigger, etc.) | GSAP best practices |

---

## Running Locally

```bash
# Prerequisites
node >= 22
npm >= 11

# Install dependencies
npm install

# Run the frontend dev server
npm run dev

# Build all packages
npm run build

# Lint
npm run lint
```

### Move Contract (requires Sui CLI)

```bash
cd packages/peach_contracts
sui move build
sui move test          # Note: tests are currently stubs
sui client publish --gas-budget 100000000
```

---

## Testnet Deployment Status

| Component | Status |
|-----------|--------|
| Move Contract (peach_stream) | Deployed (v1) |
| Pyth SUI/USD Feed | Active |
| DeepBook SUI/USDC Pool | Active |
| Frontend (Vercel/local) | Pre-production |

---

*Last audited: June 17, 2026*
