/**
 * Keeper Orchestrator — the main control loop that coordinates
 * the indexer, price monitor, and transaction builder.
 */

import { SuiClient } from "@mysten/sui/client";
import { KeeperConfig } from "./config.js";
import { EventIndexer } from "./indexer.js";
import { PriceMonitor } from "./price-monitor.js";
import { TransactionBuilder } from "./tx-builder.js";
import { KeeperMetrics, LIQUIDATION_STATUS } from "./types.js";
import { Logger } from "pino";

const EXECUTION_LOOP_INTERVAL_MS = 10000;
const STATE_REFRESH_INTERVAL_MS = 30000;

export class Keeper {
  private client: SuiClient;
  private config: KeeperConfig;
  private indexer: EventIndexer;
  private priceMonitor: PriceMonitor;
  private txBuilder: TransactionBuilder;
  private logger: Logger;
  private metrics: KeeperMetrics;
  private executionLoop: NodeJS.Timeout | null = null;
  private refreshLoop: NodeJS.Timeout | null = null;
  private running = false;

  constructor(config: KeeperConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ module: "keeper" });

    this.client = new SuiClient({ url: config.suiRpcUrl });
    this.indexer = new EventIndexer(this.client, config, logger);
    this.priceMonitor = new PriceMonitor(config, logger);
    this.txBuilder = new TransactionBuilder(this.client, config, logger);

    this.metrics = {
      startedAt: Date.now(),
      activeStreams: 0,
      hedgesTriggered: 0,
      tranchesExecuted: 0,
      fallbacksExecuted: 0,
      autoClaimsExecuted: 0,
      rpcErrors: 0,
      lastExecutionTimestamp: 0,
      lastPriceUpdateTimestamp: 0,
      walletBalanceSui: 0n,
      currentPrice: 0n,
    };
  }

  /** Start all subsystems and the main execution loop. */
  async start(): Promise<void> {
    this.logger.info("Starting Peach Keeper Service...");

    await this.indexer.start();
    this.priceMonitor.start();

    // Check wallet balance
    const balance = await this.txBuilder.getWalletBalance();
    this.metrics.walletBalanceSui = balance;
    this.logger.info(
      { balance: balance.toString(), address: this.txBuilder.getAddress() },
      "Wallet balance loaded"
    );

    if (balance < BigInt(this.config.lowBalanceAlertSui)) {
      this.logger.warn("Keeper wallet balance is LOW — may run out of gas!");
    }

    // Start execution loop
    this.running = true;
    this.executionLoop = setInterval(() => this.tick(), EXECUTION_LOOP_INTERVAL_MS);
    this.refreshLoop = setInterval(() => this.refreshState(), STATE_REFRESH_INTERVAL_MS);

    this.logger.info("Keeper service fully operational");
  }

  /** Stop the keeper gracefully. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.executionLoop) clearInterval(this.executionLoop);
    if (this.refreshLoop) clearInterval(this.refreshLoop);
    this.priceMonitor.stop();
    await this.indexer.stop();
    this.logger.info("Keeper service stopped");
  }

  /** Get current metrics for the dashboard. */
  getMetrics(): KeeperMetrics {
    const price = this.priceMonitor.getLatestPrice();
    this.metrics.activeStreams = this.indexer.getStreams().size;
    this.metrics.currentPrice = price?.price ?? 0n;
    this.metrics.lastPriceUpdateTimestamp = price?.publishTime
      ? price.publishTime * 1000
      : 0;
    return this.metrics;
  }

  /** Get the indexer for dashboard queries. */
  getIndexer(): EventIndexer {
    return this.indexer;
  }

  /** Main execution tick — detect breaches, execute hedges, and auto-claim matured streams. */
  private async tick(): Promise<void> {
    if (!this.running) return;

    try {
      const breaches = this.priceMonitor.detectBreaches(this.indexer.getStreams());

      for (const breach of breaches) {
        this.logger.info(
          {
            streamId: breach.stream.streamId,
            action: breach.action,
            price: breach.currentPrice.toString(),
            strike: breach.stream.strikePrice.toString(),
          },
          "Breach detected — executing hedge"
        );

        const digest = await this.txBuilder.executeHedge(breach);

        if (digest) {
          this.metrics.lastExecutionTimestamp = Date.now();

          if (breach.action === "initiate") {
            this.metrics.hedgesTriggered++;
            this.indexer.updateStreamState(breach.stream.streamId, {
              liquidationStatus: LIQUIDATION_STATUS.TWAP_ACTIVE,
              tranchesExecuted: 1,
              lastTrancheTimestamp: Date.now(),
              totalSuiAtHedgeStart: breach.stream.suiBalance,
            });
          } else {
            this.metrics.tranchesExecuted++;
            const newTranches = breach.stream.tranchesExecuted + 1;
            this.indexer.updateStreamState(breach.stream.streamId, {
              tranchesExecuted: newTranches,
              lastTrancheTimestamp: Date.now(),
              liquidationStatus:
                newTranches >= breach.stream.twapTranches
                  ? LIQUIDATION_STATUS.FULLY_HEDGED
                  : LIQUIDATION_STATUS.TWAP_ACTIVE,
            });
          }
        } else {
          this.metrics.rpcErrors++;
        }
      }

      // ── Auto-Claim: push funds to receivers for fully-vested streams ──
      const maturedStreams = this.indexer.getMaturedStreams();

      for (const stream of maturedStreams) {
        this.logger.info(
          { streamId: stream.streamId, receiver: stream.receiver },
          "Matured stream detected — executing auto-claim"
        );

        const digest = await this.txBuilder.executeAutoClaim(stream);

        if (digest) {
          this.metrics.autoClaimsExecuted++;
          this.metrics.lastExecutionTimestamp = Date.now();
          // Mark balances as zero locally; next refreshAll() will reconcile on-chain state
          this.indexer.updateStreamState(stream.streamId, {
            suiBalance: 0n,
            usdcBalance: 0n,
          });
        } else {
          this.metrics.rpcErrors++;
        }
      }
    } catch (err) {
      this.metrics.rpcErrors++;
      this.logger.error({ err }, "Execution tick error");
    }
  }

  /** Periodically refresh on-chain state to catch external changes. */
  private async refreshState(): Promise<void> {
    try {
      await this.indexer.refreshAll();
      const balance = await this.txBuilder.getWalletBalance();
      this.metrics.walletBalanceSui = balance;

      if (balance < BigInt(this.config.lowBalanceAlertSui)) {
        this.logger.warn(
          { balance: balance.toString() },
          "LOW WALLET BALANCE — keeper may fail"
        );
      }
    } catch (err) {
      this.logger.error({ err }, "State refresh error");
    }
  }
}
