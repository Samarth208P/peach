import { SuiClient } from '@mysten/sui/client';

async function main() {
  const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
  
  try {
    const events = await client.queryEvents({
      query: { MoveEventType: '0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837::pyth::PriceFeedUpdateEvent' },
      limit: 20,
      order: 'descending'
    });
    console.log("Found update events:", events.data.length);
    for (const e of events.data) {
       console.log(JSON.stringify(e.parsedJson));
    }
  } catch (e) {
    console.error(e);
  }
}

main();
