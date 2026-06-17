// ─────────────────────────────────────────────────────────────────────────────
// Peach Protocol — On-Chain Constants (Testnet)
// Updated for the production architecture:
//   • Pyth Network oracle (real SUI/USD price feed)
//   • DeepBook V3 CLOB pool (real SUI/USDC spot swap)
// ─────────────────────────────────────────────────────────────────────────────

// Your deployed peach_contracts package ID (will be updated after publish)
export const PEACH_PACKAGE_ID =
  "0x2aa14e462834baf26ab9c223f0a202005cd21db392d07bcc1654eb1068b399f5";

// ── DeepBook V3 ──────────────────────────────────────────────────────────────
// Official DeepBook V3 package on Sui Testnet
export const DEEPBOOK_PACKAGE_ID =
  "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c";

// SUI / USDC DeepBook V3 spot pool (Testnet)
export const DEEPBOOK_SUI_USDC_POOL_ID =
  "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5";

// DEEP governance token type (for paying DeepBook taker fees)
export const DEEP_TOKEN_TYPE =
  "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP";

// ── Pyth Network ─────────────────────────────────────────────────────────────
// Pyth State Object on Testnet
export const PYTH_STATE_ID =
  "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c";

// Pyth SUI/USD Price Feed Object on Testnet
// This is the shared object your PTB must pass to claim_stream as pyth_price_object
export const PYTH_SUI_USD_PRICE_INFO_OBJECT_ID =
  "0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266";

// Pyth SUI/USD Price Feed ID (used with the Hermes API to fetch VAAs)
export const PYTH_SUI_USD_FEED_ID =
  "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";

// Pyth package address on testnet
export const PYTH_PACKAGE_ID =
  "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837";

// Wormhole State Object on Testnet (needed to verify Pyth VAAs)
export const WORMHOLE_STATE_ID =
  "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790";

// ── USDC Type ────────────────────────────────────────────────────────────────
// Wormhole-bridged USDC on Sui Testnet (used as the USDC type arg in PeachStream)
export const USDC_TYPE =
  "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC";

// ── Sui System Objects ────────────────────────────────────────────────────────
export const SUI_CLOCK_OBJECT_ID = "0x6";

// ── Strike Price ─────────────────────────────────────────────────────────────
// Pyth SUI/USD uses 8-decimal precision.
// $1.00 = 100_000_000,  $0.50 = 50_000_000
// Default strike = $1.00 (employee's floor)
export const DEFAULT_STRIKE_PRICE_8DP = BigInt(100_000_000);

// ── Hermes API ───────────────────────────────────────────────────────────────
// Pyth Hermes REST endpoint for fetching fresh VAAs before calling claim_stream
export const PYTH_HERMES_BASE_URL = "https://hermes.pyth.network";
