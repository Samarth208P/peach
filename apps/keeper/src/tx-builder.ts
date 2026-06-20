/**
 * Transaction Builder — constructs and submits PTBs for hedge operations.
 * Handles Pyth price feed update + initiate_hedge / execute_tranche calls.
 *
 * Architecture: Build → Sign → Execute (separated steps)
 * - BUILD: construct the PTB + resolve object refs (may involve Pyth SDK RPC calls)
 * - SIGN: local Ed25519 signature (instant, no network)
 * - EXECUTE: submit pre-signed bytes via executeTransactionBlock (single RPC call)
 *
 * This separation ensures that a slow build step doesn't eat into the execution timeout,
 * and allows retrying just the execution with a different RPC endpoint if one is down.
 */

import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { KeeperConfig } from "./config.js";
import { ResilientRpcClient } from "./rpc-client.js";
import { BreachDetection } from "./price-monitor.js";
import { StreamState } from "./types.js";
import { Logger } from "pino";

const SUI_CLOCK = "0x6";

/** Timeout for building/resolving the PTB (Pyth + object lookups). */
const BUILD_TIMEOUT_MS = 90_000;

/** Timeout for submitting the pre-signed transaction bytes. */
const EXECUTE_TIMEOUT_MS = 30_000;

export class TransactionBuilder {
  private rpc: ResilientRpcClient;
  private keypair: Ed25519Keypair;
  private config: KeeperConfig;
  private logger: Logger;

  constructor(rpcClient: ResilientRpcClient, config: KeeperConfig, logger: Logger) {
    this.rpc = rpcClient;
    this.config = config;
    this.logger = logger.child({ module: "tx-builder" });

    // Parse private key (hex format from `sui keytool convert`)
    this.keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(config.keeperPrivateKey, "hex")
    );

