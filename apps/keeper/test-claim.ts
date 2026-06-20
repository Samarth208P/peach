import "dotenv/config";
import { loadConfig } from "./dist/config.js";
import { TransactionBuilder } from "./dist/tx-builder.js";
import { SuiClient } from "@mysten/sui/client";
import pino from "pino";

const logger = pino();
const config = loadConfig();
const client = new SuiClient({ url: config.suiRpcUrl });
const tx = new TransactionBuilder(client, config, logger);

tx.executeAutoClaim({
  streamId: "0x443dea13f1f9ddfb9a607f76610b06e6824126e6fd6d2a6c8e93b1b9a48939ec",
  sender: "0x0",
  receiver: "0x0",
  totalAmount: 100000000n,
  strikePrice: 1n,
  hedgeDirection: 0,
  startTime: 0,
  endTime: 0,
  liquidationStatus: 0,
  twapTranches: 5,
  twapIntervalMs: 0,
  tranchesExecuted: 0,
  lastTrancheTimestamp: 0,
  totalSuiAtHedgeStart: 0n,
  suiBalance: 100000000n,
  usdcBalance: 0n
}).then(console.log).catch(console.error);
