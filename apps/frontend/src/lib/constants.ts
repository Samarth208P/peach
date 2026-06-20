// ─────────────────────────────────────────────────────────────────────────────
// Peach Protocol — On-Chain Constants (Testnet)
// Updated for the production architecture:
//   • Pyth Network oracle (real SUI/USD price feed)
//   • DeepBook V3 CLOB pool (real SUI/USDC spot swap)
// ─────────────────────────────────────────────────────────────────────────────

export const PEACH_PACKAGE_ID = process.env.NEXT_PUBLIC_PEACH_PACKAGE_ID as string;

// ── DeepBook V3 ──────────────────────────────────────────────────────────────
export const DEEPBOOK_PACKAGE_ID = process.env.NEXT_PUBLIC_DEEPBOOK_PACKAGE_ID as string;
export const DEEPBOOK_SUI_USDC_POOL_ID = process.env.NEXT_PUBLIC_DEEPBOOK_SUI_USDC_POOL_ID as string;
export const DEEP_TOKEN_TYPE = process.env.NEXT_PUBLIC_DEEP_TOKEN_TYPE as string;

// ── Pyth Network ─────────────────────────────────────────────────────────────
export const PYTH_STATE_ID = process.env.NEXT_PUBLIC_PYTH_STATE_ID as string;
export const PYTH_SUI_USD_PRICE_INFO_OBJECT_ID = process.env.NEXT_PUBLIC_PYTH_SUI_USD_PRICE_INFO_OBJECT_ID as string;
export const PYTH_SUI_USD_FEED_ID = process.env.NEXT_PUBLIC_PYTH_SUI_USD_FEED_ID as string;
export const PYTH_PACKAGE_ID = process.env.NEXT_PUBLIC_PYTH_PACKAGE_ID as string;
export const WORMHOLE_STATE_ID = process.env.NEXT_PUBLIC_WORMHOLE_STATE_ID as string;

// ── USDC Type ────────────────────────────────────────────────────────────────
export const USDC_TYPE = process.env.NEXT_PUBLIC_USDC_TYPE as string;

// ── Peach Registry ────────────────────────────────────────────────────────────
export const PEACH_REGISTRY_ID = process.env.NEXT_PUBLIC_PEACH_REGISTRY_ID as string;

// ── Sui System Objects ────────────────────────────────────────────────────────
export const SUI_CLOCK_OBJECT_ID = "0x6";
export const COIN_ZERO_TARGET = "0x2::coin::zero";

// ── DeepBook Address ─────────────────────────────────────────────────────────
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ── Strike Price ─────────────────────────────────────────────────────────────
export const DEFAULT_STRIKE_PRICE_8DP = BigInt(100_000_000);

// ── Hedge Directions ─────────────────────────────────────────────────────────
export const HEDGE_FLOOR = 0;    // Downside protection (payroll)
export const HEDGE_CEILING = 1;  // Upside protection (supply-chain)
export const HEDGE_NONE = 2;     // No hedging (raw streaming)

// ── TWAP Presets ─────────────────────────────────────────────────────────────
export const PRESET_RETAIL = 0;        // 3 tranches, 5 min intervals (15 min total)
export const PRESET_CORPORATE = 1;     // 5 tranches, 12 min intervals (1 hr total)
export const PRESET_INSTITUTIONAL = 2; // 10 tranches, 18 min intervals (3 hr total)

// ── Default Min Lot Size ─────────────────────────────────────────────────────
export const DEFAULT_MIN_LOT_SIZE = BigInt(10_000_000);

// ── Hermes API ───────────────────────────────────────────────────────────────
export const PYTH_HERMES_BASE_URL = "https://hermes-beta.pyth.network";