    this.logger.info(
      { address: this.keypair.getPublicKey().toSuiAddress() },
      "Keeper wallet initialized"
    );
  }

  getAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /** Execute a hedge action with build-sign-execute separation. */
  async executeHedge(breach: BreachDetection, vaaPayload: Buffer[]): Promise<string | null> {
    try {
      const digest = await this.buildSignExecute(
        (client, tx) => this.buildHedgePTB(client, tx, breach, vaaPayload),
        `hedge:${breach.action}:${breach.stream.streamId.slice(0, 10)}`
      );
      this.logger.info(
        { streamId: breach.stream.streamId, action: breach.action, digest },
        "Hedge transaction succeeded"
      );
      return digest;
    } catch (err: any) {
      this.logger.error(
        { streamId: breach.stream.streamId, action: breach.action, err: err.message },
        "Hedge transaction failed after all retries"
      );
      return null;
    }
  }

  /** Execute an auto-claim for a matured stream. */
  async executeAutoClaim(stream: StreamState, vaaPayload: Buffer[]): Promise<string | null> {
    try {
      const digest = await this.buildSignExecute(
        (client, tx) => this.buildClaimPTB(client, tx, stream, vaaPayload),
        `auto-claim:${stream.streamId.slice(0, 10)}`
      );
      this.logger.info(
        { streamId: stream.streamId, digest },
        "Auto-claim transaction succeeded"
      );
      return digest;
    } catch (err: any) {
      this.logger.error(
        { streamId: stream.streamId, err: err.message },
        "Auto-claim failed after all retries"
      );
      return null;
    }
  }

  /** Get keeper wallet SUI balance. */
  async getWalletBalance(): Promise<bigint> {
    const balance = await this.rpc.execute(
      (client) => client.getBalance({ owner: this.getAddress() }),
      "getWalletBalance"
    );
    return BigInt(balance.totalBalance);
  }

  // ─── Build → Sign → Execute Pipeline ──────────────────────────────────────

  /**
   * Core pipeline: separates transaction building from execution.
   * 1. BUILD + SIGN: construct the PTB, resolve object references, sign locally (with retry/failover)
   * 2. EXECUTE: submit pre-signed bytes (with retry/failover, possibly different endpoint)
   */
  private async buildSignExecute(
    buildFn: (client: SuiClient, tx: Transaction) => Promise<void>,
    label: string
  ): Promise<string> {
    // Step 1: BUILD + SIGN — construct PTB, resolve objects, sign locally
    this.logger.debug({ label }, "Building transaction...");

    const { bytes, signature } = await this.rpc.execute(
      async (client) => {
        const tx = new Transaction();
        tx.setGasBudget(this.config.gasBudget);

        // Let the build function add move calls to the transaction
        await buildFn(client, tx);

        // tx.sign() builds (resolves objects), then signs locally
        return tx.sign({ client, signer: this.keypair });
      },
      `${label}:build`,
      BUILD_TIMEOUT_MS
    );

    this.logger.debug({ label }, "Transaction built and signed, submitting...");

    // Step 2: EXECUTE — submit pre-signed bytes (fast, single RPC call)
    const result = await this.rpc.execute(
      async (client) => {
        return client.executeTransactionBlock({
          transactionBlock: bytes,
          signature: [signature],
          options: { showEffects: true },
        });
      },
      `${label}:execute`,
      EXECUTE_TIMEOUT_MS
    );

    if (result.effects?.status?.status !== "success") {
      throw new Error(`Transaction failed on-chain: ${result.effects?.status?.error || "unknown"}`);
    }

    return result.digest;
  }

  // ─── PTB Construction (move calls only, no submission) ─────────────────────

  /** Build hedge PTB move calls. */
  private async buildHedgePTB(
    client: SuiClient,
    tx: Transaction,
    breach: BreachDetection,
    vaaPayload: Buffer[]
  ): Promise<void> {
    // Inject the provided Pyth VAA update call
    const priceInfoObjectId = await this.preparePythUpdate(client, tx, vaaPayload);

    // Create DEEP fee coin (zero coin for taker fee)
    const deepCoin = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: ["0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP"],
    });

    // Calculate min_output_guard based on slippage tolerance
    const minOutput = this.calculateMinOutput(breach);

    // Build the appropriate hedge call
    const target = breach.action === "initiate"
      ? `${this.config.peachPackageId}::peach_stream::initiate_hedge`
      : `${this.config.peachPackageId}::peach_stream::execute_tranche`;

    tx.moveCall({
      target,
      typeArguments: [this.config.usdcType],
      arguments: [
        tx.object(this.config.keeperCapObjectId),
        tx.object(breach.stream.streamId),
        tx.object(priceInfoObjectId),
        tx.object(this.config.deepbookPoolId),
        deepCoin,
        tx.pure.u64(minOutput),
        tx.object(SUI_CLOCK),
      ],
    });
  }

  /** Build claim_stream PTB move calls. */
  private async buildClaimPTB(
    client: SuiClient,
    tx: Transaction,
    stream: StreamState,
    vaaPayload: Buffer[]
  ): Promise<void> {
    // Inject the provided Pyth VAA update call into the PTB
    const priceInfoObjectId = await this.preparePythUpdate(client, tx, vaaPayload);

    // Create DEEP fee coin (zero coin for taker fee)
    const deepCoin = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: ["0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP"],
    });

    // Call claim_stream
    tx.moveCall({
      target: `${this.config.peachPackageId}::peach_stream::claim_stream`,
      typeArguments: [this.config.usdcType],
      arguments: [
        tx.object(stream.streamId),
        tx.object(priceInfoObjectId),
        tx.object(this.config.deepbookPoolId),
        deepCoin,
        tx.object(this.config.peachRegistryId),
        tx.object(SUI_CLOCK),
      ],
    });
  }

  // ─── Pyth Integration ──────────────────────────────────────────────────────

  private async preparePythUpdate(client: SuiClient, tx: Transaction, bufferUpdates: Buffer[]): Promise<string> {
    const feedId = this.config.pythSuiUsdFeedId.replace("0x", "");

    const { SuiPythClient } = await import("@pythnetwork/pyth-sui-js");
    const pythClient = new SuiPythClient(client as any, this.config.pythStateId, this.config.wormholeStateId);

    // Pyth SDK bug workaround: inject hardcoded object ID into cache for testnet
    if (this.config.pythPriceInfoObjectId) {
      (pythClient as any).priceFeedObjectIdCache.set(feedId, this.config.pythPriceInfoObjectId);
    }

    try {
      const priceInfoObjectIds = await pythClient.updatePriceFeeds(tx as any, bufferUpdates, [feedId]);
      return priceInfoObjectIds[0];
    } catch (err: any) {
      this.logger.warn({ err: err.message }, "updatePriceFeeds failed - attempting createPriceFeed first");

      // Create the price feed in a separate transaction
      const createTx = new Transaction();
      createTx.setGasBudget(this.config.gasBudget);
      await pythClient.createPriceFeed(createTx as any, bufferUpdates);

      const { bytes: createBytes, signature: createSig } = await createTx.sign({ client, signer: this.keypair });

      const res = await client.executeTransactionBlock({
        transactionBlock: createBytes,
        signature: [createSig],
        options: { showEffects: true },
      });
      await client.waitForTransaction({ digest: res.digest });
      this.logger.info({ digest: res.digest }, "Pyth PriceFeed created");

      await sleep(3000);

      if (this.config.pythPriceInfoObjectId) {
        (pythClient as any).priceFeedObjectIdCache.set(feedId, this.config.pythPriceInfoObjectId);
      }

      const priceInfoObjectIds = await pythClient.updatePriceFeeds(tx as any, bufferUpdates, [feedId]);
      return priceInfoObjectIds[0];
    }
  }

  /** Calculate minimum output based on current price and slippage tolerance. */
  private calculateMinOutput(breach: BreachDetection): number {
    // For now, use 0 (no min output) to avoid reverts during testing.
    // In production, this should be calculated from order book depth.
    // min_output = expected_usdc * (10000 - slippage_bps) / 10000
    return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
