/**
 * Shared type definitions for the Keeper Service.
 */

export const LIQUIDATION_STATUS = {
  HEALTHY: 0,
  TWAP_ACTIVE: 1,
  FULLY_HEDGED: 2,
} as const;

export interface StreamState {
  streamId: string;
  sender: string;
  receiver: string;
  totalAmount: bigint;
  strikePrice: bigint;
  hedgeDirection: number;
  startTime: number;
  endTime: number;
  twapTranches: number;
  twapIntervalMs: number;
  liquidationStatus: number;
  tranchesExecuted: number;
  lastTrancheTimestamp: number;
  totalSuiAtHedgeStart: bigint;
  suiBalance: bigint;
  usdcBalance: bigint;
}

export interface KeeperMetrics {
  startedAt: number;
  activeStreams: number;
  hedgesTriggered: number;
  tranchesExecuted: number;
  fallbacksExecuted: number;
  rpcErrors: number;
  lastExecutionTimestamp: number;
  lastPriceUpdateTimestamp: number;
  walletBalanceSui: bigint;
  currentPrice: bigint;
}

export interface QueueEntry {
  streamId: string;
  tranchesRemaining: number;
  nextTrancheAt: number;
  usdcAccumulated: bigint;
  suiRemaining: bigint;
}
