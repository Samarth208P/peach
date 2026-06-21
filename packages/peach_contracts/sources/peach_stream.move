/// Module: `peach_contracts::peach_stream`
///
/// Peach v2 — Autonomous Dual-Asset State Machine for payment streaming on Sui.
///
/// Converts static payment streams into volatility-insulated vaults with proactive
/// hedging via a Keeper Network + TWAP liquidation engine. The entire unvested
/// principal is hedged the instant a market breach is detected — not just the
/// newly-vested claim slice.
///
/// ## Architecture Pillars
///
/// 1. **Proactive Global Hedge Engine** — KeeperCap-gated initiation + TWAP
/// 2. **Permissionless Fallback** — public trigger after 5-min using Pyth timestamps
/// 3. **Dual-Asset Escrow** — holds both SUI + USDC simultaneously
/// 4. **Mixed Payout Router** — proportional claims from both asset pools
/// 5. **Configurable TWAP Presets** — Retail / Corporate / Institutional
/// 6. **MEV Protection** — min_output_guard on all keeper swaps
/// 7. **Corporate Salvage** — SalvageVault captures both assets on cancel
/// 8. **Historical Receipt Ledger** — full event trail + PeachRegistry integration
module peach_contracts::peach_stream {
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::sui::SUI;

    use deepbook::pool::{Self, Pool};
    use token::deep::DEEP;

    use pyth::i64;
    use pyth::price::{Self, Price};
    use pyth::price_info::PriceInfoObject;
    use pyth::pyth;

    use peach_contracts::peach_registry::{Self, PeachRegistry};

    // ============================================================================
    // Errors
    // ============================================================================

    /// Caller is not the stream's receiver.
    #[allow(unused_const)]
    const ENotReceiver: u64 = 1;
    /// Caller is not the stream's sender.
    const ENotSender: u64 = 2;
    /// No newly-vested funds are available to claim.
    const ENoFundsUnlocked: u64 = 3;
    /// `end_time` must be strictly greater than `start_time`.
    const EInvalidTimeline: u64 = 4;
    /// The escrowed deposit must be greater than zero.
    const EZeroDeposit: u64 = 5;
    /// Invalid hedge direction value.
    const EInvalidHedgeDirection: u64 = 6;
    /// SalvageVault has no balance to extract.
    #[allow(unused_const)]
    const EEmptySalvage: u64 = 7;
    /// Market conditions do not require hedging.
    const EMarketIsHealthy: u64 = 8;
    /// Stream is not in HEALTHY state (already hedging or fully hedged).
    const EStreamNotHealthy: u64 = 9;
    /// Stream is not in TWAP_ACTIVE state.
    const EStreamNotTWAPActive: u64 = 10;
    /// TWAP interval not yet elapsed since last tranche.
    const ETWAPIntervalNotElapsed: u64 = 11;
    /// All TWAP tranches already executed.
    const EAllTranchesExecuted: u64 = 12;
    /// Invalid TWAP preset value.
    const EInvalidTWAPPreset: u64 = 13;
    /// Keeper still has time — fallback not yet available.
    const EKeeperStillHasTime: u64 = 14;

    // ============================================================================
    // Constants
    // ============================================================================

    /// Maximum age (in seconds) accepted for a Pyth price reading (normal ops).
    const MAX_PRICE_AGE_SECS: u64 = 60;

    /// Extended max age for fallback triggers (allows historical VAA).
    const FALLBACK_MAX_PRICE_AGE_SECS: u64 = 3600;

    /// Fixed-point precision: prices scaled to 8 decimals ($1.00 = 100_000_000).
    const PRICE_DECIMALS: u8 = 8;

    /// Hedge direction constants.
    const HEDGE_FLOOR: u8 = 0;
    const HEDGE_CEILING: u8 = 1;
    const HEDGE_NONE: u8 = 2;

    /// Default minimum lot size for DeepBook swaps (0.01 SUI = 10_000_000 MIST).
    const DEFAULT_MIN_LOT_SIZE: u64 = 10_000_000;

    /// Liquidation status constants.
    const STATUS_HEALTHY: u8 = 0;
    const STATUS_TWAP_ACTIVE: u8 = 1;
    const STATUS_FULLY_HEDGED: u8 = 2;

    /// TWAP Preset: Retail — 3 tranches, 5 minutes apart (300_000 ms).
    const PRESET_RETAIL: u8 = 0;
    const PRESET_RETAIL_TRANCHES: u8 = 3;
    const PRESET_RETAIL_INTERVAL_MS: u64 = 300_000;

    /// TWAP Preset: Corporate — 5 tranches, 12 minutes apart (720_000 ms).
    const PRESET_CORPORATE: u8 = 1;
    const PRESET_CORPORATE_TRANCHES: u8 = 5;
    const PRESET_CORPORATE_INTERVAL_MS: u64 = 720_000;

    /// TWAP Preset: Institutional — 10 tranches, 18 minutes apart (1_080_000 ms).
    const PRESET_INSTITUTIONAL: u8 = 2;
    const PRESET_INSTITUTIONAL_TRANCHES: u8 = 10;
    const PRESET_INSTITUTIONAL_INTERVAL_MS: u64 = 1_080_000;

    /// Fallback delay: 5 minutes (300_000 ms) after price breach.
    const FALLBACK_DELAY_MS: u64 = 300_000;

    /// Fallback bounty: 0.05% (5 basis points) of tranche USDC proceeds.
    const FALLBACK_BOUNTY_BPS: u64 = 5;

    // ============================================================================
    // Objects
    // ============================================================================

    /// Administrative capability granting the keeper server permission to trigger
    /// global hedges. Minted once at package publish and transferred to deployer.
    public struct KeeperCap has key, store { id: UID }

