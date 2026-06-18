/// Module: `peach_contracts::peach_stream`
///
/// Peach — Autonomous Self-Hedging Insurance Vaults for payment streaming on Sui.
///
/// Converts static payment streams into volatility-insulated vaults by pairing
/// real-time Pyth oracle price feeds with DeepBook V3 CLOB liquidity. The contract
/// automatically triggers asset adjustments the instant a pre-defined risk threshold
/// is crossed, guaranteeing the real-world value of the payment stream.
///
/// ## Five Core Pillars
///
/// 1. **Atomic Stop-Loss Execution Engine** — evaluates price conditions on every
///    interaction and atomically swaps to stable collateral when breached.
/// 2. **Risk-Profile Customization** — supports both FLOOR (downside/payroll) and
///    CEILING (upside/supply-chain) hedge directions with configurable strikes.
/// 3. **Hedge Rollover Accumulator** — buffers sub-lot-size amounts to avoid CLOB
///    minimum-order-size reverts while keeping primary claims smooth.
/// 4. **Corporate Salvage Mechanism** — on cancellation, extracts active sub-resources
///    into a transferable SalvageVault instead of destroying them.
/// 5. **Historical Receipt Ledger** — emits immutable lifecycle events and integrates
///    with PeachRegistry for on-chain audit trails.
module peach_contracts::peach_stream {
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
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

    // ============================================================================
    // Constants
    // ============================================================================

    /// Maximum age (in seconds) accepted for a Pyth price reading.
    const MAX_PRICE_AGE_SECS: u64 = 60;

    /// Fixed-point precision used for strike and oracle prices.
    /// Prices are scaled to 8 decimals, so `$1.00` == `100_000_000`.
    const PRICE_DECIMALS: u8 = 8;

    /// Minimum quote amount accepted from a DeepBook swap. `0` lets the pool fill
    /// at the best available price; slippage protection is enforced client-side.
    const MIN_QUOTE_OUT: u64 = 0;

    /// Hedge direction: protect against downside (price drops below strike).
    /// Use for crypto payroll — employee is protected when token value falls.
    const HEDGE_FLOOR: u8 = 0;

    /// Hedge direction: protect against upside (price rises above strike).
    /// Use for supply-chain — buyer is protected when commodity price spikes.
    const HEDGE_CEILING: u8 = 1;

    /// No hedging enabled.
    const HEDGE_NONE: u8 = 2;

    /// Default minimum lot size for DeepBook swaps (in MIST).
    /// Sub-lot claims accumulate until this threshold is met.
    /// 0.01 SUI = 10_000_000 MIST — conservative default for DeepBook V3.
    const DEFAULT_MIN_LOT_SIZE: u64 = 10_000_000;

    // ============================================================================
    // Objects
    // ============================================================================

    /// A linear SUI payment stream from `sender` to `receiver` with autonomous
    /// hedging via Pyth + DeepBook V3.
    ///
    /// The `USDC` phantom type binds the stream to a specific DeepBook quote asset.
    public struct PeachStream<phantom USDC> has key {
        id: UID,
        /// Employer/creator who funds and owns the stream.
        sender: address,
        /// Employee/recipient entitled to claim streamed funds.
        receiver: address,
        /// Total SUI originally escrowed, in MIST.
        total_amount: u64,
        /// Cumulative SUI already settled to the receiver, in MIST.
        withdrawn: u64,
        /// Live SUI escrow backing the stream.
        balance: Balance<SUI>,
        /// Stream start, in milliseconds since the Unix epoch.
        start_time: u64,
        /// Stream end, in milliseconds since the Unix epoch.
        end_time: u64,
        /// --- PILLAR 2: Risk-Profile Customization ---
        /// Protection strike price, scaled to `PRICE_DECIMALS`. `0` disables hedging.
        strike_price: u64,
        /// Hedge direction: HEDGE_FLOOR (0), HEDGE_CEILING (1), or HEDGE_NONE (2).
        hedge_direction: u8,
        /// --- PILLAR 3: Hedge Rollover Accumulator ---
        /// Accumulated SUI that should have been hedged but was below min lot size.
        /// This debt is settled on the next claim that pushes total above threshold.
        accumulated_hedge_debt: u64,
        /// Minimum lot size for DeepBook swap execution (in MIST).
        min_lot_size: u64,
        /// --- PILLAR 1: Stop-Loss State ---
        /// `true` once at least one hedge swap has fired for this stream.
        hedge_triggered: bool,
        /// Total SUI that has been swapped to USDC across all hedge executions.
        total_hedged_amount: u64,
    }

