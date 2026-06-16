import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

const mnemonic = "void film enrich scatter siren economy into trap hawk ice farm drift";
const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

async function runTest() {
    console.log("Starting Peach Router PTB Test...");
    console.log("Address:", keypair.toSuiAddress());

    const txb = new TransactionBlock();
    
    // Deposit 1 SUI
    const [deposit] = txb.splitCoins(txb.gas, [1_000_000_000]);

    // Call Peach Stream contract
    const packageId = "0xf37d6e0d6dc179a4835f2aa44a02c0310dea32508180046c14141fa04dad3f41";
    
    console.log("Executing PTB to route 1% premium...");
    const result_tuple = txb.moveCall({
        target: `${packageId}::peach_stream::create_stream`,
        arguments: [deposit, txb.pure(keypair.toSuiAddress())]
    });

    // In a PTB, returning a tuple yields multiple variables. 
    // result_tuple[0] = Stream
    // result_tuple[1] = 1% Premium Coin<SUI>
    const stream = result_tuple[0];
    const premium = result_tuple[1];

    // Transfer both back to the user to verify extraction worked
    txb.transferObjects([stream, premium], txb.pure(keypair.toSuiAddress()));

    try {
        const result = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: txb,
            options: { showEffects: true, showObjectChanges: true }
        });

        console.log("Success! Digest:", result.digest);
        console.log("\nObject Changes:");
        result.objectChanges?.forEach(change => {
            if (change.type === 'created') {
                console.log(`Created [${change.objectType}] - ID: ${change.objectId}`);
            }
        });
    } catch (e) {
        console.error("Execution Failed:", e);
    }
}

runTest();
