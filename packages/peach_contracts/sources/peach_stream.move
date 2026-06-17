/// Peach Stream — Production Contract
/// Uses live Pyth Network oracle + DeepBook V3 CLOB swap (no mocks).
///
/// Architecture:
///   • Employer creates a SUI payment stream with a strike price floor (Pyth-scaled).
///   • Employee claims unlocked SUI proportional to elapsed time.
///   • If Pyth reports spot < strike, the contract atomically converts the
///     employee's claimable SUI slice into USDC via a real DeepBook V3
///     `swap_exact_base_for_quote` call, locking in purchasing power.
///
/// Live on-chain objects used:
///   Pyth  : PriceInfoObject  — per-feed shared object, updated by client PTB
///   DeepBook : Pool<SUI, USDC> — real CLOB pool; fees paid in DEEP token
///
/// Testnet addresses (for reference, injected via client PTB):
///   Pyth State      : 0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c
///   Pyth SUI/USD    : 0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266
///   DeepBook Pkg    : 0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809
///   SUI/USDC Pool   : 0x4405b50d791fd3346754e8171aaab6bc2ed26c2c46efdd033c14b30ae507ac33

#[allow(unused_use, unused_const)]
module peach_contracts::peach_stream {
    // ── Standard Sui Framework ────────────────────────────────────────────────
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::sui::SUI;
    use sui::event;

    // ── DeepBook V3  (live git dep: MystenLabs/deepbookv3) ───────────────────
    use deepbook::pool::Pool;
    use token::deep::DEEP;

    // ── Pyth Network (live git dep: pyth-network/pyth-crosschain) ────────────
    // get_price_no_older_than lives in pyth::pyth (not pyth::price_info)
    use pyth::price_info::PriceInfoObject;
    use pyth::pyth::get_price_no_older_than;
    use pyth::price::get_price as pyth_get_price;
    use pyth::i64::{get_magnitude_if_positive, get_is_negative};

    // =========================================================================
    // Error codes
    // =========================================================================
    const ENotYourStream:      u64 = 101;
    const ENoNewFundsUnlocked: u64 = 102;
    const EInvalidTimeline:    u64 = 103;
    const EZeroDeposit:        u64 = 104;

    // Maximum price age accepted from Pyth oracle (60 seconds)
    const MAX_PRICE_AGE_SECS: u64 = 60;

    // =========================================================================
    // Core struct
    // =========================================================================

    /// A linear payment stream from `sender` → `receiver`, denominated in SUI.
    ///
    /// If the live Pyth spot price falls below `strike_price`, each `claim_stream`
    /// call will auto-convert the claimable SUI slice to USDC via DeepBook V3
    /// before transferring to the receiver.
    public struct PeachStream<phantom USDC> has key {
        id: UID,
        /// Employer address
        sender:          address,
        /// Employee address
        receiver:        address,
        /// Original escrowed SUI total
        total_amount:    u64,
        /// Cumulative SUI units already settled to receiver
        withdrawn:       u64,
        /// Live escrowed SUI pool
        balance:         Balance<SUI>,
        /// Stream start — milliseconds epoch
        start_time:      u64,
        /// Stream end   — milliseconds epoch
        end_time:        u64,
        /// Pyth-scaled price floor (8 decimals: $1.00 = 100_000_000)
        /// Set to 0 to disable the hedge and always stream raw SUI.
        strike_price:    u64,
        /// Accumulated USDC from prior hedge swaps
        usdc_balance:    Balance<USDC>,
        /// True once the hedge engine has been triggered
        is_fully_hedged: bool,
    }

    // =========================================================================
    // Events
    // =========================================================================

    public struct StreamCreated has copy, drop {
        stream_id:    ID,
        sender:       address,
        receiver:     address,
        total_amount: u64,
        strike_price: u64,
    }

    public struct StreamClaimed has copy, drop {
        stream_id:       ID,
        claimer:         address,
        sui_claimed:     u64,
        usdc_hedge_out:  u64,
        execution_price: u64,
    }

    public struct HedgeTriggered has copy, drop {
        stream_id:    ID,
        spot_price:   u64,
        strike_price: u64,
        sui_swapped:  u64,
    }

    public struct StreamCanceled has copy, drop {
        stream_id:            ID,
        sender:               address,
        receiver:             address,
        receiver_settled_sui: u64,
        sender_refunded_sui:  u64,
    }

    // =========================================================================
    // Public entry — create_stream
    // =========================================================================