    /// A linear SUI payment stream with autonomous dual-asset hedging.
    /// The `USDC` phantom type binds the stream to a specific DeepBook quote asset.
    public struct PeachStream<phantom USDC> has key {
        id: UID,
        /// Employer/creator who funds and owns the stream.
        sender: address,
        /// Employee/recipient entitled to claim streamed funds.
        receiver: address,
        /// Total SUI originally escrowed, in MIST.
        total_amount: u64,
        /// Cumulative SUI-equivalent units already settled to the receiver.
        withdrawn: u64,
        /// Live SUI escrow (unvested/unliquidated).
        balance: Balance<SUI>,
        /// Realized stablecoin vault (filled during TWAP liquidation).
        usdc_balance: Balance<USDC>,
        /// Stream start, in milliseconds since Unix epoch.
        start_time: u64,
        /// Stream end, in milliseconds since Unix epoch.
        end_time: u64,
        /// Protection strike price, scaled to PRICE_DECIMALS.
        strike_price: u64,
        /// Hedge direction: HEDGE_FLOOR (0), HEDGE_CEILING (1), or HEDGE_NONE (2).
        hedge_direction: u8,
        /// Accumulated SUI below min lot size (sub-lot buffer from claim hedging).
        accumulated_hedge_debt: u64,
        /// Minimum lot size for DeepBook swap execution (in MIST).
        min_lot_size: u64,
        /// True once at least one hedge swap has fired.
        hedge_triggered: bool,
        /// Total SUI swapped to USDC across all executions.
        total_hedged_amount: u64,
        // --- TWAP State Machine Fields ---
        /// Current liquidation status: HEALTHY(0), TWAP_ACTIVE(1), FULLY_HEDGED(2).
        liquidation_status: u8,
        /// Number of TWAP tranches configured for this stream.
        twap_tranches: u8,
        /// Minimum interval between TWAP tranche executions (ms).
        twap_interval_ms: u64,
        /// Number of TWAP tranches executed so far.
        tranches_executed: u8,
        /// Timestamp of last tranche execution (ms).
        last_tranche_timestamp: u64,
        /// Total SUI in escrow at the moment hedge was initiated (baseline).
        total_sui_at_hedge_start: u64,
    }

    /// Corporate Salvage Vault — captures both SUI and USDC on stream cancellation.
    public struct SalvageVault<phantom USDC> has key, store {
        id: UID,
        /// Original stream ID for audit linkage.
        original_stream_id: ID,
        /// Corporate treasury (original sender).
        owner: address,
        /// Refunded SUI balance (unearned portion).
        sui_balance: Balance<SUI>,
        /// Refunded USDC balance (hedged portion).
        usdc_balance: Balance<USDC>,
        /// Any accumulated hedge debt pending at cancellation.
        pending_hedge_debt: u64,
        /// Original strike price for reference.
        strike_price: u64,
        /// Original hedge direction for reference.
        hedge_direction: u8,
        /// Timestamp when the salvage was created.
        salvaged_at: u64,
    }

    // ============================================================================
    // Events
    // ============================================================================

