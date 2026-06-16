module peach_contracts::peach_stream {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;

    /// Event emitted when a new stream is created
    public struct StreamCreatedEvent has copy, drop {
        stream_id: ID,
        recipient: address,
        deposit_amount: u64,
        premium_amount: u64,
    }

    /// The Stream object representing the active streaming agreement
    public struct Stream has key, store {
        id: UID,
        balance: Balance<SUI>,
        recipient: address,
    }

    /// Creates a new stream and extracts 1% of the total SUI as premium.
    /// The 1% premium is returned to the caller so it can be routed into DeepBook Spot
    /// and DeepBook Predict in the same Programmable Transaction Block (PTB).
    public fun create_stream(
        mut deposit: Coin<SUI>,
        recipient: address,
        ctx: &mut TxContext
    ): (Stream, Coin<SUI>) {
        let total_value = coin::value(&deposit);
        let premium_value = total_value / 100; // 1% premium
        
        // Split the premium from the deposit
        let premium = coin::split(&mut deposit, premium_value, ctx);
        
        let stream = Stream {
            id: object::new(ctx),
            balance: coin::into_balance(deposit),
            recipient,
        };
        
        // Emit the event so the frontend indexer can track real PTB execution logs
        event::emit(StreamCreatedEvent {
            stream_id: object::uid_to_inner(&stream.id),
            recipient,
            deposit_amount: total_value,
            premium_amount: premium_value,
        });
        
        // Return both the stream object and the 1% premium Coin
        (stream, premium)
    }
}
