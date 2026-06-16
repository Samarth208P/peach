# Peach: Volatility-Insured Payment Streaming Layer

Automated Risk-Management and Downside-Protected Payment Streaming Natively Powered by DeepBook V3 Predict.

---

## 1. Executive Summary

Peach is a B2B programmable payment protocol designed for the **Sui Overflow 2026 Hackathon** under the **DeepBook** and **DeFi & Payments** tracks. 

Traditional cryptocurrency streaming models are completely passive, exposing businesses, developers, and global supply chains to catastrophic capital erosion during market downturns. Peach transforms passive payment flows into an **active, self-hedging financial asset**. By programmatically routing a tiny micro-margin (1%) of a live streaming asset into **DeepBook V3's new native Predict primitive**, Peach automatically mints continuous downside protection (Put Options), ensuring the receiver walks away with 100% of their intended purchasing power—regardless of market crashes.

---

## 2. The Real-World Friction (50% Impact Focus)

Web3 companies, foundations, and DAOs frequently settle cross-border milestone contracts, grants, and payroll using native crypto assets distributed via real-time streams. However, market volatility introduces severe operational risk:

* **The Capital Leak:** A development agency signs a 30-day contract for $50,000 paid via a native token stream. If the token price drops 35% mid-month, the real-world value received plummets to $41,250, completely wiping out their corporate profit margin and causing them to miss payroll.
* **Why Stablecoins Fail the Treasury:** Forcing foundations to stream USDC requires them to liquidate massive amounts of their native ecosystem tokens upfront. This creates immediate downward sell pressure and incurs heavy market slippage, while depriving the treasury of DEEP token staking or holding benefits.
* **Why Manual Hedging Fails:** Mid-sized businesses do not maintain 24/7 algorithmic trading desks to manually monitor margin, calculate delta exposure, or buy hedges across various decentralized exchanges.

---

## 3. The Peach Mechanism

Peach completely automates risk management using an **additive insurance model** instead of complex leveraged shorting (which risks liquidation and incurs ongoing funding fees).

```text
[ Incoming Payment Stream ]
           │
           ├──► 99% ──► Directed to User's Wallet (Liquid Assets)
           │
           └──►  1% ──► Directed to Peach Module
                             │
                      (Automated PTB)
                             ▼
               [ DeepBook V3 Predict Pool ]
               Programmatically mints Downside Put Contracts
```

### The Financial Invariant

For a target milestone value $V_{target}$ and an insurance premium fee $\alpha = 0.01$ (1%), Peach enforces a strict programmatic floor on the value received by the user:

* **In a Brutal Market Crash (-40%):** The underlying token stream loses value, but the downside positions minted via DeepBook Predict gain the exact equivalent value. The options pay out instantly into the stream wallet. The user receives exactly 99% of their intended value ($49,500 out of $50,000). The market crash variable is mathematically cancelled out.
* **In a Raging Bull Market (+40%):** The options contracts expire out-of-the-money (worthless), forfeiting only the 1% insurance premium. However, because the native asset surged, the user captures the macro upside, walking away with a massive net gain ($69,300) that completely dwarfs the protection cost.

---

## 4. Technical Architecture & Sui Primitives

Peach could not exist on any other blockchain network. It is explicitly architected to maximize the parallel processing and composability primitives introduced in the latest DeepBook V3 updates:

* **DeepBook V3 Predict Modules:** Peach hooks directly into the `predict` package on-chain. It establishes a per-user `PredictManager` shared account object to hold quote balances and programmatic range positions safely without requiring an intermediary centralized clearing house. The capital efficiency of DeepBook V3 guarantees that options are priced fairly with minimal spread.
* **Programmable Transaction Blocks (PTBs):** Peach utilizes a single atomic PTB to route data flows. Every block/interval, the script extracts the micro-allocated premium from the stream object and immediately passes it as an input parameter into `predict::mint` or `predict::mint_range` using the native Block Scholes-driven pricing engine.
* **Object-Centric Move State:** Every agreement is instantiated as a distinct Sui Object tracking the live execution rate, current strike target (OracleSVI), and funding metadata. This enables high-frequency, simultaneous processing across thousands of independent payment streams without global state contention.
* **zkLogin & Gas Sponsorship:** Real-world corporate accountants or contractors can onboard seamlessly using traditional Web2 Google or Apple OAuth credentials. Protocol contracts sponsor the gas fees via Sui's native sponsored transactions, keeping the underlying financial machinery completely hidden from view.
* **DEEP Token Synergy:** The protocol natively leverages the DEEP token for optimized trading fees on the DeepBook V3 Central Limit Order Book (CLOB), ensuring that the insurance premium routing runs efficiently.

---

## 5. Comparative Matrix

| Feature | Unhedged Streams | Delta Neutral Split (Long/Short) | Peach (DeepBook Predict) |
| :--- | :--- | :--- | :--- |
| **Downside Risk** | Infinite Loss | Bound to Rebalancing Core | Zero Loss (Capped at 1% Flat Fee) |
| **Upside Capture** | Uncapped | Completely Capped (0% Gains) | Fully Uncapped (Minus Fee) |
| **Liquidation Risk** | None | High (Short margin calls) | None (Non-recourse Option Model) |
| **Capital Efficiency** | 100% | 50% (Half tied up in short margin) | 99% (Maximum Utility for Treasury) |
| **Ongoing Fees** | None | High Funding Rate Decay | Fixed, Predictable Premium |

---

## 6. Implementation Roadmap

### Phase 1: Devnet Sandbox (Hackathon Core)
* **The Smart Contracts (Move):** Create a module that initializes a stream using a unique Sui Object. This object should keep track of the `target_value`, `start_time`, `end_time`, and a field for a linked `PredictManager` object. Deploy core Move modules utilizing the DeepBook Sandbox local stack.
* **The PTB Superpower (TypeScript SDK):** Write an automated execution script that acts as your background automation trigger. Build a single Programmable Transaction Block (PTB) that extracts the micro-allocated 1% premium directly from the stream balance object and immediately passes it into the DeepBook V3 Predict `predict::mint_range` or `predict::mint` function to lock in the floor price contract.
* **The UX Experience:** Build a sleek, single-page dashboard. The user doesn't need to understand complex options mathematics—they just toggle a switch labeled **"Enable Price Insurance (1% Fee)"**. Use a glassmorphic dark interface to visualize the money flowing second-by-second alongside a live-updating certificate that reads: *Status: 100% Volatility Protected via DeepBook Predict Pool*.

### Phase 2: Mainnet V1 & Audits (Post-Hackathon)
* Conduct security audits on the Move contracts to ensure zero vulnerabilities in object state transitions.
* Integrate robust Mainnet Oracle feeds to power the exact strike pricing of the Predict options.
* Expand the dashboard to allow multi-stream treasury management for DAO payrolls and corporate vendors.
