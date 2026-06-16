module peach_contracts::peach_stream {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;

    // Error codes
    const ENotYourStream: u64 = 0;
    const EZeroDepositValue: u64 = 1;
    const EInvalidTimeline: u64 = 2;
    const ENoNewFundsUnlocked: u64 = 3;

    // Structures
    public struct PeachStream has key {
        id: UID,
        sender: address,
        receiver: address,
        total_amount: u64,
        withdrawn: u64,
        balance: Balance<SUI>,
        start_time: u64,
        end_time: u64,
    }

    public struct StreamCreated has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
    }

    public struct StreamClaimed has copy, drop {
        stream_id: ID,
        claimer: address,
        amount_claimed: u64,
    }

    public struct StreamCanceled has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        receiver_settled_amount: u64,
        sender_refunded_amount: u64,
    }

    public entry fun create_stream(
        receiver: address,
        start_time: u64,
        end_time: u64,
        fee_coin: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let actual_amount = coin::value(&fee_coin);
        
        assert!(actual_amount > 0, EZeroDepositValue);
        assert!(end_time > start_time, EInvalidTimeline);

        let uid = object::new(ctx);
        let stream_id = object::uid_to_inner(&uid);

        let stream = PeachStream {
            id: uid,
            sender,
            receiver,
            total_amount: actual_amount,
            withdrawn: 0,
            balance: coin::into_balance(fee_coin),
            start_time,
            end_time,
        };

        event::emit(StreamCreated {
            stream_id,
            sender,
            receiver
        });

        transfer::share_object(stream);
    }

    public entry fun claim_stream(
        stream: &mut PeachStream,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == stream.receiver, ENotYourStream);

        let now = clock::timestamp_ms(clock);
        let total_duration = stream.end_time - stream.start_time;

        let cumulative_unlocked = if (now >= stream.end_time) {
            stream.total_amount
        } else if (now <= stream.start_time) {
            0
        } else {
            let time_elapsed = now - stream.start_time;
            (((time_elapsed as u128) * (stream.total_amount as u128)) / (total_duration as u128)) as u64
        };

        let claimable_now = cumulative_unlocked - stream.withdrawn;
        assert!(claimable_now > 0, ENoNewFundsUnlocked);

        stream.withdrawn = stream.withdrawn + claimable_now;
        let claim_balance = balance::split(&mut stream.balance, claimable_now);
        let coin = coin::from_balance(claim_balance, ctx);

        event::emit(StreamClaimed {
            stream_id: object::uid_to_inner(&stream.id),
            claimer: sender,
            amount_claimed: claimable_now,
        });

        transfer::public_transfer(coin, stream.receiver);
    }

    public entry fun cancel_stream(
        stream: PeachStream,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender_address = tx_context::sender(ctx);
        assert!(sender_address == stream.sender, ENotYourStream);

        let now = clock::timestamp_ms(clock);
        let total_duration = stream.end_time - stream.start_time;

        let cumulative_unlocked = if (now >= stream.end_time) {
            stream.total_amount
        } else if (now <= stream.start_time) {
            0
        } else {
            let time_elapsed = now - stream.start_time;
            (((time_elapsed as u128) * (stream.total_amount as u128)) / (total_duration as u128)) as u64
        };

        let earned_but_unclaimed = cumulative_unlocked - stream.withdrawn;

        let PeachStream {
            id,
            sender,
            receiver,
            total_amount: _,
            withdrawn: _,
            mut balance,
            start_time: _,
            end_time: _,
        } = stream;

        let stream_id = object::uid_to_inner(&id);
        let total_remaining_pool = balance::value(&balance);
        let sender_refund_amount = total_remaining_pool - earned_but_unclaimed;

        if (earned_but_unclaimed > 0) {
            let receiver_balance = balance::split(&mut balance, earned_but_unclaimed);
            transfer::public_transfer(coin::from_balance(receiver_balance, ctx), receiver);
        };

        transfer::public_transfer(coin::from_balance(balance, ctx), sender);

        event::emit(StreamCanceled {
            stream_id,
            sender,
            receiver,
            receiver_settled_amount: earned_but_unclaimed,
            sender_refunded_amount: sender_refund_amount,
        });

        object::delete(id);
    }
}
