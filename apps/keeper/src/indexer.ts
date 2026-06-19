/**
 * Event Indexer — subscribes to StreamCreated events and maintains
 * an in-memory registry of all active streams to monitor.
 */

import { SuiClient, SuiEvent } from "@mysten/sui/client";
import { KeeperConfig } from "./config.js";
import { StreamState, LIQUIDATION_STATUS } from "./types.js";
import { Logger } from "pino";

export class EventIndexer {
  private streams: Map<string, StreamState> = new Map();
  private client: SuiClient;
  private config: KeeperConfig;
  private logger: Logger;
  private unsubscribe: (() => void) | null = null;

  constructor(client: SuiClient, config: KeeperConfig, logger: Logger) {
    this.client = client;
    this.config = config;
    this.logger = logger.child({ module: "indexer" });
  }

  /** Start indexing: load existing streams then subscribe to new events. */
  async start(): Promise<void> {
    await this.loadExistingStreams();
    await this.subscribeToEvents();
    this.logger.info({ count: this.streams.size }, "Indexer started");
  }

  /** Stop the event subscription. */
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
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

  /** Update stream state after a successful hedge/tranche. */
  updateStreamState(streamId: string, updates: Partial<StreamState>): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      Object.assign(stream, updates);
    }
  }

  /** Remove fully hedged + fully claimed streams. */
  removeStream(streamId: string): void {
    this.streams.delete(streamId);
  }

  /** Query historical StreamCreated events and build initial state. */
  private async loadExistingStreams(): Promise<void> {
    const eventType = `${this.config.peachPackageId}::peach_stream::StreamCreated`;
    let cursor: { txDigest: string; eventSeq: string } | null | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.queryEvents({
        query: { MoveEventType: eventType },
        order: "ascending",
        cursor: cursor ?? undefined,
        limit: 50,
      });

      for (const event of response.data) {
        this.processStreamCreated(event);
      }

      hasMore = response.hasNextPage;
      cursor = response.nextCursor ?? undefined;
    }

    // Now refresh on-chain state for each stream
    for (const [streamId] of this.streams) {
      await this.refreshStreamOnChain(streamId);
    }
  }

  /** Subscribe to real-time events. */
  private async subscribeToEvents(): Promise<void> {
    const eventType = `${this.config.peachPackageId}::peach_stream::StreamCreated`;

    try {
      const unsub = await this.client.subscribeEvent({
        filter: { MoveEventType: eventType },
        onMessage: (event: SuiEvent) => {
          this.processStreamCreated(event);
          this.logger.info({ streamId: (event.parsedJson as any)?.stream_id }, "New stream detected");
        },
      });
      this.unsubscribe = unsub;
    } catch (err) {
      this.logger.warn({ err }, "Event subscription failed — falling back to polling");
    }
  }

  /** Parse a StreamCreated event into our state map. */
  private processStreamCreated(event: SuiEvent): void {
    const data = event.parsedJson as any;
    if (!data?.stream_id) return;

    const streamId = data.stream_id;
    if (this.streams.has(streamId)) return;

    this.streams.set(streamId, {
      streamId,
      sender: data.sender || "",
      receiver: data.receiver || "",
      totalAmount: BigInt(data.total_amount || 0),
      strikePrice: BigInt(data.strike_price || 0),
      hedgeDirection: Number(data.hedge_direction || 0),
      startTime: Number(data.start_time || 0),
      endTime: Number(data.end_time || 0),
      twapTranches: 5, // default, will be refreshed
      twapIntervalMs: 720_000,
      liquidationStatus: LIQUIDATION_STATUS.HEALTHY,
      tranchesExecuted: 0,
      lastTrancheTimestamp: 0,
      totalSuiAtHedgeStart: 0n,
      suiBalance: BigInt(data.total_amount || 0),
      usdcBalance: 0n,
    });
  }

  /** Refresh a stream's on-chain state by reading the shared object. */
  private async refreshStreamOnChain(streamId: string): Promise<void> {
    try {
      const obj = await this.client.getObject({
        id: streamId,
        options: { showContent: true },
      });

      if (!obj.data?.content || obj.data.content.dataType !== "moveObject") {
        this.streams.delete(streamId);
        return;
      }

      const fields = (obj.data.content as any).fields;
      if (!fields) return;

      const stream = this.streams.get(streamId);
      if (!stream) return;

      stream.liquidationStatus = Number(fields.liquidation_status || 0);
      stream.tranchesExecuted = Number(fields.tranches_executed || 0);
      stream.lastTrancheTimestamp = Number(fields.last_tranche_timestamp || 0);
      stream.twapTranches = Number(fields.twap_tranches || 5);
      stream.twapIntervalMs = Number(fields.twap_interval_ms || 720_000);
      stream.totalSuiAtHedgeStart = BigInt(fields.total_sui_at_hedge_start || 0);
      stream.suiBalance = BigInt(fields.balance || 0);
      stream.usdcBalance = BigInt(fields.usdc_balance || 0);

      // Remove fully hedged + fully claimed streams
      if (stream.liquidationStatus === LIQUIDATION_STATUS.FULLY_HEDGED &&
          stream.suiBalance === 0n && stream.usdcBalance === 0n) {
        this.streams.delete(streamId);
      }
    } catch (err) {
      this.logger.error({ err, streamId }, "Failed to refresh stream state");
    }
  }

  /** Public method to refresh all streams (called periodically). */
  async refreshAll(): Promise<void> {
    for (const [streamId] of this.streams) {
      await this.refreshStreamOnChain(streamId);
    }
  }
}
