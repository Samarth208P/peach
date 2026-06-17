import { SuiPythClient } from '@pythnetwork/pyth-sui-js';
import { HermesClient } from '@pythnetwork/hermes-client';
import { Transaction } from '@mysten/sui/transactions';

async function main() {
  const hermes = new HermesClient("https://hermes.pyth.network", {});
  const updates = await hermes.getLatestPriceUpdates(["0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744"]);
  console.log("Updates fetched", updates.binary.data.length);

  const tx = new Transaction();
  const pythClient = new SuiPythClient(
    {} as any, 
    "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c", 
    "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790"
  );
  
  // mock the base fee so it doesn't try to fetch from rpc
  pythClient.getBaseUpdateFee = async () => 1n;
  pythClient.getPythPackageId = async () => "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837";
  pythClient.getWormholePackageId = async () => "0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a";
  
  const bufferUpdates = updates.binary.data.map(hex => Buffer.from(hex, 'hex'));
  
  const objIds = await pythClient.updatePriceFeeds(tx, bufferUpdates, ["0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744"]);
  console.log("Transaction successfully built!");
  console.log(tx.blockData);
}

main().catch(console.error);