    /// --- PILLAR 4: Corporate Salvage Mechanism ---
    /// When a stream is cancelled, this vault captures the remaining assets
    /// instead of destroying them. The corporate treasury receives this object
    /// and can extract the balance at their discretion.
    public struct SalvageVault<phantom USDC> has key, store {
        id: UID,
        /// Original stream ID for audit linkage.
        original_stream_id: ID,
        /// Corporate treasury (original sender).
        owner: address,
        /// Refunded SUI balance (unearned portion).
        balance: Balance<SUI>,
        /// Any accumulated hedge debt that was pending at cancellation.
        pending_hedge_debt: u64,
        /// Original strike price for reference.
        strike_price: u64,
        /// Original hedge direction for reference.
        hedge_direction: u8,
        /// Timestamp when the salvage was created.
        salvaged_at: u64,
    }

    // ============================================================================
    // Events (PILLAR 5: Historical Receipt Ledger)
    // ============================================================================

    /// Emitted when a new stream is created and shared.
    public struct StreamCreated has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
        strike_price: u64,
        hedge_direction: u8,
        start_time: u64,
        end_time: u64,
    }

    /// Emitted on every successful claim — serves as a payment stub.
    public struct StreamClaimed has copy, drop {
        stream_id: ID,
        claimer: address,
        sui_claimed: u64,
        usdc_hedge_out: u64,
        execution_price: u64,
        hedge_debt_accumulated: u64,
        timestamp: u64,
    }

    /// Emitted whenever the hedge engine converts SUI to USDC.
    public struct HedgeTriggered has copy, drop {
        stream_id: ID,
        spot_price: u64,
        strike_price: u64,
        sui_swapped: u64,
        hedge_direction: u8,
        accumulated_debt_cleared: u64,
    }

    /// Emitted when hedge debt accumulates (sub-lot buffering).
    public struct HedgeDebtAccumulated has copy, drop {
        stream_id: ID,
        amount_buffered: u64,
        total_debt: u64,
        min_lot_size: u64,
    }

    /// Emitted when a stream is cancelled and salvaged.
    public struct StreamCanceled has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        receiver_settled_sui: u64,
        sender_refunded_sui: u64,
        salvage_vault_id: ID,
        pending_hedge_debt: u64,
    }

    /// Emitted when a stream fully vests (all funds claimed).
    public struct StreamCompleted has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
        total_hedged: u64,
    }

    /// Emitted when a SalvageVault is dissolved by the treasury.
    public struct SalvageDissolved has copy, drop {
        vault_id: ID,
        original_stream_id: ID,
        owner: address,
        amount_extracted: u64,
    }

    // ============================================================================
    // Entrypoints
    // ============================================================================

    /// Create a new volatility-insured payment stream.
    ///
    /// * `receiver` — employee/recipient address
    /// * `start_time` — stream start in milliseconds since Unix epoch
    /// * `end_time` — stream end in milliseconds since Unix epoch
    /// * `strike_price` — protection threshold scaled to `PRICE_DECIMALS`
    ///   (e.g. `$1.50` == `150_000_000`). Pass `0` with `HEDGE_NONE` for no hedging.
    /// * `hedge_direction` — `0` for FLOOR (payroll), `1` for CEILING (supply-chain),
    ///   `2` for NONE (raw streaming with no protection)
    /// * `min_lot_size` — minimum swap size for DeepBook. Pass `0` to use default.
    /// * `stream_coin` — the SUI to escrow
    /// * `registry` — the PeachRegistry for audit tracking
    public fun create_stream<USDC>(
        receiver: address,
        start_time: u64,
        end_time: u64,
        strike_price: u64,
        hedge_direction: u8,
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

        let lot_size = if (min_lot_size == 0) { DEFAULT_MIN_LOT_SIZE } else { min_lot_size };

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
            start_time,
            end_time,
            strike_price,
            hedge_direction,
            accumulated_hedge_debt: 0,
            min_lot_size: lot_size,
            hedge_triggered: false,
            total_hedged_amount: 0,
        };

        // Register in the on-chain audit ledger
        peach_registry::register_stream(
            registry,
            stream_id,
            sender,
            receiver,
            total,
            strike_price,
            hedge_direction,
            start_time,
            end_time,
        );

        event::emit(StreamCreated {
            stream_id,
            sender,
            receiver,
            total_amount: total,
            strike_price,
            hedge_direction,
            start_time,
            end_time,
        });

        transfer::share_object(stream);
    }

    /// Claim vested SUI from the stream. If the hedge condition is active:
    /// - If claimable + accumulated debt >= min_lot_size → execute atomic swap
    /// - If claimable + accumulated debt < min_lot_size → buffer into accumulator,
    ///   pay out raw SUI to keep the claim smooth (PILLAR 3)
    ///
    /// The client PTB must refresh `price_info` via `pyth::update_single_price_feed`
    /// earlier in the same transaction so the reading is fresh.
    public fun claim_stream<USDC>(
        stream: &mut PeachStream<USDC>,
        price_info: &PriceInfoObject,
        deepbook_pool: &mut Pool<SUI, USDC>,
        deep_fee: Coin<DEEP>,
        registry: &mut PeachRegistry,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == stream.receiver, ENotReceiver);

        let now = clock.timestamp_ms();
        let claimable = newly_vested(stream, now);
        assert!(claimable > 0, ENoFundsUnlocked);
        stream.withdrawn = stream.withdrawn + claimable;

        let stream_id = stream.id.to_inner();
        let receiver = stream.receiver;
        let sender = stream.sender;

        // --- PILLAR 1: Atomic Stop-Loss Evaluation ---
        let spot_price = read_spot_price(price_info, clock);
        let needs_hedge = should_hedge(stream.strike_price, stream.hedge_direction, spot_price);

        let usdc_hedge_out = if (needs_hedge) {
            // --- PILLAR 3: Hedge Rollover Accumulator ---
            let total_to_hedge = claimable + stream.accumulated_hedge_debt;

            if (total_to_hedge >= stream.min_lot_size) {
                // Execute the atomic swap for full amount (current + accumulated)
                let accumulated_cleared = stream.accumulated_hedge_debt;
                stream.accumulated_hedge_debt = 0;
                stream.hedge_triggered = true;

                event::emit(HedgeTriggered {
                    stream_id,
                    spot_price,
                    strike_price: stream.strike_price,
                    sui_swapped: total_to_hedge,
                    hedge_direction: stream.hedge_direction,
                    accumulated_debt_cleared: accumulated_cleared,
                });

                let sui_in = coin::take(&mut stream.balance, total_to_hedge, ctx);
                let usdc_out = swap_sui_to_usdc(
                    deepbook_pool,
                    sui_in,
                    deep_fee,
                    &mut stream.balance,
                    sender,
                    clock,
                    ctx,
                );
                let usdc_value = coin::value(&usdc_out);
                stream.total_hedged_amount = stream.total_hedged_amount + total_to_hedge;
                transfer::public_transfer(usdc_out, receiver);
                usdc_value
            } else {
                // Sub-lot: accumulate debt, pay out raw SUI to keep claim smooth
                stream.accumulated_hedge_debt = total_to_hedge;

                event::emit(HedgeDebtAccumulated {
                    stream_id,
                    amount_buffered: claimable,
                    total_debt: total_to_hedge,
                    min_lot_size: stream.min_lot_size,
                });

                refund_deep(deep_fee, sender);
                let payout = coin::take(&mut stream.balance, claimable, ctx);
                transfer::public_transfer(payout, receiver);
                0
            }
        } else {
            // No hedge needed — pay raw SUI
            // If there was accumulated debt and price recovered, clear it
            if (stream.accumulated_hedge_debt > 0) {
                stream.accumulated_hedge_debt = 0;
            };
            refund_deep(deep_fee, sender);
            let payout = coin::take(&mut stream.balance, claimable, ctx);
            transfer::public_transfer(payout, receiver);
            0
        };

        event::emit(StreamClaimed {
            stream_id,
            claimer: receiver,
            sui_claimed: claimable,
            usdc_hedge_out,
            execution_price: spot_price,
            hedge_debt_accumulated: stream.accumulated_hedge_debt,
            timestamp: now,
        });

        // Check if stream is fully vested and drained
        if (stream.withdrawn >= stream.total_amount && balance::value(&stream.balance) == 0) {
            peach_registry::record_completion(
                registry,
                stream_id,
                stream.total_amount,
                now,
            );
            event::emit(StreamCompleted {
                stream_id,
                sender,
                receiver,
                total_amount: stream.total_amount,
                total_hedged: stream.total_hedged_amount,
            });
        };
    }

    /// --- PILLAR 4: Corporate Salvage Mechanism ---
    ///
    /// Cancel a stream. Earned-but-unclaimed SUI is settled to the receiver
    /// (hedged to USDC when the price condition is active). The unearned remainder
    /// is NOT simply destroyed — it is packaged into a `SalvageVault` object and
    /// transferred to the sender's corporate treasury.
    ///
    /// This preserves active sub-resources (Balance objects) and allows the
    /// treasury to manage the recovered assets independently.
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
            id,
            sender,
            receiver,
            total_amount,
            withdrawn,
            mut balance,
            start_time,
            end_time,
            strike_price,
            hedge_direction,
            accumulated_hedge_debt,
            min_lot_size: _,
            hedge_triggered: _,
            total_hedged_amount: _,
        } = stream;

        let stream_id = id.to_inner();
        let now = clock.timestamp_ms();

        // Calculate earned-but-unclaimed amount
        let vested = vested_total(total_amount, start_time, end_time, now);
        let earned = if (vested > withdrawn) { vested - withdrawn } else { 0 };
        let remaining = balance::value(&balance);
        let settle = if (earned > remaining) { remaining } else { earned };

        // Settle receiver's earned portion (with hedging if applicable)
        if (settle > 0) {
            let spot_price = read_spot_price(price_info, clock);
            if (should_hedge(strike_price, hedge_direction, spot_price)) {
                event::emit(HedgeTriggered {
                    stream_id,
                    spot_price,
                    strike_price,
                    sui_swapped: settle,
                    hedge_direction,
                    accumulated_debt_cleared: 0,
                });
                let sui_in = coin::take(&mut balance, settle, ctx);
                let usdc_out = swap_sui_to_usdc(
                    deepbook_pool,
                    sui_in,
                    deep_fee,
                    &mut balance,
                    sender,
                    clock,
                    ctx,
                );
                transfer::public_transfer(usdc_out, receiver);
            } else {
                refund_deep(deep_fee, sender);
                let payout = coin::take(&mut balance, settle, ctx);
                transfer::public_transfer(payout, receiver);
            };
        } else {
            refund_deep(deep_fee, sender);
        };

        // --- Create SalvageVault for corporate treasury ---
        let refund_amount = balance::value(&balance);
        let vault_uid = object::new(ctx);
        let vault_id = vault_uid.to_inner();

        let salvage_vault = SalvageVault<USDC> {
            id: vault_uid,
            original_stream_id: stream_id,
            owner: sender,
            balance,
            pending_hedge_debt: accumulated_hedge_debt,
            strike_price,
            hedge_direction,
            salvaged_at: now,
        };

        // Transfer the salvage vault to the corporate treasury
        transfer::transfer(salvage_vault, sender);

        // Update registry with cancellation record
        peach_registry::record_cancellation(
            registry,
            stream_id,
            settle,
            refund_amount,
            now,
        );

        event::emit(StreamCanceled {
            stream_id,
            sender,
            receiver,
            receiver_settled_sui: settle,
            sender_refunded_sui: refund_amount,
            salvage_vault_id: vault_id,
            pending_hedge_debt: accumulated_hedge_debt,
        });

        id.delete();
    }

    /// Dissolve a SalvageVault and extract the remaining SUI balance.
    /// Only the vault owner (original stream sender) can call this.
    public fun dissolve_salvage_vault<USDC>(
        vault: SalvageVault<USDC>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == vault.owner, ENotSender);

        let SalvageVault {
            id,
            original_stream_id,
            owner,
            balance,
            pending_hedge_debt: _,
            strike_price: _,
            hedge_direction: _,
            salvaged_at: _,
        } = vault;

        let vault_id = id.to_inner();
        let amount = balance::value(&balance);

        if (amount > 0) {
            transfer::public_transfer(coin::from_balance(balance, ctx), owner);
        } else {
            balance::destroy_zero(balance);
        };

        event::emit(SalvageDissolved {
            vault_id,
            original_stream_id,
            owner,
            amount_extracted: amount,
        });

        id.delete();
    }

    // ============================================================================
    // Views
    // ============================================================================

    /// The amount of SUI (in MIST) the receiver could claim at time `now_ms`.
    public fun claimable_at<USDC>(stream: &PeachStream<USDC>, now_ms: u64): u64 {
        newly_vested(stream, now_ms)
    }

    /// Total SUI originally escrowed, in MIST.
    public fun total_amount<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.total_amount
    }

    /// SUI remaining in escrow, in MIST.
    public fun remaining_balance<USDC>(stream: &PeachStream<USDC>): u64 {
        balance::value(&stream.balance)
    }

    /// `true` once the stream has fired at least one hedge swap.
    public fun hedge_triggered<USDC>(stream: &PeachStream<USDC>): bool {
        stream.hedge_triggered
    }

    /// Current accumulated hedge debt (sub-lot buffer), in MIST.
    public fun accumulated_hedge_debt<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.accumulated_hedge_debt
    }

    /// Total SUI that has been hedged (swapped to USDC) across all executions.
    public fun total_hedged_amount<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.total_hedged_amount
    }

    /// The stream's hedge direction (0=FLOOR, 1=CEILING, 2=NONE).
    public fun hedge_direction<USDC>(stream: &PeachStream<USDC>): u8 {
        stream.hedge_direction
    }

    /// The stream's configured strike price.
    public fun strike_price<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.strike_price
    }

    /// The stream's minimum lot size for hedge execution.
    public fun min_lot_size<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.min_lot_size
    }

    /// SalvageVault: get the remaining balance value.
    public fun salvage_balance<USDC>(vault: &SalvageVault<USDC>): u64 {
        balance::value(&vault.balance)
    }

    /// SalvageVault: get the original stream ID.
    public fun salvage_stream_id<USDC>(vault: &SalvageVault<USDC>): ID {
        vault.original_stream_id
    }

    /// SalvageVault: get any pending hedge debt.
    public fun salvage_pending_debt<USDC>(vault: &SalvageVault<USDC>): u64 {
        vault.pending_hedge_debt
    }

    // ============================================================================
    // Internal — vesting math
    // ============================================================================

    /// SUI that has vested but not yet been withdrawn, given the current time.
    fun newly_vested<USDC>(stream: &PeachStream<USDC>, now: u64): u64 {
        let vested = vested_total(stream.total_amount, stream.start_time, stream.end_time, now);
        if (vested > stream.withdrawn) { vested - stream.withdrawn } else { 0 }
    }

    /// Cumulative SUI vested from `start_time` to `now` over the linear schedule.
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

    /// Read the freshest Pyth price and normalize it to `PRICE_DECIMALS`.
    fun read_spot_price(price_info: &PriceInfoObject, clock: &Clock): u64 {
        let price = pyth::get_price_no_older_than(price_info, clock, MAX_PRICE_AGE_SECS);
        normalize_price(&price)
    }

    /// Determine if the hedge condition is met based on direction:
    /// - FLOOR: hedge when spot_price < strike_price (downside protection)
    /// - CEILING: hedge when spot_price > strike_price (upside protection)
    /// - NONE: never hedge
    fun should_hedge(strike_price: u64, hedge_direction: u8, spot_price: u64): bool {
        if (strike_price == 0 || hedge_direction == HEDGE_NONE) {
            return false
        };
        if (hedge_direction == HEDGE_FLOOR) {
            spot_price < strike_price
        } else {
            // HEDGE_CEILING
            spot_price > strike_price
        }
    }

    /// Express a Pyth `Price` as an unsigned integer scaled to `PRICE_DECIMALS`.
    /// Negative prices (which never occur for SUI/USD) normalize to `0`.
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

    /// `10^exponent` as a `u64`.
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

    /// Swap `sui_in` for USDC on DeepBook V3. Dust SUI returned by the pool is
    /// merged back into `escrow`, and any unused DEEP fee coin is returned to
    /// `fee_owner`. Returns the USDC proceeds.
    fun swap_sui_to_usdc<USDC>(
        deepbook_pool: &mut Pool<SUI, USDC>,
        sui_in: Coin<SUI>,
        deep_fee: Coin<DEEP>,
        escrow: &mut Balance<SUI>,
        fee_owner: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<USDC> {
        let (sui_dust, usdc_out, deep_left) = pool::swap_exact_base_for_quote<SUI, USDC>(
            deepbook_pool,
            sui_in,
            deep_fee,
            MIN_QUOTE_OUT,
            clock,
            ctx,
        );

        if (coin::value(&sui_dust) > 0) {
            balance::join(escrow, sui_dust.into_balance());
        } else {
            sui_dust.destroy_zero();
        };

        refund_deep(deep_left, fee_owner);
        usdc_out
    }

    /// Return a DEEP coin to `owner`, or destroy it if it is empty.
    fun refund_deep(deep: Coin<DEEP>, owner: address) {
        if (coin::value(&deep) > 0) {
            transfer::public_transfer(deep, owner);
        } else {
            deep.destroy_zero();
        }
    }

    // ============================================================================
    // Test-only accessors
    // ============================================================================

    #[test_only]
    public fun stream_sender<USDC>(stream: &PeachStream<USDC>): address {
        stream.sender
    }

    #[test_only]
    public fun stream_receiver<USDC>(stream: &PeachStream<USDC>): address {
        stream.receiver
    }

    #[test_only]
    public fun stream_withdrawn<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.withdrawn
    }

    #[test_only]
    public fun stream_strike_price<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.strike_price
    }

    #[test_only]
    public fun stream_hedge_direction<USDC>(stream: &PeachStream<USDC>): u8 {
        stream.hedge_direction
    }

    #[test_only]
    public fun stream_accumulated_debt<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.accumulated_hedge_debt
    }

    #[test_only]
    public fun stream_min_lot_size<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.min_lot_size
    }

    #[test_only]
    public fun stream_start_time<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.start_time
    }

    #[test_only]
    public fun stream_end_time<USDC>(stream: &PeachStream<USDC>): u64 {
        stream.end_time
    }
}