    /// Employer escrows SUI and configures the stream.
    ///
    /// `strike_price` — Pyth-scaled price floor (8 decimals). Use 0 to disable hedging.
    ///   For SUI/USD: $1.50 floor = 150_000_000.
    public entry fun create_stream<USDC>(
        receiver:     address,
        start_time:   u64,
        end_time:     u64,
        strike_price: u64,
        stream_coin:  Coin<SUI>,
        ctx:          &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let total  = coin::value(&stream_coin);

        assert!(total > 0, EZeroDeposit);
        assert!(end_time > start_time, EInvalidTimeline);

        let uid       = object::new(ctx);
        let stream_id = object::uid_to_inner(&uid);

        let stream = PeachStream<USDC> {
            id:              uid,
            sender,
            receiver,
            total_amount:    total,
            withdrawn:       0,
            balance:         coin::into_balance(stream_coin),
            start_time,
            end_time,
            strike_price,
            usdc_balance:    balance::zero<USDC>(),
            is_fully_hedged: false,
        };

        event::emit(StreamCreated { stream_id, sender, receiver, total_amount: total, strike_price });
        transfer::share_object(stream);
    }

    // =========================================================================
    // Public entry — claim_stream
    // =========================================================================

    /// Employee calls this to claim their time-unlocked portion.
    ///
    /// Required live shared objects (injected by the client PTB):
    ///   • `pyth_price_object` — the Pyth PriceInfoObject for SUI/USD
    ///   • `deepbook_pool`     — the real DeepBook SUI/USDC Pool
    ///   • `deep_coin`         — DEEP tokens for DeepBook taker fees
    ///     (pass coin::zero<DEEP>(ctx) to let DeepBook deduct fees from base)
    ///   • `clock`             — Sui system clock (0x6)
    ///
    /// The client PTB must call pyth::update_single_price_feed() BEFORE this
    /// function to ensure the on-chain price is fresh within MAX_PRICE_AGE_SECS.
    public entry fun claim_stream<USDC>(
        stream:            &mut PeachStream<USDC>,
        pyth_price_object: &PriceInfoObject,
        deepbook_pool:     &mut Pool<SUI, USDC>,
        deep_coin:         Coin<DEEP>,
        clock:             &Clock,
        ctx:               &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == stream.receiver, ENotYourStream);

        let now = clock::timestamp_ms(clock);

        // ── 1. Time-decay math ─────────────────────────────────────────────
        let claimable_sui = compute_claimable(stream, now);
        assert!(claimable_sui > 0, ENoNewFundsUnlocked);
        stream.withdrawn = stream.withdrawn + claimable_sui;

        // ── 2. Live Pyth oracle price ──────────────────────────────────────
        // Reverts if price is older than MAX_PRICE_AGE_SECS on-chain.
        let price_struct  = get_price_no_older_than(pyth_price_object, clock, MAX_PRICE_AGE_SECS);
        let raw_i64       = pyth_get_price(&price_struct);
        let current_price = if (get_is_negative(&raw_i64)) {
            0u64
        } else {
            get_magnitude_if_positive(&raw_i64)
        };

        // ── 3. Hedge decision ──────────────────────────────────────────────
        let hedge_usdc_out: u64;

        if (stream.strike_price > 0 && current_price < stream.strike_price) {
            // ── 3a. HEDGE PATH: swap claimable SUI → USDC via DeepBook V3 ─
            let sui_to_swap = balance::split(&mut stream.balance, claimable_sui);
            let sui_coin    = coin::from_balance(sui_to_swap, ctx);

            event::emit(HedgeTriggered {
                stream_id:    object::uid_to_inner(&stream.id),
                spot_price:   current_price,
                strike_price: stream.strike_price,
                sui_swapped:  claimable_sui,
            });

            // DeepBook V3: swap_exact_base_for_quote
            //   (pool, base_in, deep_in, min_quote_out, clock, ctx)
            //   → (Coin<Base>, Coin<Quote>, Coin<DEEP>)
            let (leftover_sui, usdc_out, leftover_deep) =
                deepbook::pool::swap_exact_base_for_quote<SUI, USDC>(
                    deepbook_pool,
                    sui_coin,
                    deep_coin,
                    0,      // min_quote_out = 0: accept any fill
                    clock,
                    ctx
                );

            // Return dust SUI to stream escrow
            if (coin::value(&leftover_sui) > 0) {
                balance::join(&mut stream.balance, coin::into_balance(leftover_sui));
            } else {
                coin::destroy_zero(leftover_sui);
            };

            // Return leftover DEEP to sender
            if (coin::value(&leftover_deep) > 0) {
                transfer::public_transfer(leftover_deep, stream.sender);
            } else {
                coin::destroy_zero(leftover_deep);
            };

            hedge_usdc_out = coin::value(&usdc_out);
            transfer::public_transfer(usdc_out, stream.receiver);
        } else {
            // ── 3b. STANDARD PATH: transfer raw SUI ──────────────────────
            if (coin::value(&deep_coin) > 0) {
                transfer::public_transfer(deep_coin, stream.sender);
            } else {
                coin::destroy_zero(deep_coin);
            };

            let payout = balance::split(&mut stream.balance, claimable_sui);
            transfer::public_transfer(coin::from_balance(payout, ctx), stream.receiver);
            hedge_usdc_out = 0;
        };