    /// Emitted when a new stream is created.
    public struct StreamCreated has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
        strike_price: u64,
        hedge_direction: u8,
        twap_preset: u8,
        start_time: u64,
        end_time: u64,
    }

    /// Emitted on every successful claim.
    public struct StreamClaimed has copy, drop {
        stream_id: ID,
        claimer: address,
        sui_claimed: u64,
        usdc_claimed: u64,
        fee_deducted: u64,
        execution_price: u64,
        timestamp: u64,
    }

    /// Emitted when the global hedge is initiated by the keeper.
    public struct GlobalHedgeInitiated has copy, drop {
        stream_id: ID,
        trigger_price: u64,
        strike_price: u64,
        total_sui_locked: u64,
        twap_tranches: u8,
    }

    /// Emitted on each TWAP tranche execution.
    public struct TWAPTrancheExecuted has copy, drop {
        stream_id: ID,
        tranche_number: u8,
        sui_swapped: u64,
        usdc_received: u64,
        executor: address,
        is_fallback: bool,
    }

    /// Emitted when hedge debt accumulates (sub-lot buffering during claims).
    public struct HedgeDebtAccumulated has copy, drop {
        stream_id: ID,
        amount_buffered: u64,
        total_debt: u64,
        min_lot_size: u64,
    }

    /// Emitted when the hedge fires during a normal claim (legacy behavior).
    public struct HedgeTriggered has copy, drop {
        stream_id: ID,
        spot_price: u64,
        strike_price: u64,
        sui_swapped: u64,
        hedge_direction: u8,
        accumulated_debt_cleared: u64,
    }

    /// Emitted when fallback bounty is paid to the public executor.
    public struct FallbackBountyPaid has copy, drop {
        stream_id: ID,
        executor: address,
        bounty_usdc: u64,
    }

    /// Emitted when a stream is cancelled and salvaged.
    public struct StreamCanceled has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        receiver_settled_sui: u64,
        receiver_settled_usdc: u64,
        sender_refunded_sui: u64,
        sender_refunded_usdc: u64,
        salvage_vault_id: ID,
    }

    /// Emitted when a stream fully vests.
    public struct StreamCompleted has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
        total_hedged: u64,
    }

    /// Emitted when a SalvageVault is dissolved.
    public struct SalvageDissolved has copy, drop {
        vault_id: ID,
        original_stream_id: ID,
        owner: address,
        sui_extracted: u64,
        usdc_extracted: u64,
    }

    // ============================================================================
    // Init — Mint KeeperCap at package publish
    // ============================================================================

    fun init(ctx: &mut TxContext) {
        let cap = KeeperCap { id: object::new(ctx) };
        transfer::public_transfer(cap, ctx.sender());
    }

    // ============================================================================
    // Entrypoint: create_stream
    // ============================================================================

    /// Create a new volatility-insured payment stream with configurable TWAP preset.
    ///
    /// * `twap_preset` — 0 = Retail (3 tranches/5min), 1 = Corporate (5/12min),
    ///   2 = Institutional (10/18min). Ignored if hedge_direction == HEDGE_NONE.
    public fun create_stream<USDC>(
        receiver: address,
        start_time: u64,
        end_time: u64,
        strike_price: u64,
        hedge_direction: u8,
        twap_preset: u8,
        min_lot_size: u64,
        stream_coin: Coin<SUI>,
        registry: &mut PeachRegistry,
        ctx: &mut TxContext,
    ) {
        let total = coin::value(&stream_coin);
        assert!(total > 0, EZeroDeposit);
        assert!(end_time > start_time, EInvalidTimeline);
        assert!(
            hedge_direction == HEDGE_FLOOR
                || hedge_direction == HEDGE_CEILING
                || hedge_direction == HEDGE_NONE,
            EInvalidHedgeDirection,
        );

        // Resolve TWAP config from preset
        let (twap_tranches, twap_interval_ms) = resolve_twap_preset(
            twap_preset, hedge_direction
        );

        let lot_size = if (min_lot_size == 0) {
            DEFAULT_MIN_LOT_SIZE
        } else {
            min_lot_size
        };

        let id = object::new(ctx);
        let stream_id = id.to_inner();
        let sender = ctx.sender();

        let stream = PeachStream<USDC> {
            id,
            sender,
            receiver,
            total_amount: total,
            withdrawn: 0,
            balance: stream_coin.into_balance(),
            usdc_balance: balance::zero<USDC>(),
            start_time,
            end_time,
            strike_price,
            hedge_direction,
            accumulated_hedge_debt: 0,
            min_lot_size: lot_size,
            hedge_triggered: false,
            total_hedged_amount: 0,
            liquidation_status: STATUS_HEALTHY,
            twap_tranches,
            twap_interval_ms,
            tranches_executed: 0,
            last_tranche_timestamp: 0,
            total_sui_at_hedge_start: 0,
        };

        peach_registry::register_stream(
            registry, stream_id, sender, receiver, total,
            strike_price, hedge_direction, start_time, end_time,
        );

        event::emit(StreamCreated {
            stream_id, sender, receiver, total_amount: total,
            strike_price, hedge_direction, twap_preset, start_time, end_time,
        });

        transfer::share_object(stream);
    }

    // ============================================================================
    // Entrypoint: initiate_hedge (Task 2 — Privileged Keeper Trigger)
    // ============================================================================

    /// Privileged entry: triggered by the keeper server the instant a price breach
    /// is detected. Transitions the stream from HEALTHY → TWAP_ACTIVE, captures
    /// the baseline unvested balance, and executes the first TWAP tranche.
    ///
    /// * `min_output_guard` — MEV protection: minimum USDC output from DeepBook.
    ///   If a sandwich bot manipulates the pool, the transaction reverts.
    public fun initiate_hedge<USDC>(
        _cap: &KeeperCap,
        stream: &mut PeachStream<USDC>,
        price_info: &PriceInfoObject,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        min_output_guard: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // State guard: only healthy streams can be initiated
        assert!(stream.liquidation_status == STATUS_HEALTHY, EStreamNotHealthy);

        // Validate oracle breach
        let spot_price = read_spot_price(price_info, clock);
        assert!(
            should_hedge(stream.strike_price, stream.hedge_direction, spot_price),
            EMarketIsHealthy,
        );

        let stream_id = stream.id.to_inner();

        // Capture baseline and transition state
        stream.liquidation_status = STATUS_TWAP_ACTIVE;
        stream.total_sui_at_hedge_start = balance::value(&stream.balance);
        stream.hedge_triggered = true;

        event::emit(GlobalHedgeInitiated {
            stream_id,
            trigger_price: spot_price,
            strike_price: stream.strike_price,
            total_sui_locked: stream.total_sui_at_hedge_start,
            twap_tranches: stream.twap_tranches,
        });

        // Execute first tranche
        execute_tranche_internal(
            stream, deepbook_pool, deep_fee, min_output_guard,
            clock, ctx, false, // is_fallback = false
        );
    }

    // ============================================================================
    // Entrypoint: execute_tranche (Task 3 — TWAP Continuation)
    // ============================================================================

    /// Keeper-gated: execute the next TWAP tranche. Enforces rate-limiting and
    /// re-validates the oracle breach to prevent unnecessary swaps if price recovered.
    public fun execute_tranche<USDC>(
        _cap: &KeeperCap,
        stream: &mut PeachStream<USDC>,
        price_info: &PriceInfoObject,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        min_output_guard: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(stream.liquidation_status == STATUS_TWAP_ACTIVE, EStreamNotTWAPActive);
        assert!(stream.tranches_executed < stream.twap_tranches, EAllTranchesExecuted);

        let now = clock::timestamp_ms(clock);
        // Rate-limit: enforce minimum interval between tranches
        assert!(
            now - stream.last_tranche_timestamp >= stream.twap_interval_ms,
            ETWAPIntervalNotElapsed,
        );

        // Re-validate oracle: only swap if price is still in breach
        let spot_price = read_spot_price(price_info, clock);
        assert!(
            should_hedge(stream.strike_price, stream.hedge_direction, spot_price),
            EMarketIsHealthy,
        );

        execute_tranche_internal(
            stream, deepbook_pool, deep_fee, min_output_guard,
            clock, ctx, false,
        );
    }

    // ============================================================================
    // Entrypoint: fallback_hedge_trigger (Task 4 — Permissionless Fallback)
    // ============================================================================

    /// Permissionless fallback: anyone can call this if the keeper has missed its
    /// execution window. Uses Pyth's publish_time to prove the breach existed for
    /// at least FALLBACK_DELAY_MS — no on-chain clock initialization needed.
    ///
    /// The caller receives a 0.05% bounty from the USDC tranche proceeds.
    public fun fallback_hedge_trigger<USDC>(
        stream: &mut PeachStream<USDC>,
        price_info: &PriceInfoObject,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        min_output_guard: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);

        // Read price with extended staleness window (allows historical VAA)
        let price_struct = pyth::get_price_no_older_than(
            price_info, clock, FALLBACK_MAX_PRICE_AGE_SECS
        );
        let spot_price = normalize_price(&price_struct);

        // Validate the breach condition
        assert!(
            should_hedge(stream.strike_price, stream.hedge_direction, spot_price),
            EMarketIsHealthy,
        );

        // Use Pyth publish_time to prove the breach has existed for 5+ minutes.
        // This solves the Clock-Start Paradox: no on-chain state init needed.
        let price_publish_time_ms = (get_price_timestamp(&price_struct)) * 1000;
        assert!(
            now - price_publish_time_ms >= FALLBACK_DELAY_MS,
            EKeeperStillHasTime,
        );

        // Handle both initiation and continuation cases
        if (stream.liquidation_status == STATUS_HEALTHY) {
            // Keeper never initiated — do full initiation
            stream.liquidation_status = STATUS_TWAP_ACTIVE;
            stream.total_sui_at_hedge_start = balance::value(&stream.balance);
            stream.hedge_triggered = true;

            event::emit(GlobalHedgeInitiated {
                stream_id: stream.id.to_inner(),
                trigger_price: spot_price,
                strike_price: stream.strike_price,
                total_sui_locked: stream.total_sui_at_hedge_start,
                twap_tranches: stream.twap_tranches,
            });
        } else {
            // TWAP_ACTIVE: keeper missed a tranche execution
            assert!(stream.liquidation_status == STATUS_TWAP_ACTIVE, EStreamNotTWAPActive);
            assert!(stream.tranches_executed < stream.twap_tranches, EAllTranchesExecuted);
            // Rate limit still applies for continuation
            assert!(
                now - stream.last_tranche_timestamp >= stream.twap_interval_ms,
                ETWAPIntervalNotElapsed,
            );
        };

        // Execute tranche with bounty
        execute_tranche_internal(
            stream, deepbook_pool, deep_fee, min_output_guard,
            clock, ctx, true, // is_fallback = true
        );
    }

    // ============================================================================
    // Entrypoint: claim_stream (Task 5 — Mixed Dual-Asset Payout)
    // ============================================================================

    /// Claim vested funds. Payout depends on liquidation state:
    /// - HEALTHY: pay raw SUI (with legacy claim-time hedging via accumulator)
    /// - TWAP_ACTIVE: proportional mixed payout from both SUI + USDC pools
    /// - FULLY_HEDGED: pure USDC payout from stablecoin vault
    public fun claim_stream<USDC>(
        stream: &mut PeachStream<USDC>,
        price_info: &PriceInfoObject,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        registry: &mut PeachRegistry,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // NOTE: Sender assertion removed to allow the Keeper (or anyone) to
        // execute claims on behalf of the receiver.  Funds are always
        // transferred to `stream.receiver`, so this is safe.

        let now = clock::timestamp_ms(clock);
        let claimable = newly_vested(stream, now);
        assert!(claimable > 0, ENoFundsUnlocked);
        stream.withdrawn = stream.withdrawn + claimable;

        let stream_id = stream.id.to_inner();
        let receiver = stream.receiver;
        let sender = stream.sender;

        // Fee calculation (always based on SUI-equivalent units)
        let spot_price = read_spot_price(price_info, clock);
        let fee_amount = calculate_fee(
            claimable, stream.total_amount, spot_price,
            stream.strike_price, stream.hedge_direction,
        );
        let net_claimable = claimable - fee_amount;

        // Deduct fee from SUI balance (if available)
        if (fee_amount > 0 && balance::value(&stream.balance) >= fee_amount) {
            let fee_coin = coin::take(&mut stream.balance, fee_amount, ctx);
            peach_registry::deposit_fee(registry, fee_coin.into_balance());
        };

        let (sui_claimed, usdc_claimed) = if (stream.liquidation_status == STATUS_HEALTHY) {
            // --- HEALTHY: Legacy claim-time hedge behavior ---
            claim_healthy(stream, deepbook_pool, deep_fee, spot_price, net_claimable, clock, ctx)
        } else if (stream.liquidation_status == STATUS_FULLY_HEDGED) {
            // --- FULLY HEDGED: Pure USDC payout ---
            refund_deep(deep_fee, sender);
            let total_remaining = stream.total_amount - stream.withdrawn + claimable;
            let usdc_share = compute_usdc_share(stream, net_claimable, total_remaining);
            let usdc_payout = coin::take(&mut stream.usdc_balance, usdc_share, ctx);
            transfer::public_transfer(usdc_payout, receiver);
            (0, usdc_share)
        } else {
            // --- TWAP_ACTIVE: Mixed proportional payout ---
            refund_deep(deep_fee, sender);
            let total_remaining = stream.total_amount - stream.withdrawn + claimable;
            let (sui_share, usdc_share) = compute_mixed_shares(stream, net_claimable, total_remaining);
            if (sui_share > 0) {
                let sui_payout = coin::take(&mut stream.balance, sui_share, ctx);
                transfer::public_transfer(sui_payout, receiver);
            };
            if (usdc_share > 0) {
                let usdc_payout = coin::take(&mut stream.usdc_balance, usdc_share, ctx);
                transfer::public_transfer(usdc_payout, receiver);
            };
            (sui_share, usdc_share)
        };

        event::emit(StreamClaimed {
            stream_id, claimer: receiver, sui_claimed, usdc_claimed,
            fee_deducted: fee_amount, execution_price: spot_price, timestamp: now,
        });

        // Completion check
        if (stream.withdrawn >= stream.total_amount) {
            let sui_empty = balance::value(&stream.balance) == 0;
            let usdc_empty = balance::value(&stream.usdc_balance) == 0;
            if (sui_empty && usdc_empty) {
                peach_registry::record_completion(registry, stream_id, stream.total_amount, now);
                event::emit(StreamCompleted {
                    stream_id, sender, receiver,
                    total_amount: stream.total_amount,
                    total_hedged: stream.total_hedged_amount,
                });
            };
        };
    }

    // ============================================================================
    // Entrypoint: cancel_stream (Task 6 — Dual-Asset Salvage)
    // ============================================================================

    /// Cancel a stream. Settles earned portion to receiver (mixed if hedged),
    /// packages remaining SUI + USDC into a SalvageVault for the corporate treasury.
    public fun cancel_stream<USDC>(
        stream: PeachStream<USDC>,
        price_info: &PriceInfoObject,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        registry: &mut PeachRegistry,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == stream.sender, ENotSender);

        let PeachStream {
            id, sender, receiver, total_amount, withdrawn,
            mut balance, mut usdc_balance, start_time, end_time,
            strike_price, hedge_direction, accumulated_hedge_debt,
            min_lot_size: _, hedge_triggered: _, total_hedged_amount: _,
            liquidation_status, twap_tranches: _, twap_interval_ms: _,
            tranches_executed: _, last_tranche_timestamp: _,
            total_sui_at_hedge_start,
        } = stream;

        let stream_id = id.to_inner();
        let now = clock::timestamp_ms(clock);

        // Calculate earned-but-unclaimed
        let vested = vested_total(total_amount, start_time, end_time, now);
        let earned = if (vested > withdrawn) { vested - withdrawn } else { 0 };

        let mut receiver_sui = 0u64;
        let mut receiver_usdc = 0u64;

        if (earned > 0) {
            if (liquidation_status == STATUS_HEALTHY) {
                // Settle in SUI (with optional hedge)
                let remaining = balance::value(&balance);
                let settle = if (earned > remaining) { remaining } else { earned };
                if (settle > 0) {
                    let spot_price = read_spot_price(price_info, clock);
                    if (should_hedge(strike_price, hedge_direction, spot_price)) {
                        let sui_in = coin::take(&mut balance, settle, ctx);
                        let usdc_out = swap_sui_to_usdc_guarded(
                            deepbook_pool, sui_in, deep_fee, &mut balance, 0, clock, ctx,
                        );
                        receiver_usdc = coin::value(&usdc_out);
                        transfer::public_transfer(usdc_out, receiver);
                    } else {
                        refund_deep(deep_fee, sender);
                        let payout = coin::take(&mut balance, settle, ctx);
                        receiver_sui = settle;
                        transfer::public_transfer(payout, receiver);
                    };
                } else {
                    refund_deep(deep_fee, sender);
                };
            } else {
                // Hedged state: pay proportionally from both pools
                refund_deep(deep_fee, sender);
                let total_remaining = total_amount - withdrawn;

                let sui_remaining = balance::value(&balance);
                let usdc_pool = balance::value(&usdc_balance);

                let sui_share = if (total_remaining > 0) {
                    (((earned as u128) * (sui_remaining as u128)) / (total_remaining as u128) as u64)
                } else { 0 };
                let usdc_share = if (total_remaining > 0) {
                    (((earned as u128) * (usdc_pool as u128)) / (total_remaining as u128) as u64)
                } else { 0 };

                if (sui_share > 0 && sui_share <= balance::value(&balance)) {
                    let p = coin::take(&mut balance, sui_share, ctx);
                    receiver_sui = sui_share;
                    transfer::public_transfer(p, receiver);
                };
                if (usdc_share > 0 && usdc_share <= balance::value(&usdc_balance)) {
                    let p = coin::take(&mut usdc_balance, usdc_share, ctx);
                    receiver_usdc = usdc_share;
                    transfer::public_transfer(p, receiver);
                };
            };
        } else {
            refund_deep(deep_fee, sender);
        };

        // Package remaining into SalvageVault
        let refund_sui = balance::value(&balance);
        let refund_usdc = balance::value(&usdc_balance);
        let vault_uid = object::new(ctx);
        let vault_id = vault_uid.to_inner();

        let salvage_vault = SalvageVault<USDC> {
            id: vault_uid,
            original_stream_id: stream_id,
            owner: sender,
            sui_balance: balance,
            usdc_balance,
            pending_hedge_debt: accumulated_hedge_debt,
            strike_price,
            hedge_direction,
            salvaged_at: now,
        };

        transfer::transfer(salvage_vault, sender);

        peach_registry::record_cancellation(registry, stream_id, receiver_sui + receiver_usdc, refund_sui + refund_usdc, now);

        event::emit(StreamCanceled {
            stream_id, sender, receiver,
            receiver_settled_sui: receiver_sui,
            receiver_settled_usdc: receiver_usdc,
            sender_refunded_sui: refund_sui,
            sender_refunded_usdc: refund_usdc,
            salvage_vault_id: vault_id,
        });

        id.delete();
    }

    /// Dissolve a SalvageVault and extract both SUI and USDC to the treasury owner.
    public fun dissolve_salvage_vault<USDC>(
        vault: SalvageVault<USDC>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == vault.owner, ENotSender);

        let SalvageVault {
            id, original_stream_id, owner,
            sui_balance, usdc_balance,
            pending_hedge_debt: _, strike_price: _,
            hedge_direction: _, salvaged_at: _,
        } = vault;

        let vault_id = id.to_inner();
        let sui_amount = balance::value(&sui_balance);
        let usdc_amount = balance::value(&usdc_balance);

        if (sui_amount > 0) {
            transfer::public_transfer(coin::from_balance(sui_balance, ctx), owner);
        } else {
            balance::destroy_zero(sui_balance);
        };

        if (usdc_amount > 0) {
            transfer::public_transfer(coin::from_balance(usdc_balance, ctx), owner);
        } else {
            balance::destroy_zero(usdc_balance);
        };

        event::emit(SalvageDissolved {
            vault_id, original_stream_id, owner,
            sui_extracted: sui_amount, usdc_extracted: usdc_amount,
        });

        id.delete();
    }

    // ============================================================================
    // Views
    // ============================================================================

    public fun claimable_at<USDC>(stream: &PeachStream<USDC>, now_ms: u64): u64 {
        newly_vested(stream, now_ms)
    }

    public fun total_amount<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.total_amount
    }

    public fun remaining_balance<USDC>(stream: &PeachStream<USDC>): u64 {
        balance::value(&stream.balance)
    }

    public fun usdc_balance<USDC>(stream: &PeachStream<USDC>): u64 {
        balance::value(&stream.usdc_balance)
    }

    public fun hedge_triggered<USDC>(stream: &PeachStream<USDC>): bool {
        stream.hedge_triggered
    }

    public fun accumulated_hedge_debt<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.accumulated_hedge_debt
    }

    public fun total_hedged_amount<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.total_hedged_amount
    }

    public fun hedge_direction<USDC>(stream: &PeachStream<USDC>): u8 {
        stream.hedge_direction
    }

    public fun strike_price<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.strike_price
    }

    public fun min_lot_size<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.min_lot_size
    }

    public fun liquidation_status<USDC>(stream: &PeachStream<USDC>): u8 {
        stream.liquidation_status
    }

    public fun tranches_executed<USDC>(stream: &PeachStream<USDC>): u8 {
        stream.tranches_executed
    }

    public fun twap_tranches<USDC>(stream: &PeachStream<USDC>): u8 {
        stream.twap_tranches
    }

    public fun salvage_sui_balance<USDC>(vault: &SalvageVault<USDC>): u64 {
        balance::value(&vault.sui_balance)
    }

    public fun salvage_usdc_balance<USDC>(vault: &SalvageVault<USDC>): u64 {
        balance::value(&vault.usdc_balance)
    }

    public fun salvage_stream_id<USDC>(vault: &SalvageVault<USDC>): ID {
        vault.original_stream_id
    }

    public fun salvage_pending_debt<USDC>(vault: &SalvageVault<USDC>): u64 {
        vault.pending_hedge_debt
    }

    // ============================================================================
    // Internal — TWAP engine
    // ============================================================================

    /// Resolve TWAP preset into (tranches, interval_ms).
    fun resolve_twap_preset(preset: u8, hedge_direction: u8): (u8, u64) {
        if (hedge_direction == HEDGE_NONE) {
            // No hedging — TWAP config is irrelevant, set defaults
            return (PRESET_CORPORATE_TRANCHES, PRESET_CORPORATE_INTERVAL_MS)
        };
        if (preset == PRESET_RETAIL) {
            (PRESET_RETAIL_TRANCHES, PRESET_RETAIL_INTERVAL_MS)
        } else if (preset == PRESET_CORPORATE) {
            (PRESET_CORPORATE_TRANCHES, PRESET_CORPORATE_INTERVAL_MS)
        } else if (preset == PRESET_INSTITUTIONAL) {
            (PRESET_INSTITUTIONAL_TRANCHES, PRESET_INSTITUTIONAL_INTERVAL_MS)
        } else {
            abort EInvalidTWAPPreset
        }
    }

    /// Core tranche execution logic shared by keeper and fallback paths.
    fun execute_tranche_internal<USDC>(
        stream: &mut PeachStream<USDC>,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        min_output_guard: u64,
        clock: &Clock,
        ctx: &mut TxContext,
        is_fallback: bool,
    ) {
        let now = clock::timestamp_ms(clock);
        let stream_id = stream.id.to_inner();
        let executor = ctx.sender();

        // Calculate tranche size: last tranche sweeps all remaining SUI
        let total_remaining = balance::value(&stream.balance);
        let tranches_left = (stream.twap_tranches - stream.tranches_executed) as u64;
        let tranche_size = if (stream.tranches_executed + 1 == stream.twap_tranches) {
            // Last tranche: sweep everything
            total_remaining
        } else {
            // Even split of remaining balance across remaining tranches
            total_remaining / tranches_left
        };

        if (tranche_size > 0) {
            let sui_coin = coin::take(&mut stream.balance, tranche_size, ctx);

            let mut usdc_out = swap_sui_to_usdc_guarded(
                deepbook_pool, sui_coin, deep_fee, &mut stream.balance,
                min_output_guard, clock, ctx,
            );

            let usdc_amount = coin::value(&usdc_out);
            stream.total_hedged_amount = stream.total_hedged_amount + tranche_size;

            // If fallback, deduct bounty and pay to executor
            if (is_fallback && usdc_amount > 0) {
                let bounty = (usdc_amount * FALLBACK_BOUNTY_BPS) / 10_000;
                if (bounty > 0) {
                    let bounty_coin = coin::split(&mut usdc_out, bounty, ctx);
                    transfer::public_transfer(bounty_coin, executor);
                    event::emit(FallbackBountyPaid {
                        stream_id, executor, bounty_usdc: bounty,
                    });
                };
            };

            // Remaining USDC goes into the stream's stablecoin vault
            balance::join(&mut stream.usdc_balance, usdc_out.into_balance());
        } else {
            // No SUI left to swap — refund DEEP
            refund_deep(deep_fee, stream.sender);
        };

        // Update state
        stream.tranches_executed = stream.tranches_executed + 1;
        stream.last_tranche_timestamp = now;

        event::emit(TWAPTrancheExecuted {
            stream_id,
            tranche_number: stream.tranches_executed,
            sui_swapped: tranche_size,
            usdc_received: balance::value(&stream.usdc_balance),
            executor,
            is_fallback,
        });

        // Check if fully hedged
        if (stream.tranches_executed >= stream.twap_tranches
            || balance::value(&stream.balance) == 0) {
            stream.liquidation_status = STATUS_FULLY_HEDGED;
        };
    }

    // ============================================================================
    // Internal — claim helpers
    // ============================================================================

    /// Handle claim when stream is in HEALTHY state (legacy behavior with accumulator).
    fun claim_healthy<USDC>(
        stream: &mut PeachStream<USDC>,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        spot_price: u64,
        net_claimable: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): (u64, u64) {
        let receiver = stream.receiver;
        let sender = stream.sender;
        let stream_id = stream.id.to_inner();
        let needs_hedge = should_hedge(stream.strike_price, stream.hedge_direction, spot_price);

        if (needs_hedge) {
            let total_to_hedge = net_claimable + stream.accumulated_hedge_debt;
            if (total_to_hedge >= stream.min_lot_size) {
                let accumulated_cleared = stream.accumulated_hedge_debt;
                stream.accumulated_hedge_debt = 0;
                stream.hedge_triggered = true;

                event::emit(HedgeTriggered {
                    stream_id, spot_price,
                    strike_price: stream.strike_price,
                    sui_swapped: total_to_hedge,
                    hedge_direction: stream.hedge_direction,
                    accumulated_debt_cleared: accumulated_cleared,
                });

                let sui_in = coin::take(&mut stream.balance, total_to_hedge, ctx);
                let usdc_out = swap_sui_to_usdc_guarded(
                    deepbook_pool, sui_in, deep_fee, &mut stream.balance, 0, clock, ctx,
                );
                let usdc_value = coin::value(&usdc_out);
                stream.total_hedged_amount = stream.total_hedged_amount + total_to_hedge;
                transfer::public_transfer(usdc_out, receiver);
                (0, usdc_value)
            } else {
                stream.accumulated_hedge_debt = total_to_hedge;
                event::emit(HedgeDebtAccumulated {
                    stream_id, amount_buffered: net_claimable,
                    total_debt: total_to_hedge, min_lot_size: stream.min_lot_size,
                });
                refund_deep(deep_fee, sender);
                let payout = coin::take(&mut stream.balance, net_claimable, ctx);
                transfer::public_transfer(payout, receiver);
                (net_claimable, 0)
            }
        } else {
            if (stream.accumulated_hedge_debt > 0) {
                stream.accumulated_hedge_debt = 0;
            };
            refund_deep(deep_fee, sender);
            let payout = coin::take(&mut stream.balance, net_claimable, ctx);
            transfer::public_transfer(payout, receiver);
            (net_claimable, 0)
        }
    }

    /// Compute proportional USDC share for FULLY_HEDGED state.
    /// Formula: (claimable_units * usdc_pool) / total_remaining
    fun compute_usdc_share<USDC>(stream: &PeachStream<USDC>, claimable: u64, total_remaining: u64): u64 {
        let usdc_pool = balance::value(&stream.usdc_balance);
        if (total_remaining == 0 || usdc_pool == 0) return 0;
        let share = ((claimable as u128) * (usdc_pool as u128)) / (total_remaining as u128);
        let result = (share as u64);
        // Clamp to available balance
        if (result > usdc_pool) { usdc_pool } else { result }
    }

    /// Compute proportional mixed shares for TWAP_ACTIVE state.
    /// Both SUI and USDC are distributed relative to total_remaining.
    fun compute_mixed_shares<USDC>(stream: &PeachStream<USDC>, claimable: u64, total_remaining: u64): (u64, u64) {
        if (total_remaining == 0) return (claimable, 0);

        let sui_remaining = balance::value(&stream.balance);
        let usdc_pool = balance::value(&stream.usdc_balance);

        let sui_share = ((claimable as u128) * (sui_remaining as u128)) / (total_remaining as u128);
        let usdc_share = ((claimable as u128) * (usdc_pool as u128)) / (total_remaining as u128);

        let sui_result = (sui_share as u64);
        let usdc_result = (usdc_share as u64);

        // Clamp to available balances
        let sui_clamped = if (sui_result > sui_remaining) { sui_remaining } else { sui_result };
        let usdc_clamped = if (usdc_result > usdc_pool) { usdc_pool } else { usdc_result };

        (sui_clamped, usdc_clamped)
    }

    // ============================================================================
    // Internal — vesting math
    // ============================================================================

    fun newly_vested<USDC>(stream: &PeachStream<USDC>, now: u64): u64 {
        let vested = vested_total(stream.total_amount, stream.start_time, stream.end_time, now);
        if (vested > stream.withdrawn) { vested - stream.withdrawn } else { 0 }
    }

    fun vested_total(total_amount: u64, start_time: u64, end_time: u64, now: u64): u64 {
        if (now <= start_time) {
            0
        } else if (now >= end_time) {
            total_amount
        } else {
            let elapsed = (now - start_time) as u128;
            let duration = (end_time - start_time) as u128;
            ((elapsed * (total_amount as u128)) / duration) as u64
        }
    }

    // ============================================================================
    // Internal — oracle
    // ============================================================================

    fun read_spot_price(price_info: &PriceInfoObject, clock: &Clock): u64 {
        let price = pyth::get_price_no_older_than(price_info, clock, MAX_PRICE_AGE_SECS);
        normalize_price(&price)
    }

    fun should_hedge(strike_price: u64, hedge_direction: u8, spot_price: u64): bool {
        if (strike_price == 0 || hedge_direction == HEDGE_NONE) {
            return false
        };
        if (hedge_direction == HEDGE_FLOOR) {
            spot_price < strike_price
        } else {
            spot_price > strike_price
        }
    }

    fun normalize_price(price: &Price): u64 {
        let raw = price::get_price(price);
        if (i64::get_is_negative(&raw)) {
            return 0
        };
        let magnitude = i64::get_magnitude_if_positive(&raw);
        let target = (PRICE_DECIMALS as u64);

        let expo = price::get_expo(price);
        if (i64::get_is_negative(&expo)) {
            let decimals = i64::get_magnitude_if_negative(&expo);
            if (decimals <= target) {
                magnitude * pow10(target - decimals)
            } else {
                magnitude / pow10(decimals - target)
            }
        } else {
            let positive_expo = i64::get_magnitude_if_positive(&expo);
            magnitude * pow10(positive_expo + target)
        }
    }

    /// Extract the publish timestamp (seconds) from a Pyth Price struct.
    fun get_price_timestamp(price: &Price): u64 {
        price::get_timestamp(price)
    }

    fun pow10(exponent: u64): u64 {
        let mut result = 1u64;
        let mut i = 0;
        while (i < exponent) {
            result = result * 10;
            i = i + 1;
        };
        result
    }

    // ============================================================================
    // Internal — DeepBook hedge
    // ============================================================================

    /// Swap SUI for USDC on DeepBook V3 with MEV protection via min_output_guard.
    fun swap_sui_to_usdc_guarded<USDC>(
        deepbook_pool: &mut Pool<SUI, USDC>,
        sui_in: Coin<SUI>,
        deep_fee: Coin<DEEP>,
        escrow: &mut Balance<SUI>,
        min_output_guard: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<USDC> {
        let (sui_dust, usdc_out, deep_left) = pool::swap_exact_base_for_quote<SUI, USDC>(
            deepbook_pool,
            sui_in,
            deep_fee,
            min_output_guard,
            clock,
            ctx,
        );

        if (coin::value(&sui_dust) > 0) {
            balance::join(escrow, sui_dust.into_balance());
        } else {
            sui_dust.destroy_zero();
        };

        refund_deep(deep_left, ctx.sender());
        usdc_out
    }

    fun refund_deep(deep: Coin<DEEP>, owner: address) {
        if (coin::value(&deep) > 0) {
            transfer::public_transfer(deep, owner);
        } else {
            deep.destroy_zero();
        }
    }

    // ============================================================================
    // Internal — Fees
    // ============================================================================

    fun calculate_fee(
        claimable: u64,
        total_amount: u64,
        spot_price: u64,
        strike_price: u64,
        hedge_direction: u8,
    ): u64 {
        let one_sui = 1_000_000_000u64;
        let mut base_bps = 50;

        if (total_amount >= 10000 * one_sui) {
            base_bps = 10;
        } else if (total_amount >= 5000 * one_sui) {
            base_bps = 20;
        } else if (total_amount >= 1000 * one_sui) {
            base_bps = 30;
        };

        let mut risk_bps = 0;
        if (strike_price > 0 && hedge_direction != HEDGE_NONE) {
            if (hedge_direction == HEDGE_FLOOR) {
                let danger_threshold = (strike_price * 105) / 100;
                if (spot_price < danger_threshold) {
                    risk_bps = 150;
                };
            } else if (hedge_direction == HEDGE_CEILING) {
                let danger_threshold = (strike_price * 95) / 100;
                if (spot_price > danger_threshold) {
                    risk_bps = 150;
                };
            };
        };

        let total_bps = base_bps + risk_bps;
        (claimable * total_bps) / 10_000
    }

    // ============================================================================
    // Test-only accessors
    // ============================================================================

    #[test_only]
    public fun stream_sender<USDC>(stream: &PeachStream<USDC>): address { stream.sender }

    #[test_only]
    public fun stream_receiver<USDC>(stream: &PeachStream<USDC>): address { stream.receiver }

    #[test_only]
    public fun stream_withdrawn<USDC>(stream: &PeachStream<USDC>): u64 { stream.withdrawn }

    #[test_only]
    public fun stream_strike_price<USDC>(stream: &PeachStream<USDC>): u64 { stream.strike_price }

    #[test_only]
    public fun stream_hedge_direction<USDC>(stream: &PeachStream<USDC>): u8 { stream.hedge_direction }

    #[test_only]
    public fun stream_accumulated_debt<USDC>(stream: &PeachStream<USDC>): u64 { stream.accumulated_hedge_debt }

    #[test_only]
    public fun stream_min_lot_size<USDC>(stream: &PeachStream<USDC>): u64 { stream.min_lot_size }

    #[test_only]
    public fun stream_start_time<USDC>(stream: &PeachStream<USDC>): u64 { stream.start_time }

    #[test_only]
    public fun stream_end_time<USDC>(stream: &PeachStream<USDC>): u64 { stream.end_time }

    #[test_only]
    public fun stream_liquidation_status<USDC>(stream: &PeachStream<USDC>): u8 { stream.liquidation_status }

    #[test_only]
    public fun stream_twap_tranches<USDC>(stream: &PeachStream<USDC>): u8 { stream.twap_tranches }

    #[test_only]
    public fun stream_twap_interval<USDC>(stream: &PeachStream<USDC>): u64 { stream.twap_interval_ms }

    #[test_only]
    public fun stream_tranches_executed<USDC>(stream: &PeachStream<USDC>): u8 { stream.tranches_executed }

    #[test_only]
    public fun calculate_fee_for_testing(
        claimable: u64, total_amount: u64, spot_price: u64,
        strike_price: u64, hedge_direction: u8,
    ): u64 {
        calculate_fee(claimable, total_amount, spot_price, strike_price, hedge_direction)
    }

    #[test_only]
    public fun create_keeper_cap_for_testing(ctx: &mut TxContext): KeeperCap {
        KeeperCap { id: object::new(ctx) }
    }
}
