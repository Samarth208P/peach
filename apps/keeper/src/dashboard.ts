/**
 * Dashboard API — lightweight HTTP endpoints for operational observability.
 * Exposes /health, /metrics, /queue, /streams for monitoring,
 * and POST /register-stream for the frontend to register new streams.
 */

import Fastify from "fastify";
import { Keeper } from "./keeper.js";
import { KeeperConfig } from "./config.js";
import { LIQUIDATION_STATUS, QueueEntry } from "./types.js";
import { Logger } from "pino";

export async function startDashboard(
  keeper: Keeper,
  config: KeeperConfig,
  logger: Logger,
): Promise<void> {
  const app = Fastify({ logger: false });

  // Enable CORS
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      reply.send();
    } else {
      done();
    }
  });

  /** Health check endpoint. */
  app.get("/health", async () => {
    const metrics = keeper.getMetrics();
    return {
      status: "ok",
      uptime_ms: Date.now() - metrics.startedAt,
      wallet_balance_sui: metrics.walletBalanceSui.toString(),
      last_price_update_ms: metrics.lastPriceUpdateTimestamp,
      connected_streams: metrics.activeStreams,
      current_price: metrics.currentPrice.toString(),
    };
  });

  /** Prometheus-compatible metrics endpoint. */
  app.get("/metrics", async () => {
    const m = keeper.getMetrics();
    const lines = [
      `# HELP peach_keeper_active_streams Number of actively monitored streams`,
      `# TYPE peach_keeper_active_streams gauge`,
      `peach_keeper_active_streams ${m.activeStreams}`,
      `# HELP peach_keeper_hedges_triggered_total Total hedges initiated`,
      `# TYPE peach_keeper_hedges_triggered_total counter`,
      `peach_keeper_hedges_triggered_total ${m.hedgesTriggered}`,
      `# HELP peach_keeper_tranches_executed_total Total TWAP tranches executed`,
      `# TYPE peach_keeper_tranches_executed_total counter`,
      `peach_keeper_tranches_executed_total ${m.tranchesExecuted}`,
      `# HELP peach_keeper_rpc_errors_total Total RPC/transaction errors`,
      `# TYPE peach_keeper_rpc_errors_total counter`,
      `peach_keeper_rpc_errors_total ${m.rpcErrors}`,
      `# HELP peach_keeper_wallet_balance_sui Wallet SUI balance in MIST`,
      `# TYPE peach_keeper_wallet_balance_sui gauge`,
      `peach_keeper_wallet_balance_sui ${m.walletBalanceSui}`,
      `# HELP peach_keeper_last_execution_timestamp Last successful hedge timestamp`,
      `# TYPE peach_keeper_last_execution_timestamp gauge`,
      `peach_keeper_last_execution_timestamp ${m.lastExecutionTimestamp}`,
      `# HELP peach_keeper_current_price Current SUI/USD price (8dp)`,
      `# TYPE peach_keeper_current_price gauge`,
      `peach_keeper_current_price ${m.currentPrice}`,
    ];
    return lines.join("\n") + "\n";
  });

  /** Queue endpoint — streams currently in TWAP_ACTIVE state. */
  app.get("/queue", async () => {
    const indexer = keeper.getIndexer();
    const twapStreams = indexer.getTWAPActiveStreams();
    const queue: QueueEntry[] = twapStreams.map((s) => ({
      streamId: s.streamId,
      tranchesRemaining: s.twapTranches - s.tranchesExecuted,
      nextTrancheAt: s.lastTrancheTimestamp + s.twapIntervalMs,
      usdcAccumulated: s.usdcBalance,
      suiRemaining: s.suiBalance,
    }));
    return { count: queue.length, queue };
  });

  /** All monitored streams. */
  app.get("/streams", async () => {
    const indexer = keeper.getIndexer();
    const streams = [...indexer.getStreams().values()].map((s) => ({
      streamId: s.streamId,
      sender: s.sender,
      receiver: s.receiver,
      totalAmount: s.totalAmount.toString(),
      strikePrice: s.strikePrice.toString(),
      hedgeDirection: s.hedgeDirection,
      liquidationStatus: s.liquidationStatus,
      statusLabel: s.liquidationStatus === LIQUIDATION_STATUS.HEALTHY
        ? "HEALTHY"
        : s.liquidationStatus === LIQUIDATION_STATUS.TWAP_ACTIVE
          ? "TWAP_ACTIVE"
          : "FULLY_HEDGED",
      tranchesExecuted: s.tranchesExecuted,
      twapTranches: s.twapTranches,
      suiBalance: s.suiBalance.toString(),
      usdcBalance: s.usdcBalance.toString(),
    }));
    return { count: streams.length, streams };
  });

  /** Register a new stream for keeper monitoring. */
  app.post("/register-stream", async (request, reply) => {
    const body = request.body as any;
    const streamId = body?.streamId;

    if (!streamId || typeof streamId !== "string") {
      return reply.status(400).send({ error: "Missing or invalid 'streamId' in request body" });
    }

    const indexer = keeper.getIndexer();
    const success = await indexer.registerStream(streamId);

    if (success) {
      logger.info({ streamId }, "Stream registered via API");
      return { status: "registered", streamId };
    } else {
      return reply.status(404).send({ error: "Stream not found on-chain", streamId });
    }
  });

  await app.listen({ port: config.dashboardPort, host: "0.0.0.0" });
  logger.info({ port: config.dashboardPort }, "Dashboard API started");
}
