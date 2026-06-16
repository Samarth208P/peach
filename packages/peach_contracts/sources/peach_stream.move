module peach_contracts::peach_stream {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::sui::SUI;
    use sui::event;
    use deepbook::balance_manager::{Self, BalanceManager};
    use deepbook::predict::{Self, PredictPool};
    use deepbook::oracle::{Self, OracleSVI};

    // --- Error Codes ---
    const ENotYourStream: u64 = 101;
    const ENoNewFundsUnlocked: u64 = 102;
    const EZeroDepositValue: u64 = 103;
    const EInvalidTimeline: u64 = 104;

    // --- Core Structs ---
    
    public struct PeachStream<phantom USDC> has key {
        id: UID,
        sender: address,
        receiver: address,
        total_amount: u64,               // Derived 99% SUI base volume
        withdrawn: u64,                  // Total SUI claimed by receiver so far
        balance: Balance<SUI>,           // Escrowed SUI asset pool
        start_time: u64,                 // Millisecond timestamp
        end_time: u64,                   // Millisecond timestamp
        balance_manager: BalanceManager, // Embedded child ledger owning the active options
        strike_price: u64,               // Price floor locked at genesis
        option_expiry: u64,              // Expiry timestamp matching end_time
        unexercised_hedge_volume: u64,   // Dust accumulator reservoir
    }

    // --- Lifecycle Events ---
    
    public struct StreamCreated has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
    }

    public struct StreamClaimed has copy, drop {
        stream_id: ID,
        claimer: address,
        sui_claimed: u64,
        usdc_hedged: u64,
    }

    public struct StreamCanceled has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        receiver_settled_sui: u64,
        sender_refunded_sui: u64,
    }

    // --- Public Entry Functions ---

    public entry fun create_stream<USDC>(
        receiver: address,
        start_time: u64,
        end_time: u64,
        strike_price: u64,
        stream_coin: Coin<SUI>,
        premium_coin: Coin<USDC>,
        predict_pool: &mut PredictPool,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let actual_amount = coin::value(&stream_coin);
        let premium_amount = coin::value(&premium_coin);

        assert!(actual_amount > 0, EZeroDepositValue);
        assert!(premium_amount > 0, EZeroDepositValue);
        assert!(end_time > start_time, EInvalidTimeline);

        // 1. Initialize the internal DeepBook BalanceManager child asset container
        let mut balance_manager = balance_manager::new(ctx);
        
        // 2. Deposit the 1% USDC premium into the stream's custom ledger pocket
        balance_manager::deposit_public(&mut balance_manager, premium_coin, ctx);

        // 3. Programmatically mint downside put protection option on DeepBook Predict
        predict::mint_range_option(
            &mut balance_manager,
            predict_pool,
            strike_price,
            end_time, 
            ctx
        );

        let uid = object::new(ctx);
        let stream_id = object::uid_to_inner(&uid);

        let stream = PeachStream<USDC> {
            id: uid,
            sender,
            receiver,
            total_amount: actual_amount,
            withdrawn: 0,
            balance: coin::into_balance(stream_coin),
            start_time,
            end_time,
            balance_manager,
            strike_price,
            option_expiry: end_time,
            unexercised_hedge_volume: 0,
        };

        event::emit(StreamCreated {
            stream_id,
            sender,
            receiver,
            total_amount: actual_amount,
        });

        // Publish as a shared cryptographic state object
        transfer::share_object(stream);
    }

    public entry fun claim_stream<USDC>(
        stream: &mut PeachStream<USDC>,
        predict_pool: &mut PredictPool,
        oracle_svi: &OracleSVI,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == stream.receiver, ENotYourStream);

        let now = clock::timestamp_ms(clock);
        let total_duration = stream.end_time - stream.start_time;

        // 1. Core time-decay calculation
        let cumulative_unlocked = if (now >= stream.end_time) {
            stream.total_amount
        } else if (now <= stream.start_time) {
            0
        } else {
            let time_elapsed = now - stream.start_time;
            ((((time_elapsed as u128) * (stream.total_amount as u128)) / (total_duration as u128)) as u64)
        };

        let claimable_sui = cumulative_unlocked - stream.withdrawn;
        assert!(claimable_sui > 0, ENoNewFundsUnlocked);
        
        stream.withdrawn = stream.withdrawn + claimable_sui;

        // 2. Query DeepBook V3 options oracle to fetch the true real-time spot price
        let current_spot_price = oracle::get_current_price(oracle_svi);
        let mut usdc_payout_amount = 0;

        // 3. Conditional Risk Management & Lot-Size Accumulator Gate
        if (current_spot_price < stream.strike_price) {
            let current_slice_hedge = calculate_proportional_hedge(claimable_sui, stream.total_amount);
            let total_target_hedge = current_slice_hedge + stream.unexercised_hedge_volume;
            
            let min_lot_size = predict::get_min_lot_size(predict_pool);

            if (total_target_hedge >= min_lot_size) {
                // Clear the dust accumulator reservoir and execute order
                stream.unexercised_hedge_volume = 0;
                
                let usdc_payout_balance = predict::exercise_and_withdraw<USDC>(
                    &mut stream.balance_manager,
                    predict_pool,
                    total_target_hedge,
                    ctx
                );
                
                usdc_payout_amount = balance::value(&usdc_payout_balance);
                transfer::public_transfer(coin::from_balance(usdc_payout_balance, ctx), stream.receiver);
            } else {
                // Volume is too small to fulfill CLOB minimum bounds. Accumulate and roll over.
                stream.unexercised_hedge_volume = total_target_hedge;
            };
        };

        // 4. Distribute the SUI tokens
        let claim_balance = balance::split(&mut stream.balance, claimable_sui);
        
        event::emit(StreamClaimed {
            stream_id: object::uid_to_inner(&stream.id),
            claimer: sender,
            sui_claimed: claimable_sui,
            usdc_hedged: usdc_payout_amount,
        });

        transfer::public_transfer(coin::from_balance(claim_balance, ctx), stream.receiver);
    }

    public entry fun cancel_stream<USDC>(
        stream: PeachStream<USDC>,
        predict_pool: &mut PredictPool,
        oracle_svi: &OracleSVI,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender_address = tx_context::sender(ctx);

        // Destructure the shared object container by value to satisfy linear asset parameters
        let PeachStream {
            id,
            sender,
            receiver,
            total_amount,
            withdrawn,
            mut balance,
            start_time,
            end_time,
            mut balance_manager,
            strike_price,
            option_expiry: _,
            unexercised_hedge_volume,
        } = stream;

        assert!(sender_address == sender, ENotYourStream);

        let now = clock::timestamp_ms(clock);
        let total_duration = end_time - start_time;

        let cumulative_unlocked = if (now >= end_time) {
            total_amount
        } else if (now <= start_time) {
            0
        } else {
            let time_elapsed = now - start_time;
            ((((time_elapsed as u128) * (total_amount as u128)) / (total_duration as u128)) as u64)
        };

        let earned_but_unclaimed = cumulative_unlocked - withdrawn;

        // 1. Settle Earned Portion with the Recipient + execute active option hedges
        if (earned_but_unclaimed > 0) {
            let current_spot_price = oracle::get_current_price(oracle_svi);
            
            if (current_spot_price < strike_price) {
                let total_target_hedge = calculate_proportional_hedge(earned_but_unclaimed, total_amount) + unexercised_hedge_volume;
                let min_lot_size = predict::get_min_lot_size(predict_pool);

                if (total_target_hedge >= min_lot_size) {
                    let usdc_payout_balance = predict::exercise_and_withdraw<USDC>(
                        &mut balance_manager,
                        predict_pool,
                        total_target_hedge,
                        ctx
                    );
                    transfer::public_transfer(coin::from_balance(usdc_payout_balance, ctx), receiver);
                };
            };

            let receiver_sui_balance = balance::split(&mut balance, earned_but_unclaimed);
            transfer::public_transfer(coin::from_balance(receiver_sui_balance, ctx), receiver);
        };

        // 2. Refund unearned SUI principal back to the sender
        let sender_refund_amount = balance::value(&balance);
        transfer::public_transfer(coin::from_balance(balance, ctx), sender);

        event::emit(StreamCanceled {
            stream_id: object::uid_to_inner(&id),
            sender,
            receiver,
            receiver_settled_sui: earned_but_unclaimed,
            sender_refunded_sui: sender_refund_amount,
        });

        // 3. THE SALVAGE MOVE: Push the BalanceManager object containing residual options to the sender
        transfer::public_transfer(balance_manager, sender);

        // 4. Delete the empty outer state node ID
        object::delete(id);
    }

    // --- Private Helper Functions ---
    
    fun calculate_proportional_hedge(claimable_amount: u64, total_amount: u64): u64 {
        // Simple 1:1 proportional calculation scaling the volume requirement
        ((((claimable_amount as u128) * 1000000) / (total_amount as u128)) as u64)
    }

    public struct SetupEvents has copy, drop {
        predict_pool_id: ID,
        oracle_svi_id: ID,
    }

    public entry fun setup_mock_objects(ctx: &mut TxContext) {
        let predict_pool = predict::create_pool(1000, ctx);
        let oracle_svi = oracle::create_oracle(1_000_000, ctx);
        
        let predict_pool_id = sui::object::id(&predict_pool);
        let oracle_svi_id = sui::object::id(&oracle_svi);
        
        event::emit(SetupEvents {
            predict_pool_id,
            oracle_svi_id,
        });
        
        sui::transfer::public_share_object(predict_pool);
        sui::transfer::public_share_object(oracle_svi);
    }
}
