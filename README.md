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

Peach is a DeFi protocol that converts static payment streams into **Autonomous Self-Hedging Insurance Vaults**. By pairing real-time Pyth oracle price feeds with DeepBook V3 CLOB on-chain liquidity, the contract automatically triggers asset adjustments the exact millisecond a pre-defined risk threshold is crossed — guaranteeing the real-world value of the payment stream.

The protocol supports two hedge modes:
- **FLOOR (Payroll Protection):** When the streamed token drops below strike, swap to stablecoins to protect employee purchasing power.
- **CEILING (Supply-Chain Protection):** When spot price rises above strike, swap to stablecoins to protect the buyer's material purchasing power.

```
Employer (Sender)
    │
    ▼  create_stream(SUI, strike_price, hedge_direction)
┌──────────────────────────────────────────────────────────┐
│           PeachStream Shared Object                       │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ SUI Escrow │  │ Strike Config│  │ Hedge Accumulator│  │
│  │  (Balance) │  │ Floor/Ceiling│  │ (sub-lot buffer) │  │
│  └────────────┘  └──────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
    │                       │                    │
    ▼  claim_stream()       ▼  Pyth Oracle       ▼  Accumulator Check
┌────────────────┐   ┌──────────────┐   ┌────────────────────┐
│ No hedge needed│   │ Hedge fires  │   │ Sub-lot? Buffer it │
│ → Transfer SUI │   │ + lot >= min │   │ → Pay SUI, accrue  │
│   directly     │   │ → DeepBook   │   │   hedge debt       │
└────────────────┘   │   swap→USDC  │   └────────────────────┘
    │                └──────────────┘
    ▼                       │
  Employee receives       Employee receives USDC
  SUI (no hedge)          (volatility-insulated)
```

### Five Core Pillars

1. **Atomic Stop-Loss Execution Engine** — Evaluates `spot vs strike` on every `claim_stream` and `cancel_stream`. If breached, executes atomic DeepBook V3 swap in the same transaction.
2. **Risk-Profile Customization** — Configurable `hedge_direction` (FLOOR/CEILING/NONE) and `strike_price` per stream. Different business models get different guardrails.
3. **Hedge Rollover Accumulator** — Buffers sub-lot-size claims in `accumulated_hedge_debt`. Executes bulk swap once threshold (`min_lot_size`) is met. Prevents CLOB minimum-order-size reverts.
4. **Corporate Salvage Mechanism** — On cancellation, unearned balance is packaged into a `SalvageVault` NFT transferred to the corporate treasury, preserving active sub-resources.
5. **Historical Receipt Ledger** — `PeachRegistry` singleton tracks all streams on-chain. Rich event emissions (`StreamCreated`, `StreamClaimed`, `HedgeTriggered`, `HedgeDebtAccumulated`, `StreamCanceled`, `StreamCompleted`, `SalvageDissolved`) provide immutable audit trail.

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
│   ├── peach_contracts/   # Move smart contracts (Sui) — 2 modules
│   │   ├── sources/
│   │   │   ├── peach_stream.move    # Core streaming + hedging protocol
│   │   │   └── peach_registry.move  # On-chain audit/compliance ledger
│   │   └── tests/
│   │       └── peach_stream_tests.move  # 19 unit tests
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
**Modules:** `peach_stream` (core protocol) + `peach_registry` (audit ledger)

### Core Struct: `PeachStream<USDC>`

```move
public struct PeachStream<phantom USDC> has key {
    id: UID,
    sender: address,               // Employer/creator
    receiver: address,             // Employee/recipient
    total_amount: u64,             // Total escrowed SUI (MIST)
    withdrawn: u64,                // Cumulative SUI settled
    balance: Balance<SUI>,         // Live escrow pool
    start_time: u64,               // Stream start (ms epoch)
    end_time: u64,                 // Stream end (ms epoch)
    strike_price: u64,             // Pyth-scaled threshold (8dp)
    hedge_direction: u8,           // 0=FLOOR, 1=CEILING, 2=NONE
    accumulated_hedge_debt: u64,   // Sub-lot buffer (MIST)
    min_lot_size: u64,             // Min swap size for DeepBook
    hedge_triggered: bool,         // Has hedge ever fired?
    total_hedged_amount: u64,      // Total SUI swapped to USDC
}
```

### SalvageVault (Corporate Salvage Mechanism)

```move
public struct SalvageVault<phantom USDC> has key, store {
    id: UID,
    original_stream_id: ID,    // Audit linkage
    owner: address,            // Corporate treasury
    balance: Balance<SUI>,     // Refunded unearned SUI
    pending_hedge_debt: u64,   // Accumulated debt at cancellation
    strike_price: u64,         // Original config (reference)
    hedge_direction: u8,       // Original config (reference)
    salvaged_at: u64,          // Cancellation timestamp
}
```

