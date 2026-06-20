/**
 * Transaction Builder — constructs and submits PTBs for hedge operations.
 * Handles Pyth price feed update + initiate_hedge / execute_tranche calls.
 */

import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { KeeperConfig } from "./config.js";
import { BreachDetection } from "./price-monitor.js";
import { StreamState } from "./types.js";
import { Logger } from "pino";

const SUI_CLOCK = "0x6";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export class TransactionBuilder {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private config: KeeperConfig;
  private logger: Logger;

  constructor(client: SuiClient, config: KeeperConfig, logger: Logger) {
    this.client = client;
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

  /** Execute a hedge action with retry logic. */
  async executeHedge(breach: BreachDetection): Promise<string | null> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const digest = await this.buildAndSubmit(breach);
        this.logger.info(
          { streamId: breach.stream.streamId, action: breach.action, digest, attempt },
          "Hedge transaction succeeded"
        );
        return digest;
      } catch (err: any) {
        this.logger.warn(
          { streamId: breach.stream.streamId, action: breach.action, attempt, err: err.message },
          "Transaction attempt failed"
        );
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
    this.logger.error(
      { streamId: breach.stream.streamId, action: breach.action },
      "All retry attempts exhausted"
    );
    return null;
  }

  /** Build the PTB and submit it. */
  private async buildAndSubmit(breach: BreachDetection): Promise<string> {
    const tx = new Transaction();

    // Fetch fresh Pyth VAA and inject update call
    const priceInfoObjectId = await this.preparePythUpdate(tx);

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

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== "success") {
      throw new Error(`Transaction failed: ${result.effects?.status?.error || "unknown"}`);
    }

    return result.digest;
  }

  /** Fetch the latest Pyth VAA and append updatePriceFeeds to the PTB. Returns the fresh PriceInfoObjectId. */
  private async preparePythUpdate(tx: Transaction): Promise<string> {
    const feedId = this.config.pythSuiUsdFeedId.replace("0x", "");
    const url = `${this.config.pythHermesUrl}/v2/updates/price/latest?ids[]=${feedId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pyth VAA fetch failed: ${response.status}`);

    const data = await response.json() as any;
    const vaaHex = data?.binary?.data?.[0];
    if (!vaaHex) throw new Error("No VAA data in Pyth response");

    const bufferUpdates = [Buffer.from(vaaHex, "hex")];
    
    // Lazy load SuiPythClient to avoid massive cold starts
    const { SuiPythClient } = await import("@pythnetwork/pyth-sui-js");
    const pythClient = new SuiPythClient(this.client as any, this.config.pythStateId, this.config.wormholeStateId);
    
    const pythFeedIdHex = `0x${feedId}`;
    let objectId = await pythClient.getPriceFeedObjectId(pythFeedIdHex);
    
    if (!objectId) {
      this.logger.warn("Pyth PriceFeed object not found dynamically. Creating it in a separate transaction...");
      const createTx = new Transaction();
      await pythClient.createPriceFeed(createTx as any, bufferUpdates);
      const res = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: createTx,
      });
      await this.client.waitForTransaction({ digest: res.digest });
      this.logger.info("Successfully created Pyth PriceFeed object on-chain!");
      
      objectId = await pythClient.getPriceFeedObjectId(pythFeedIdHex);
    }
    
    if (!objectId) {
      throw new Error("Pyth PriceFeed object not found and creation failed. Cannot proceed.");
    }

    const priceInfoObjectIds = await pythClient.updatePriceFeeds(tx as any, bufferUpdates, [pythFeedIdHex]);
    return priceInfoObjectIds[0];
  }

  /** Calculate minimum output based on current price and slippage tolerance. */
  private calculateMinOutput(breach: BreachDetection): number {
    // For now, use 0 (no min output) to avoid reverts during testing.
    // In production, this should be calculated from order book depth.
    // min_output = expected_usdc * (10000 - slippage_bps) / 10000
    return 0;
  }

  /** Execute an auto-claim for a matured stream with retry logic. */
  async executeAutoClaim(stream: StreamState): Promise<string | null> {
    const fs = await import("fs");
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const digest = await this.buildAndSubmitClaim(stream);
        this.logger.info(
          { streamId: stream.streamId, digest, attempt },
          "Auto-claim transaction succeeded"
        );
        return digest;
      } catch (err: any) {
        this.logger.warn(
          { streamId: stream.streamId, attempt, err: err.message },
          "Auto-claim attempt failed"
        );
        fs.appendFileSync("keeper-error.log", `[${new Date().toISOString()}] AUTO-CLAIM FAILED: ${err.message}\n${err.stack}\n`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
    this.logger.error(
      { streamId: stream.streamId },
      "Auto-claim: all retry attempts exhausted"
    );
    return null;
  }

  /** Build and submit a claim_stream PTB on behalf of the receiver. */
  private async buildAndSubmitClaim(stream: StreamState): Promise<string> {
    const tx = new Transaction();

    // Fetch fresh Pyth VAA and inject update call
    const priceInfoObjectId = await this.preparePythUpdate(tx);

    // Create DEEP fee coin (zero coin for taker fee — needed by claim_stream's hedge path)
    const deepCoin = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: ["0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP"],
    });

    // Call claim_stream — arguments match the on-chain signature:
    //   stream, price_info, deepbook_pool, deep_fee, registry, clock
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

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== "success") {
      throw new Error(`Auto-claim failed: ${result.effects?.status?.error || "unknown"}`);
    }

    return result.digest;
  }

  /** Get keeper wallet SUI balance. */
  async getWalletBalance(): Promise<bigint> {
    const balance = await this.client.getBalance({
      owner: this.getAddress(),
    });
    return BigInt(balance.totalBalance);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
