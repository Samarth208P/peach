/**
 * Price Monitor — polls Pyth Hermes for real-time SUI/USD price
 * and evaluates all active streams against their strike thresholds.
 */

import { KeeperConfig } from "./config.js";
import { StreamState, LIQUIDATION_STATUS } from "./types.js";
import { Logger } from "pino";

export interface PriceData {
  price: bigint;       // Scaled to 8 decimals (e.g., $3.50 = 350_000_000)
  publishTime: number; // Unix seconds
  confidence: bigint;
}

export interface BreachDetection {
  stream: StreamState;
  currentPrice: bigint;
  action: "initiate" | "execute_tranche";
}

export class PriceMonitor {
  private config: KeeperConfig;
  private logger: Logger;
  private latestPrice: PriceData | null = null;
  private latestVaaPayload: Buffer[] | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config: KeeperConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ module: "price-monitor" });
  }

  /** Start polling Pyth Hermes for price updates. */
  start(): void {
    this.pollInterval = setInterval(
      () => this.fetchPrice(),
      this.config.pricePollIntervalMs,
    );
    // Immediate first fetch
    this.fetchPrice();
    this.logger.info({ intervalMs: this.config.pricePollIntervalMs }, "Price monitor started");
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getLatestPrice(): PriceData | null {
    return this.latestPrice;
  }

  getLatestVaaPayload(): Buffer[] | null {
    return this.latestVaaPayload;
  }

  /** Evaluate all streams against current price — return breach detections. */
  detectBreaches(streams: Map<string, StreamState>): BreachDetection[] {
    if (!this.latestPrice) return [];

    const breaches: BreachDetection[] = [];
    const now = Date.now();

    for (const [, stream] of streams) {
      // Skip unhedged streams
      if (stream.hedgeDirection === 2 || stream.strikePrice === 0n) continue;

      const inBreach = this.isInBreach(stream, this.latestPrice.price);

      if (stream.liquidationStatus === LIQUIDATION_STATUS.HEALTHY && inBreach) {
        breaches.push({
          stream,
          currentPrice: this.latestPrice.price,
          action: "initiate",
        });
      } else if (stream.liquidationStatus === LIQUIDATION_STATUS.TWAP_ACTIVE && inBreach) {
        // Check if interval has elapsed
        const nextTrancheAt = stream.lastTrancheTimestamp + stream.twapIntervalMs;
        if (now >= nextTrancheAt && stream.tranchesExecuted < stream.twapTranches) {
          breaches.push({
            stream,
            currentPrice: this.latestPrice.price,
            action: "execute_tranche",
          });
        }
      }
    }

    return breaches;
  }

  /** Check if a stream's strike condition is breached. */
  private isInBreach(stream: StreamState, price: bigint): boolean {
    if (stream.hedgeDirection === 0) {
      // FLOOR: breach when price < strike
      return price < stream.strikePrice;
    } else if (stream.hedgeDirection === 1) {
      // CEILING: breach when price > strike
      return price > stream.strikePrice;
    }
    return false;
  }

  /** Fetch latest price from Pyth Hermes REST API. */
  private async fetchPrice(): Promise<void> {
    try {
      const url = `${this.config.pythHermesUrl}/v2/updates/price/latest?ids[]=${this.config.pythSuiUsdFeedId}&parsed=true`;
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn({ status: response.status }, "Pyth fetch failed");
        return;
      }

      const data = await response.json() as any;
      const parsed = data?.parsed?.[0];
      if (!parsed?.price) return;

      const priceVal = BigInt(parsed.price.price);
      const expo = Number(parsed.price.expo);
      const confidence = BigInt(parsed.price.conf);

      // Normalize to 8 decimals
      const targetDecimals = 8;
      const sourceDecimals = Math.abs(expo);
      let normalizedPrice: bigint;

      if (sourceDecimals <= targetDecimals) {
        normalizedPrice = priceVal * BigInt(10 ** (targetDecimals - sourceDecimals));
      } else {
        normalizedPrice = priceVal / BigInt(10 ** (sourceDecimals - targetDecimals));
      }

      this.latestPrice = {
        price: normalizedPrice,
        publishTime: Number(parsed.price.publish_time),
        confidence,
      };

      const binaryData = data?.binary?.data;
      if (Array.isArray(binaryData)) {
        this.latestVaaPayload = binaryData.map((hex: string) => Buffer.from(hex, "hex"));
      }
    } catch (err) {
      this.logger.error({ err }, "Price fetch error");
    }
  }
}
