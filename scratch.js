const { SuiClient } = require('@mysten/sui/client');

async function main() {
  const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
  
  try {
    const obj = await client.getObject({
      id: '0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266',
      options: { showContent: true }
    });
    console.log("Old object:", JSON.stringify(obj, null, 2));

    const events = await client.queryEvents({
      query: { MoveEventType: '0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837::pyth::PriceFeedCreated' },
      limit: 50,
      order: 'descending'
    });
    console.log("PriceFeedCreated events count:", events.data.length);
    for (const e of events.data) {
      if (e.parsedJson && e.parsedJson.price_info_object_id && e.parsedJson.price_feed_id === '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744') {
         console.log("Found SUI/USD Price Feed Created Event!");
         console.log(e);
      }
    }
    
    // Also, query the latest events for ANY price feed, just to see what the id is.
    const all = await client.queryEvents({
      query: { MoveEventType: '0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837::pyth::PriceFeedUpdateEvent' },
      limit: 10,
      order: 'descending'
    });
    console.log("Found update events:", all.data.length);
  } catch (e) {
    console.error(e);
  }
}

main();
