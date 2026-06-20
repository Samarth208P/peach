/**
 * Keeper Service Configuration
 * Loads and validates environment variables.
 */

export interface KeeperConfig {
  suiRpcUrl: string;
  keeperPrivateKey: string;
  peachPackageId: string;
  keeperCapObjectId: string;
  peachRegistryId: string;
  deepbookPoolId: string;
  pythHermesUrl: string;
  pythSuiUsdFeedId: string;
  pythPriceInfoObjectId: string;
  pythStateId: string;
  wormholeStateId: string;
  usdcType: string;
  pricePollIntervalMs: number;
  minOutputGuardSlippageBps: number;
  gasBudget: number;
  lowBalanceAlertSui: number;
  dashboardPort: number;
}

export function loadConfig(): KeeperConfig {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  const optional = (key: string, fallback: string): string => {
    return process.env[key] || fallback;
  };

  return {
    suiRpcUrl: required("SUI_RPC_URL"),
    keeperPrivateKey: required("KEEPER_PRIVATE_KEY"),
    peachPackageId: required("PEACH_PACKAGE_ID"),
    keeperCapObjectId: required("KEEPER_CAP_OBJECT_ID"),
    peachRegistryId: required("PEACH_REGISTRY_ID"),
    deepbookPoolId: required("DEEPBOOK_SUI_USDC_POOL_ID"),
    pythHermesUrl: optional("PYTH_HERMES_URL", "https://hermes.pyth.network"),
    pythSuiUsdFeedId: required("PYTH_SUI_USD_FEED_ID"),
    pythPriceInfoObjectId: required("PYTH_PRICE_INFO_OBJECT_ID"),
    pythStateId: required("PYTH_STATE_ID"),
    wormholeStateId: required("WORMHOLE_STATE_ID"),
    usdcType: required("USDC_TYPE"),
    pricePollIntervalMs: parseInt(optional("PRICE_POLL_INTERVAL_MS", "5000")),
    minOutputGuardSlippageBps: parseInt(optional("MIN_OUTPUT_GUARD_SLIPPAGE_BPS", "50")),
    gasBudget: parseInt(optional("GAS_BUDGET", "100000000")),
    lowBalanceAlertSui: parseInt(optional("LOW_BALANCE_ALERT_SUI", "1000000000")),
    dashboardPort: parseInt(optional("DASHBOARD_PORT", "3001")),
  };
}
