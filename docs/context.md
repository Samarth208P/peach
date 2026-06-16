# Peach: Agent Context & Project Blueprint

## 1. Project Profile & Identity
* **Project Name:** `Peach` (or `peach.`)
* **Core Value Proposition:** An automated, decentralized risk-management and downside-protected payment streaming protocol designed for B2B applications, payroll, and milestone-based ecosystem grants.
* **Target Hackathon Track:** Primarily **DeepBook Track** due to heavy integration with its newly rolled-out infrastructure, or **DeFi & Payments Track**.
* **Special Category Eligibility:** **University Award** (requires at least 50% of the team to toggle "Yes" to being a university student).

---

## 2. Core Problem & Solution Invariant

### The Volatility Leak
Traditional crypto streaming protocols are passive. If a recipient receives a 30-day milestone stream of $50,000 in volatile SUI tokens to cover fixed liabilities (like employee payroll), a 35% mid-month correction drops their purchasing power to $41,250.

### The Peach Invariant Model
Peach continuously splits payment streams (per hour / epoch delta $\Delta t$):
1. **99% ($1 - \alpha$)** flows to the receiver's liquid wallet.
2. **1% ($\alpha$)** is routed into Peach's risk mitigation engine to purchase downside insurance.

$$\text{Expected Value } E[V_{net}] = \sum (V_{scenario} \times \text{Probability}) = \mathbf{\$54,500} \quad (\text{vs. Variable Raw SUI Expected Value})$$

#### Statistical Performance Profile:
| Market Trend | Macro Probability | Spot Shift | Raw Stream Value at T | DeepBook Predict Payout | Total Premium Lost | Net Payout Realized (Fiat) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Severe Downturn** | 25% | -40% | $30,000 | +$19,500 | -$500 | **$49,500** (99% preserved) |
| **Stable Flat** | 50% | 0% | $50,000 | $0 | -$500 | **$49,500** (Pure safety cost) |
| **Aggressive Bull** | 25% | +40% | $70,000 | $0 | -$500 | **$69,500** (Upside captured) |

---

## 3. Technical & Financial Architecture

### DeepBook V3 Spot & Predict Integration
```text
                  [ PeachStream Sui Object ]
                              │
                      (Automated PTB)
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
[ DeepBook Spot CLOB ]                    [ DeepBook Predict ]
• Swaps 1% SUI premium                    • Uses DUSDC quote asset
• Outputs stable DUSDC                     • Mints at-the-money Put contract
```
* **The Spot Component:** Swaps the 1% SUI premium for stable quote asset (DUSDC) using the `SUI/DBUSDC` or `SUI/DUSDC` pools.
* **The Predict Component:** Passes stablecoin directly into DeepBook Predict to mint Put options (strike price $K = \text{Spot Price}$) priced using Black-Scholes-Merton parameters from the native `OracleSVI` object.
* **System Stability & Volatility Spikes:** If implied volatility $\sigma$ surges, the option cost increases. Peach retains the 1% premium cap and dynamically scales down the insurance coverage ratio (e.g. from 100% down to 85% protection) to maintain vault solvency.
* **PTB Integration:** The PTB executes fully on-chain, routing SUI premium into DeepBook Spot CLOB and minting Put options directly in DeepBook Predict.

### Database-less MVP Architecture
* **On-Chain App State:** Every payment stream is instantiated as its own independent `PeachStream` Move Object living in global state. The frontend queries the Sui RPC directly—no external SQL/NoSQL database needed.
* **zkLogin Wallet Salt Management:** Integrated with **Mysten Labs' Enoki SDK** / **Shinami's zkLogin Wallet API** as an institutional-grade backend for secure salt storage and zero-knowledge proof generation, guaranteeing consistent wallet address generation across logins.

---

## 4. Move Contracts Detail

### Target Module: `peach_contracts::peach_stream`
* **Source File:** [peach_stream.move](file:///c:/Users/krish/OneDrive/Desktop/peach/packages/peach_contracts/sources/peach_stream.move)
* **Active Structs:**
  * `PeachStream` (has `key`):
    ```rust
    public struct PeachStream has key {
        id: UID,
        sender: address,
        receiver: address,
        total_amount: u64,
        withdrawn: u64,
        balance: Balance<SUI>,
        start_time: u64,
        end_time: u64,
    }
    ```
  * `StreamCreated` (has `copy, drop`):
    ```rust
    public struct StreamCreated has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
    }
    ```
  * `StreamClaimed` (has `copy, drop`):
    ```rust
    public struct StreamClaimed has copy, drop {
        stream_id: ID,
        claimer: address,
        amount_claimed: u64,
    }
    ```
  * `StreamCanceled` (has `copy, drop`):
    ```rust
    public struct StreamCanceled has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        receiver_settled_amount: u64,
        sender_refunded_amount: u64,
    }
    ```
* **Core Functions:**
  * `create_stream(receiver, start_time, end_time, fee_coin, ctx)`: Initializes a shared `PeachStream` object and emits a `StreamCreated` footprint event.
  * `claim_stream(stream, clock, ctx)`: Allows recipient to pull unlocked funds based on elapsed time, emitting `StreamClaimed`.
  * `cancel_stream(stream, clock, ctx)`: Destructs the shared `PeachStream` object by value, settles remaining unlocked balance to recipient, refunds the rest to the sender, and emits `StreamCanceled`.

---

## 5. Monetization Strategy
1. **DeepBook V3 Referral Rebates:** Developer commission on continuous options order volume routed directly to the DeepBook vaults.
2. **Float Yield:** Programmatically deploys a percentage of the unstreamed principal into money markets (Navi/Scallop) and retains a **10% performance fee on interest**.
3. **Protection Spread:** A **2% performance fee** charged strictly on option payout profits during market downturns.

---

## 6. Frontend Layout & Presentation Blueprint

### Page Architecture
1. **Auth Portal (`/`):** Simple zkLogin ("Continue with Google") + Wallet Connect hybrid.
   * *Hydration Status:* Fixed SSR/client hydration mismatch by wrapping wallet loading maps in client-side state mount hooks.
2. **Main Dashboard (`/dashboard`):** 
   * **Global Capital Strip:** Total Volume, Active Vectors, Net Insured Capital, Ecosystem Savings.
   * **Left (60%):** Ticking Stream Queue (RAF loops) + Micro-Premium Ledger.
   * **Right (40%):** Protection Shield Graph (Plotting Spot Price vs Floor Price) + DeepBook Predict Vault info.
3. **Form Wizard (`/dashboard/create`):** Stream settings with "Price Safety Switch" toggle.

### Project References
* **Active Move Package ID:** `0x49c002ce2aadfa23c699394e44be190188a9ec6ea0d2b8b3c23dce7779904d22`
* **Testnet Alternate ID (README):** `0x25219b630a85a209ead80522fde59636ee514259208586e8475a176c8510672c`
* **Sui Provider Hookups:** [SuiProvider.tsx](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/components/SuiProvider.tsx) (configured for Testnet by default).
