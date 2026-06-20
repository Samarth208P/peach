import "dotenv/config";
import { loadConfig } from "./dist/config.js";
import { SuiClient } from "@mysten/sui/client";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";

async function test() {
  const config = loadConfig();
  const client = new SuiClient({ url: config.suiRpcUrl });
  const pythClient = new SuiPythClient(client as any, config.pythStateId, config.wormholeStateId);
  
  const feedIdNo0x = config.pythSuiUsdFeedId.replace("0x", "");
  const feedIdWith0x = config.pythSuiUsdFeedId.startsWith("0x") ? config.pythSuiUsdFeedId : "0x" + config.pythSuiUsdFeedId;

  console.log("No 0x:", await pythClient.getPriceFeedObjectId(feedIdNo0x));
  console.log("With 0x:", await pythClient.getPriceFeedObjectId(feedIdWith0x));
}

test().catch(console.error);
