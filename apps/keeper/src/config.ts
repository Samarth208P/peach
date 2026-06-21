/**
 * Keeper Service Configuration
 * Loads and validates environment variables.
 */

import { RpcEndpoint, RpcClientConfig } from "./rpc-client.js";

export interface KeeperConfig {
  /** Primary RPC URL (backward-compat). */
  suiRpcUrl: string;
  /** All RPC endpoints for failover (parsed from SUI_RPC_ENDPOINTS or falls back to suiRpcUrl). */
  rpcEndpoints: RpcEndpoint[];
  rpcConfig: RpcClientConfig;
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

  // Parse RPC endpoints: comma-separated list with optional weight suffix
  // Format: "url1:weight1,url2:weight2" or just "url1,url2" (default weight=5)
  const primaryRpc = required("SUI_RPC_URL");
  const endpointsRaw = optional("SUI_RPC_ENDPOINTS", "");

  let rpcEndpoints: RpcEndpoint[];
  if (endpointsRaw) {
    rpcEndpoints = endpointsRaw.split(",").map((entry) => {
      const parts = entry.trim().split("|");
      return {
        url: parts[0].trim(),
        weight: parts[1] ? parseInt(parts[1]) : 5,
      };
    });
  } else {
    // Fallback: use primary URL + Sui official fullnode as backup
    rpcEndpoints = [
      { url: primaryRpc, weight: 10 },
      { url: "https://fullnode.testnet.sui.io:443", weight: 5 },
    ];
  }

  const rpcConfig: RpcClientConfig = {
    endpoints: rpcEndpoints,
    requestTimeoutMs: parseInt(optional("RPC_REQUEST_TIMEOUT_MS", "30000")),
    maxRetries: parseInt(optional("RPC_MAX_RETRIES", "5")),
    baseRetryDelayMs: parseInt(optional("RPC_BASE_RETRY_DELAY_MS", "1000")),
    maxRetryDelayMs: parseInt(optional("RPC_MAX_RETRY_DELAY_MS", "30000")),
    healthCheckIntervalMs: parseInt(optional("RPC_HEALTH_CHECK_INTERVAL_MS", "60000")),
  };

  return {
    suiRpcUrl: primaryRpc,
    rpcEndpoints,
    rpcConfig,
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
    pricePollIntervalMs: parseInt(optional("PRICE_POLL_INTERVAL_MS", "10000")),
    minOutputGuardSlippageBps: parseInt(optional("MIN_OUTPUT_GUARD_SLIPPAGE_BPS", "50")),
    gasBudget: parseInt(optional("GAS_BUDGET", "100000000")),
    lowBalanceAlertSui: parseInt(optional("LOW_BALANCE_ALERT_SUI", "1000000000")),
    dashboardPort: parseInt(optional("DASHBOARD_PORT", process.env.PORT || "3001")),
  };
}
