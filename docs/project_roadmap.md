# Peach Project Roadmap

## Phase 1: Core Smart Contracts (Sui Move)
- [x] Define `Stream` object struct in [peach_stream.move](file:///c:/Users/krish/OneDrive/Desktop/peach/packages/peach_contracts/sources/peach_stream.move)
- [x] Implement `StreamCreatedEvent` with stream ID, recipient, and premium logs
- [x] Implement `create_stream` logic to split off a 1% micro-premium from SUI deposit
- [x] Implement Move helper wrappers for direct integration with DeepBook Spot CLOB swaps
- [x] Implement options payout settlement module on-chain
- [x] Implement dynamic volatility ratio adjustments to scale back protection coverage under extreme premium shifts

## Phase 2: Frontend & UI Components (`apps/frontend`)
- [x] Configure Tailwind CSS v4 and monorepo structure
- [x] Design premium dark mode interface with neon peach `#FF7A59` accenting
- [x] Build [/login](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/app/login/page.tsx) page with Google zkLogin hooks and wallet connect option (fixed SSR hydration mismatch)
- [x] Build [/dashboard](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/app/dashboard/page.tsx) page with Capital metrics layout
- [x] Develop [TickingStreamRow.tsx](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/components/TickingStreamRow.tsx) component for real-time per-second visual decay
- [x] Develop [ProtectionShieldGraph.tsx](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/components/ProtectionShieldGraph.tsx) to visually plot Spot Price vs Floor Price
- [x] Develop [MicroPremiumLedger.tsx](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/components/MicroPremiumLedger.tsx) for tracking atomic premium routing events
- [x] Build [/dashboard/create](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/app/dashboard/create/page.tsx) wizard form with Price Safety Switch toggle
- [x] Build [/dashboard/history](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/app/dashboard/history/page.tsx) table matching on-chain event cancellation logs (resolved merge conflicts from main branch and resolved layout console warning)

## Phase 3: Client & Sui SDK Integrations
- [x] Setup [SuiProvider.tsx](file:///c:/Users/krish/OneDrive/Desktop/peach/apps/frontend/src/components/SuiProvider.tsx) with `@mysten/dapp-kit` configured for Testnet
- [x] Integrate wallet connections and automatically enforce authentication redirect on dashboard
- [x] Query active streams from on-chain Sui state using `useSuiClientQuery('getOwnedObjects')`
- [x] Build and submit the Programmable Transaction Block (PTB) for stream creation
- [x] Hook the 1% premium Coin split into a live DeepBook Spot CLOB swap inside the PTB
- [x] Direct the swap outputs (USDC) into DeepBook Predict to mint Put options natively in the same block
- [x] Fetch the live option floor price using `DeepBookClient` from SUI/USDC pools on the client

## Phase 4: Production Setup & Polish
- [x] Configure Node.js engines `>=22` in root and frontend package configs
- [x] Setup `.nvmrc` and `.node-version` configurations
- [x] Verify multi-workspace build compilation works successfully (Move modules and Next.js app build clean)
- [x] Implement Enoki/Shinami SDKs for zkLogin serverless salt/prover configurations
- [x] Implement smart money-market lending (Navi/Scallop) float yield routing and yield performance fee split
- [x] Deploy Move contract package to Sui Testnet/Mainnet
- [x] Resolve Sui Wallet signature validation error in frontend transaction builder (fixed type wrapping and invalid hex placeholders)
- [x] Redeploy Move contract package to Testnet and share mock DeepBook PredictPool and OracleSVI objects
- [x] Resolve clob_v3 dry-run failure by simplifying PTB and using SUI as the premium coin type argument


