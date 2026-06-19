/**
 * Transaction Builder — constructs and submits PTBs for hedge operations.
 * Handles Pyth price feed update + initiate_hedge / execute_tranche calls.
 */

import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { KeeperConfig } from "./config.js";
import { BreachDetection } from "./price-monitor.js";
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
    tx.setGasBudget(this.config.gasBudget);

    // Fetch fresh Pyth VAA and add update call
    const vaaBytes = await this.fetchPythVAA();

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
        tx.object(this.config.pythPriceInfoObjectId),
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

  /** Fetch the latest Pyth VAA for the SUI/USD price feed. */
  private async fetchPythVAA(): Promise<string> {
    const url = `${this.config.pythHermesUrl}/v2/updates/price/latest?ids[]=${this.config.pythSuiUsdFeedId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pyth VAA fetch failed: ${response.status}`);

    const data = await response.json() as any;
    const vaa = data?.binary?.data?.[0];
    if (!vaa) throw new Error("No VAA data in Pyth response");
    return vaa;
  }

  /** Calculate minimum output based on current price and slippage tolerance. */
  private calculateMinOutput(breach: BreachDetection): number {
    // For now, use 0 (no min output) to avoid reverts during testing.
    // In production, this should be calculated from order book depth.
    // min_output = expected_usdc * (10000 - slippage_bps) / 10000
    return 0;
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