### PeachRegistry (Audit Ledger)

```move
public struct PeachRegistry has key {
    id: UID,
    streams: Table<ID, StreamRecord>,  // Permanent lifecycle records
    total_streams: u64,                // Counter
    total_volume: u128,                // Cumulative SUI escrowed
}
```

### Entry Functions

| Function | Caller | Description |
|----------|--------|-------------|
| `create_stream<USDC>` | Sender | Escrow SUI, set timeline + strike + hedge direction + lot size |
| `claim_stream<USDC>` | Receiver | Claim vested portion; auto-hedge or accumulate based on lot size |
| `cancel_stream<USDC>` | Sender | Settle earned to receiver, package remainder into SalvageVault |
| `dissolve_salvage_vault<USDC>` | Sender | Extract SUI from a SalvageVault back to treasury |

### Registry Functions (package-internal)

| Function | Trigger |
|----------|---------|
| `register_stream` | Called by `create_stream` |
| `record_cancellation` | Called by `cancel_stream` |
| `record_completion` | Called by `claim_stream` when fully vested |

### External Dependencies (On-Chain)

- **Pyth Network** — `get_price_no_older_than()` for live SUI/USD price (max 60s staleness)
- **DeepBook V3** — `swap_exact_base_for_quote<SUI, USDC>()` for atomic spot swap
- **DEEP Token** — DeepBook taker fee token (passed as zero-coin when unused)

### Events Emitted

| Event | Description |
|-------|-------------|
| `StreamCreated` | New stream deployed with full config |
| `StreamClaimed` | Claim executed (payment stub with amounts + price) |
| `HedgeTriggered` | Atomic swap fired (spot, strike, amount, direction) |
| `HedgeDebtAccumulated` | Sub-lot buffered (amount, total debt, min lot) |
| `StreamCanceled` | Stream cancelled + SalvageVault created |
| `StreamCompleted` | All funds claimed, stream fully vested |
| `SalvageDissolved` | Treasury extracted SUI from SalvageVault |
| `StreamRegistered` | Registry recorded new stream |
| `StreamFinalized` | Registry recorded cancellation/completion |

---

## Frontend Architecture

### Route Map

| Route | Purpose |
|-------|---------|
| `/` | Landing page (GSAP cinematic hero, scroll animations) |
| `/login` | Sui wallet connect (auto-redirect if already connected) |
| `/docs` | Whitepaper / technical documentation |
| `/dashboard` | Overview: 4 metric cards, live Pyth price, Protection Shield chart, recent streams |
| `/dashboard/create` | Deploy stream with hedge direction (Floor/Ceiling/None), strike, min lot config |
| `/dashboard/streams` | Live active streams with real-time ticking, claim/cancel PTBs |
| `/dashboard/insurance` | Protection status per stream, accumulator debt, hedge fire log |
| `/dashboard/treasury` | Corporate treasury: locked SUI, SalvageVault ledger, dissolved count |
| `/dashboard/history` | Full on-chain transaction history (claims, cancels, hedges) |

### Key Components

| Component | Role |
|-----------|------|
| `SuiProvider` | @mysten/dapp-kit wallet + chain context |
| `ToastProvider` | Global notification system |
| `TickingStreamRow` | Real-time animated stream with claim/cancel PTB (passes registry) |
| `ProtectionShieldGraph` | Live DeepBook V3 mid-price chart (Recharts) |

### PTB (Programmable Transaction Block) Patterns

The frontend builds complex multi-step transactions:

1. **Create Stream:** `splitCoins(gas) → moveCall(create_stream)` with registry reference
2. **Claim Stream:** `updatePythFeed() → coin::zero<DEEP>() → moveCall(claim_stream)` with registry + pool
3. **Cancel Stream:** `updatePythFeed() → coin::zero<DEEP>() → moveCall(cancel_stream)` with registry + pool
4. **Dissolve Salvage:** `moveCall(dissolve_salvage_vault)` with SalvageVault object

---

## On-Chain Constants (Testnet)

