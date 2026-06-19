/**
 * Peach Keeper Service — Entry Point
 *
 * Multi-stream event indexer with real-time Pyth price monitoring,
 * automated TWAP hedge execution, and operational dashboard API.
 */

import pino from "pino";
import { loadConfig } from "./config.js";
import { Keeper } from "./keeper.js";
import { startDashboard } from "./dashboard.js";

// Load .env file
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino/file",
    options: { destination: 1 }, // stdout
  },
});

async function main(): Promise<void> {
  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  Peach Protocol — Keeper Service v2.0");
  logger.info("  Autonomous Dual-Asset TWAP Hedge Engine");
  logger.info("═══════════════════════════════════════════════════════");

  const config = loadConfig();
  const keeper = new Keeper(config, logger);

  // Start the keeper engine
  await keeper.start();

  // Start the dashboard API
  await startDashboard(keeper, config, logger);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    await keeper.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, "Keeper service crashed");
  process.exit(1);
});
