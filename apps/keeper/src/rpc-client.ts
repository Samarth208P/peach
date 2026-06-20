/**
 * Resilient RPC Client — multi-endpoint failover with request timeouts.
 *
 * Solves the 504 timeout issue by:
 * 1. Maintaining a pool of RPC endpoints with health tracking
 * 2. Rotating to the next healthy endpoint on failure
 * 3. Enforcing per-request timeouts via AbortController
 * 4. Exponential backoff with jitter for retries
 */

import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Logger } from "pino";

export interface RpcEndpoint {
  url: string;
  weight: number; // 1-10, higher = preferred
}

export interface RpcClientConfig {
  endpoints: RpcEndpoint[];
  requestTimeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  healthCheckIntervalMs: number;
}

interface EndpointHealth {
  url: string;
  weight: number;
  healthy: boolean;
  consecutiveFailures: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  avgResponseMs: number;
}

const DEFAULT_CONFIG: Partial<RpcClientConfig> = {
  requestTimeoutMs: 30_000,
  maxRetries: 5,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 30_000,
  healthCheckIntervalMs: 60_000,
};

/** Threshold of consecutive failures before marking unhealthy. */
const UNHEALTHY_THRESHOLD = 3;

/** Time (ms) before re-checking a failed endpoint. */
const RECOVERY_COOLDOWN_MS = 30_000;

export class ResilientRpcClient {
  private endpoints: EndpointHealth[];
  private clients: Map<string, SuiClient> = new Map();
  private config: RpcClientConfig;
  private logger: Logger;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private currentIndex = 0;

  constructor(config: RpcClientConfig, logger: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config } as RpcClientConfig;
    this.logger = logger.child({ module: "rpc-client" });

    // Initialize endpoint health tracking
    this.endpoints = config.endpoints.map((ep) => ({
      url: ep.url,
      weight: ep.weight,
      healthy: true,
      consecutiveFailures: 0,
      lastFailureAt: 0,
      lastSuccessAt: 0,
      avgResponseMs: 0,
    }));

    // Pre-create SuiClient instances with timeout transport
    for (const ep of this.endpoints) {
      this.clients.set(ep.url, this.createClient(ep.url));
    }

    // Start background health checks
    this.healthCheckTimer = setInterval(
      () => this.runHealthChecks(),
      this.config.healthCheckIntervalMs
    );

    this.logger.info(
      { endpointCount: this.endpoints.length, primary: this.endpoints[0]?.url },
      "Resilient RPC client initialized"
    );
  }

  /** Get the best available SuiClient (rotates on failure). */
  getClient(): SuiClient {
    const ep = this.getBestEndpoint();
    return this.clients.get(ep.url)!;
  }

  /** Execute an RPC operation with automatic failover and retry. */
  async execute<T>(operation: (client: SuiClient) => Promise<T>, label?: string, timeoutMs?: number): Promise<T> {
    let lastError: Error | null = null;
    const effectiveTimeout = timeoutMs ?? this.config.requestTimeoutMs;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const ep = this.getBestEndpoint();
      const client = this.clients.get(ep.url)!;

      const startMs = Date.now();
      try {
        const result = await this.withTimeout(operation(client), effectiveTimeout);
        this.recordSuccess(ep, Date.now() - startMs);
        return result;
      } catch (err: any) {
        const elapsed = Date.now() - startMs;
        lastError = err;

        const isTimeout = err.name === "AbortError"
          || err.message?.includes("timeout")
          || err.message?.includes("timed out");
        const is5xx = /5\d{2}/.test(err.message || "");
        const isNetworkError = isTimeout || is5xx || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND";

        this.recordFailure(ep, err.message);

        this.logger.warn(
          {
            endpoint: ep.url,
            attempt,
            elapsed,
            err: err.message,
            isNetworkError,
            label,
          },
          `RPC call failed - ${isNetworkError ? "rotating endpoint" : "will retry"}`
        );

        // Rotate to next endpoint for network-level failures
        if (isNetworkError) {
          this.rotateEndpoint();
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`RPC operation failed after ${this.config.maxRetries} attempts`);
  }

  /** Stop the health check timer. */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private createClient(url: string): SuiClient {
    const transport = new SuiHTTPTransport({
      url,
      rpc: {
        headers: {
          "Content-Type": "application/json",
        },
      },
    });
    return new SuiClient({ transport });
  }

  private getBestEndpoint(): EndpointHealth {
    const now = Date.now();

    // Try to recover endpoints that have been down for a while
    for (const ep of this.endpoints) {
      if (!ep.healthy && now - ep.lastFailureAt > RECOVERY_COOLDOWN_MS) {
        ep.healthy = true;
        ep.consecutiveFailures = 0;
        this.logger.info({ endpoint: ep.url }, "Endpoint recovered - marking healthy");
      }
    }

    // Use round-robin starting from currentIndex — pick the first healthy endpoint
    for (let i = 0; i < this.endpoints.length; i++) {
      const idx = (this.currentIndex + i) % this.endpoints.length;
      if (this.endpoints[idx].healthy) {
        return this.endpoints[idx];
      }
    }

    // All endpoints down — reset the highest-weight one and try it
    const best = this.endpoints.reduce((a, b) => (a.weight >= b.weight ? a : b));
    best.healthy = true;
    best.consecutiveFailures = 0;
    this.currentIndex = this.endpoints.indexOf(best);
    this.logger.warn({ endpoint: best.url }, "All endpoints unhealthy - forcing reset on primary");
    return best;
  }

  private rotateEndpoint(): void {
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
  }

  private recordSuccess(ep: EndpointHealth, responseMs: number): void {
    ep.healthy = true;
    ep.consecutiveFailures = 0;
    ep.lastSuccessAt = Date.now();
    // Rolling average
    ep.avgResponseMs = ep.avgResponseMs === 0
      ? responseMs
      : ep.avgResponseMs * 0.7 + responseMs * 0.3;
  }

  private recordFailure(ep: EndpointHealth, errorMsg: string): void {
    ep.consecutiveFailures++;
    ep.lastFailureAt = Date.now();

    if (ep.consecutiveFailures >= UNHEALTHY_THRESHOLD) {
      ep.healthy = false;
      this.logger.error(
        { endpoint: ep.url, failures: ep.consecutiveFailures },
        "Endpoint marked unhealthy"
      );
    }
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with full jitter
    const exp = Math.min(
      this.config.baseRetryDelayMs * Math.pow(2, attempt - 1),
      this.config.maxRetryDelayMs
    );
    const jitter = Math.random() * exp;
    return Math.floor(jitter);
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`RPC request timed out after ${ms}ms`));
      }, ms);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async runHealthChecks(): Promise<void> {
    for (const ep of this.endpoints) {
      if (ep.healthy) continue; // Only check unhealthy endpoints

      const now = Date.now();
      if (now - ep.lastFailureAt < RECOVERY_COOLDOWN_MS) continue;

      try {
        const client = this.clients.get(ep.url)!;
        const start = Date.now();
        await this.withTimeout(client.getLatestSuiSystemState(), 10_000);
        this.recordSuccess(ep, Date.now() - start);
        this.logger.info({ endpoint: ep.url }, "Health check passed - endpoint recovered");
      } catch {
        ep.lastFailureAt = now;
        this.logger.debug({ endpoint: ep.url }, "Health check failed - still unhealthy");
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
