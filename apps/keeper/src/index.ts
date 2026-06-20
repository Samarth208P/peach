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

// Load .env from monorepo root (single source of truth)
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname,module",
      messageFormat: "[{module}] {msg}",
      colorizeObjects: true,
      singleLine: false,
    },
  },
});

async function main(): Promise<void> {
  console.log("");
  console.log("  =====================================================");
  console.log("    Peach Protocol -- Keeper Service v2.0");
  console.log("    Autonomous Dual-Asset TWAP Hedge Engine");
  console.log("  =====================================================");
  console.log("");

  const config = loadConfig();
  const keeper = new Keeper(config, logger);

  // Start the keeper engine
  await keeper.start();

  // Start the dashboard API
  await startDashboard(keeper, config, logger);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info({ module: "main" }, "Shutting down...");
    await keeper.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal({ err, module: "main" }, "Keeper service crashed");
  process.exit(1);
});