        event::emit(StreamClaimed {
            stream_id:       object::uid_to_inner(&stream.id),
            claimer:         stream.receiver,
            sui_claimed:     claimable_sui,
            usdc_hedge_out:  hedge_usdc_out,
            execution_price: current_price,
        });
    }

    // =========================================================================
    // Public entry — cancel_stream
    // =========================================================================

    /// Sender cancels the stream. Earned-but-unclaimed SUI settles to receiver
    /// (with hedge if price < strike). Unearned principal refunds to sender.
    public entry fun cancel_stream<USDC>(
        stream:            PeachStream<USDC>,
        pyth_price_object: &PriceInfoObject,
        deepbook_pool:     &mut Pool<SUI, USDC>,
        deep_coin:         Coin<DEEP>,
        clock:             &Clock,
        ctx:               &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == stream.sender, ENotYourStream);

        let PeachStream {
            id,
            sender,
            receiver,
            total_amount,
            withdrawn,
            mut balance,
            start_time,
            end_time,
            strike_price,
            usdc_balance,
            is_fully_hedged: _,
        } = stream;

        let now = clock::timestamp_ms(clock);

        // Settle any previously converted USDC
        let usdc_left = balance::value(&usdc_balance);
        if (usdc_left > 0) {
            transfer::public_transfer(coin::from_balance(usdc_balance, ctx), receiver);
        } else {
            balance::destroy_zero(usdc_balance);
        };

        // Compute earned-but-unclaimed slice
        let total_remaining = balance::value(&balance);
        let total_dur       = end_time - start_time;
        let elapsed         = if (now >= end_time) { total_dur }
                              else if (now <= start_time) { 0 }
                              else { now - start_time };
        let cumulative = (((elapsed as u128) * (total_amount as u128)) / (total_dur as u128) as u128) as u64;
        let earned     = if (cumulative > withdrawn) { cumulative - withdrawn } else { 0 };
        let hedge_amt  = if (earned > total_remaining) { total_remaining } else { earned };

        if (hedge_amt > 0) {
            let price_struct  = get_price_no_older_than(pyth_price_object, clock, MAX_PRICE_AGE_SECS);
            let raw_i64       = pyth_get_price(&price_struct);
            let current_price = if (get_is_negative(&raw_i64)) { 0u64 }
                                else { get_magnitude_if_positive(&raw_i64) };

            if (strike_price > 0 && current_price < strike_price) {
                let sui_coin = coin::from_balance(balance::split(&mut balance, hedge_amt), ctx);
                let (leftover_sui, usdc_out, leftover_deep) =
                    deepbook::pool::swap_exact_base_for_quote<SUI, USDC>(
                        deepbook_pool, sui_coin, deep_coin, 0, clock, ctx
                    );

                if (coin::value(&leftover_sui) > 0) {
                    transfer::public_transfer(leftover_sui, receiver);
                } else { coin::destroy_zero(leftover_sui); };

                if (coin::value(&leftover_deep) > 0) {
                    transfer::public_transfer(leftover_deep, sender);
                } else { coin::destroy_zero(leftover_deep); };

                transfer::public_transfer(usdc_out, receiver);
            } else {
                coin::destroy_zero(deep_coin);
                let payout = balance::split(&mut balance, hedge_amt);
                transfer::public_transfer(coin::from_balance(payout, ctx), receiver);
            };
        } else {
            coin::destroy_zero(deep_coin);
        };

        let refund = balance::value(&balance);
        transfer::public_transfer(coin::from_balance(balance, ctx), sender);

        event::emit(StreamCanceled {
            stream_id:            object::uid_to_inner(&id),
            sender,
            receiver,
            receiver_settled_sui: hedge_amt,
            sender_refunded_sui:  refund,
        });

        object::delete(id);
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    fun compute_claimable<USDC>(stream: &PeachStream<USDC>, now: u64): u64 {
        let total_dur = stream.end_time - stream.start_time;
        let cumulative = if (now >= stream.end_time) {
            stream.total_amount
        } else if (now <= stream.start_time) {
            0u64
        } else {
            let elapsed = now - stream.start_time;
            (((elapsed as u128) * (stream.total_amount as u128)) / (total_dur as u128) as u128) as u64
        };
        if (cumulative > stream.withdrawn) { cumulative - stream.withdrawn } else { 0u64 }
    }
}