| Constant | Address |
|----------|---------|
| PEACH_PACKAGE_ID | `0x2aa14e462834baf26ab9c223f0a202005cd21db392d07bcc1654eb1068b399f5` |
| PEACH_REGISTRY_ID | (set after v2 publish — singleton shared object) |
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
│  1. User fills form (amount, recipient, strike,         │
│     hedge direction: FLOOR/CEILING/NONE)                │
│  2. Frontend builds PTB:                                │
│     a. Fetch Pyth VAA from Hermes REST API              │
│     b. Call pyth::update_single_price_feed()            │
│     c. Pass PeachRegistry + DeepBook Pool refs          │
│     d. Call peach_stream::create/claim/cancel           │
│  3. Sign via @mysten/dapp-kit wallet adapter            │
│  4. Submit to Sui Testnet full node                     │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────── ON-CHAIN (Sui) ─────────────────────┐
│                                                         │
│  PeachStream shared object:                             │
│    • Linear time-decay vesting                          │
│    • Pyth oracle price check (60s max staleness)        │
│    • Hedge direction evaluation (FLOOR or CEILING)      │
│    • Accumulator: buffer sub-lot, execute when ready    │
│    • If hedge fires → DeepBook V3 swap SUI→USDC        │
│    • Events emitted for frontend indexing               │
│                                                         │
│  PeachRegistry shared object:                           │
│    • Permanent record of all stream lifecycles          │
│    • Queryable on-chain audit trail                     │
│                                                         │
│  SalvageVault (on cancel):                              │
│    • Owned object sent to corporate treasury            │
│    • Contains unearned balance + pending hedge debt     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Bug Audit — Pre-Prod Issues

### Critical (P0) — Causes Incorrect Behavior

| # | Location | Issue | Status |
|---|----------|-------|--------|
| 1 | `src/components/MicroPremiumLedger.tsx` | **Hardcoded stale `PACKAGE_ID`** — component removed in dashboard redesign. | **FIXED** — Component removed; dashboard uses direct event queries. |
| 2 | `src/app/dashboard/treasury/page.tsx` | **Race condition in Pyth price fetch.** | **FIXED** — Pyth price now in its own `useEffect` with independent state. |

### High (P1) — Performance / React Anti-Patterns

| # | Location | Issue | Status |
|---|----------|-------|--------|
| 3 | `src/app/dashboard/insurance/page.tsx` | **`setState` called synchronously inside `useEffect` body.** | **FIXED** — Uses `useMemo` for derived hedge events; no cascading setState. |
| 4 | `src/components/TickingStreamRow.tsx` | **`setBalance()` called synchronously in effect.** | **FIXED** — Initial balance computed via useState initializer, not in effect. |
| 5 | `src/components/ProtectionShieldGraph.tsx:33` | **Missing `suiClient` in `useEffect` dependency array.** | Open — ProtectionShieldGraph unchanged (low risk on testnet). |

### Medium (P2) — Code Quality / DX

| # | Location | Issue | Status |
|---|----------|-------|--------|
| 6 | `create-pyth-feed.ts:4` | **Uses deprecated SDK imports.** | Open — Script not part of main app build. |
| 7 | `src/app/dashboard/create/page.tsx` | **Unused import `SUI_CLOCK_OBJECT_ID`.** | **FIXED** — Page rewritten, no unused imports. |
| 8 | `src/app/dashboard/insurance/page.tsx` | **Unused import `DollarSign`.** | **FIXED** — Page rewritten, clean imports. |
| 9 | `src/components/TickingStreamRow.tsx` | **Unused imports `useRef`, duplicate `useState`.** | **FIXED** — Component rewritten with clean imports. |
| 10 | `packages/peach_contracts/tests/` | **Tests now pass (19/19).** | **FIXED** — Full unit test coverage for creation, vesting, registry, validation. |

### Low (P3) — UX / Documentation Gaps

| # | Location | Issue | Status |
|---|----------|-------|--------|
| 11 | `TickingStreamRow.tsx` (claim/cancel) | **No user-facing success/error toast.** | **FIXED** — Both claim and cancel now show toast feedback. |
| 12 | Root project | **No `.env.example` file.** | Open — No env vars currently required for testnet. |
| 13 | Dashboard/README | **"DeepBook Predict" terminology.** | **FIXED** — All UI copy and README updated to reflect real spot swap mechanics. |
| 14 | `src/app/dashboard/page.tsx` | **`impliedVolatility` fake metric.** | **FIXED** — Dashboard redesigned with real on-chain metrics only. |

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
sui move test          # 19 tests, all passing
sui client publish --gas-budget 100000000
```

---

## Testnet Deployment Status

| Component | Status |
|-----------|--------|
| Move Contract (peach_stream + peach_registry) | Rebuilt (v2 — 5 pillars), ready for publish |
| Pyth SUI/USD Feed | Active |
| DeepBook SUI/USDC Pool | Active |
| Frontend (Vercel/local) | Rebuilt — aligned with v2 contract, builds passing |

---

*Last audited: June 18, 2026 (frontend rebuild)*
