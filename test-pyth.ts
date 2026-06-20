const { SuiClient } = require("@mysten/sui.js/client");
const { SuiPythClient } = require("@pythnetwork/pyth-sui-js");

async function main() {
  const client = new SuiClient({ url: "https://fullnode.testnet.sui.io:443" });
  const pythStateId = "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c";
  const wormholeStateId = "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790";
  
  const pythClient = new SuiPythClient(client, pythStateId, wormholeStateId);
  
  const feedIdNo0x = "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";
  const feedIdWith0x = "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";
  
  console.log("Without 0x:", await pythClient.getPriceFeedObjectId(feedIdNo0x));
  console.log("With 0x:", await pythClient.getPriceFeedObjectId(feedIdWith0x));
}

main().catch(console.error);
