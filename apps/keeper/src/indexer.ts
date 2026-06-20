/**
 * Stream Registry Indexer — maintains an in-memory + persistent registry
 * of streams that the Keeper is responsible for monitoring.
 *
 * Streams are registered via the POST /register-stream API (called by the
 * frontend after on-chain creation). On-chain state is refreshed periodically.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SuiClient } from "@mysten/sui/client";
import { KeeperConfig } from "./config.js";
import { StreamState, LIQUIDATION_STATUS } from "./types.js";
import { Logger } from "pino";

const REGISTRY_FILE = resolve("registered_streams.json");

export class EventIndexer {
  private streams: Map<string, StreamState> = new Map();
  private client: SuiClient;
  private config: KeeperConfig;
  private logger: Logger;

  constructor(client: SuiClient, config: KeeperConfig, logger: Logger) {
    this.client = client;
    this.config = config;
    this.logger = logger.child({ module: "indexer" });
  }

  /** Start indexing: load persisted stream IDs and refresh their on-chain state. */
  async start(): Promise<void> {
    const ids = this.loadRegistry();
    this.logger.info({ count: ids.length, file: REGISTRY_FILE }, "Loaded stream registry from disk");

    // Populate placeholder entries so refreshAll can hydrate them
    for (const id of ids) {
      if (!this.streams.has(id)) {
        this.streams.set(id, this.emptyStreamState(id));
      }
    }

    await this.refreshAll();
    this.logger.info({ active: this.streams.size }, "Indexer started (registry mode)");
  }

  /** No-op stop — no subscription to tear down. */
  async stop(): Promise<void> {
    // Nothing to clean up in registry mode
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Register a new stream by ID. Fetches on-chain state and persists to disk. */
  async registerStream(streamId: string): Promise<boolean> {
    if (this.streams.has(streamId)) {
      this.logger.info({ streamId }, "Stream already registered");
      return true;
    }

    this.streams.set(streamId, this.emptyStreamState(streamId));
    this.persistRegistry();

    // Hydrate on-chain data
    await this.refreshStreamsBatch([streamId]);

    // If the object doesn't exist on-chain, remove it
    if (!this.streams.has(streamId)) {
      this.logger.warn({ streamId }, "Stream not found on-chain — removed from registry");
      this.persistRegistry();
      return false;
    }

    this.logger.info({ streamId }, "Stream registered successfully");
    return true;
  }

  /** Get all monitored streams. */
  getStreams(): Map<string, StreamState> {
    return this.streams;
  }

  /** Get streams that need hedge initiation (HEALTHY + breach). */
  getHealthyStreams(): StreamState[] {
    return [...this.streams.values()].filter(
      (s) => s.liquidationStatus === LIQUIDATION_STATUS.HEALTHY
    );
  }

  /** Get streams in active TWAP (need tranche execution). */
  getTWAPActiveStreams(): StreamState[] {
    return [...this.streams.values()].filter(
      (s) => s.liquidationStatus === LIQUIDATION_STATUS.TWAP_ACTIVE
    );
  }

  /** Get streams that have fully vested (past endTime) but still hold unclaimed balance. */
  getMaturedStreams(): StreamState[] {
    const now = Date.now();
    return [...this.streams.values()].filter(
      (s) => now >= s.endTime && (s.suiBalance > 0n || s.usdcBalance > 0n)
    );
  }

  /** Update stream state after a successful hedge/tranche. */
  updateStreamState(streamId: string, updates: Partial<StreamState>): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      Object.assign(stream, updates);
    }
  }

  /** Remove a stream from monitoring. */
  removeStream(streamId: string): void {
    this.streams.delete(streamId);
    this.persistRegistry();
  }

  /** Public method to refresh all streams (called periodically). */
  async refreshAll(): Promise<void> {
    const allIds = Array.from(this.streams.keys());
    for (let i = 0; i < allIds.length; i += 50) {
      const chunk = allIds.slice(i, i + 50);
      await this.refreshStreamsBatch(chunk);
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /** Load stream IDs from the persistent JSON file. */
  private loadRegistry(): string[] {
    try {
      if (!existsSync(REGISTRY_FILE)) return [];
      const raw = readFileSync(REGISTRY_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      return [];
    } catch (err) {
      this.logger.warn({ err, file: REGISTRY_FILE }, "Failed to read registry file — starting fresh");
      return [];
    }
  }

  /** Persist the current set of stream IDs to disk. */
  private persistRegistry(): void {
    try {
      const dir = dirname(REGISTRY_FILE);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const ids = Array.from(this.streams.keys());
      writeFileSync(REGISTRY_FILE, JSON.stringify(ids, null, 2), "utf-8");
    } catch (err) {
      this.logger.error({ err, file: REGISTRY_FILE }, "Failed to persist registry");
    }
  }

  // ─── On-chain Refresh ──────────────────────────────────────────────────────

  /** Refresh multiple streams' on-chain state using multiGetObjects. */
  private async refreshStreamsBatch(streamIds: string[]): Promise<void> {
    if (streamIds.length === 0) return;

    try {
      const objs = await this.client.multiGetObjects({
        ids: streamIds,
        options: { showContent: true },
      });

      for (const obj of objs) {
        if (!obj.data?.objectId) continue;
        const streamId = obj.data.objectId;

        if (!obj.data?.content || obj.data.content.dataType !== "moveObject") {
          this.streams.delete(streamId);
          continue;
        }

        const fields = (obj.data.content as any).fields;
        if (!fields) continue;

        const stream = this.streams.get(streamId);
        if (!stream) continue;

        // Hydrate all fields from on-chain data
        stream.sender = fields.sender || stream.sender;
        stream.receiver = fields.receiver || stream.receiver;
        stream.totalAmount = BigInt(fields.total_amount || 0);
        stream.strikePrice = BigInt(fields.strike_price || 0);
        stream.hedgeDirection = Number(fields.hedge_direction || 0);
        stream.startTime = Number(fields.start_time || 0);
        stream.endTime = Number(fields.end_time || 0);
        stream.liquidationStatus = Number(fields.liquidation_status || 0);
        stream.tranchesExecuted = Number(fields.tranches_executed || 0);
        stream.lastTrancheTimestamp = Number(fields.last_tranche_timestamp || 0);
        stream.twapTranches = Number(fields.twap_tranches || 5);
        stream.twapIntervalMs = Number(fields.twap_interval_ms || 720_000);
        stream.totalSuiAtHedgeStart = BigInt(fields.total_sui_at_hedge_start || 0);
        stream.suiBalance = BigInt(fields.balance || 0);
        stream.usdcBalance = BigInt(fields.usdc_balance || 0);

        // Remove fully claimed streams (no balance left)
        if (stream.suiBalance === 0n && stream.usdcBalance === 0n) {
          this.streams.delete(streamId);
        }
      }
    } catch (err) {
      this.logger.error({ err }, "Failed to refresh stream state batch");
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Create an empty placeholder StreamState for a given ID. */
  private emptyStreamState(streamId: string): StreamState {
    return {
      streamId,
      sender: "",
      receiver: "",
      totalAmount: 0n,
      strikePrice: 0n,
      hedgeDirection: 0,
      startTime: 0,
      endTime: 0,
      twapTranches: 5,
      twapIntervalMs: 720_000,
      liquidationStatus: LIQUIDATION_STATUS.HEALTHY,
      tranchesExecuted: 0,
      lastTrancheTimestamp: 0,
      totalSuiAtHedgeStart: 0n,
      suiBalance: 0n,
      usdcBalance: 0n,
    };
  }
}
