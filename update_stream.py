import re

with open('c:\\PC\\Peach\\packages\\peach_contracts\\sources\\peach_stream.move', 'r') as f:
    content = f.read()

content = content.replace(
    'sui_claimed: u64,',
    'sui_claimed: u64,\n        fee_deducted: u64,'
)

old_claim_str = '''        let now = clock.timestamp_ms();
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
                // Execute the atomic swap for full amount (current + accumulated)'''

new_claim_str = '''        let now = clock.timestamp_ms();
        let claimable = newly_vested(stream, now);
        assert!(claimable > 0, ENoFundsUnlocked);
        stream.withdrawn = stream.withdrawn + claimable;

        let stream_id = stream.id.to_inner();
        let receiver = stream.receiver;
        let sender = stream.sender;

        // --- PILLAR 1: Atomic Stop-Loss Evaluation ---
        let spot_price = read_spot_price(price_info, clock);
        let needs_hedge = should_hedge(stream.strike_price, stream.hedge_direction, spot_price);

        // --- PROTOCOL FEE DEDUCTION ---
        let fee_amount = calculate_fee(
            claimable,
            stream.total_amount,
            spot_price,
            stream.strike_price,
            stream.hedge_direction
        );
        let net_claimable = claimable - fee_amount;

        if (fee_amount > 0) {
            let fee_coin = coin::take(&mut stream.balance, fee_amount, ctx);
            peach_registry::deposit_fee(registry, fee_coin.into_balance());
        };

        let usdc_hedge_out = if (needs_hedge) {
            // --- PILLAR 3: Hedge Rollover Accumulator ---
            let total_to_hedge = net_claimable + stream.accumulated_hedge_debt;

            if (total_to_hedge >= stream.min_lot_size) {
                // Execute the atomic swap for full amount (current + accumulated)'''

content = content.replace(old_claim_str, new_claim_str)

old_sub_lot = '''                event::emit(HedgeDebtAccumulated {
                    stream_id,
                    amount_buffered: claimable,
                    total_debt: total_to_hedge,
                    min_lot_size: stream.min_lot_size,
                });

                refund_deep(deep_fee, sender);
                let payout = coin::take(&mut stream.balance, claimable, ctx);'''

new_sub_lot = '''                event::emit(HedgeDebtAccumulated {
                    stream_id,
                    amount_buffered: net_claimable,
                    total_debt: total_to_hedge,
                    min_lot_size: stream.min_lot_size,
                });

                refund_deep(deep_fee, sender);
                let payout = coin::take(&mut stream.balance, net_claimable, ctx);'''

content = content.replace(old_sub_lot, new_sub_lot)

old_no_hedge = '''            if (stream.accumulated_hedge_debt > 0) {
                stream.accumulated_hedge_debt = 0;
            };
            refund_deep(deep_fee, sender);
            let payout = coin::take(&mut stream.balance, claimable, ctx);'''

new_no_hedge = '''            if (stream.accumulated_hedge_debt > 0) {
                stream.accumulated_hedge_debt = 0;
            };
            refund_deep(deep_fee, sender);
            let payout = coin::take(&mut stream.balance, net_claimable, ctx);'''

content = content.replace(old_no_hedge, new_no_hedge)

old_event = '''        event::emit(StreamClaimed {
            stream_id,
            claimer: receiver,
            sui_claimed: claimable,
            usdc_hedge_out,
            execution_price: spot_price,'''

new_event = '''        event::emit(StreamClaimed {
            stream_id,
            claimer: receiver,
            sui_claimed: net_claimable,
            fee_deducted: fee_amount,
            usdc_hedge_out,
            execution_price: spot_price,'''

content = content.replace(old_event, new_event)

calc_fee = '''

    // ============================================================================
    // Internal — Fees
    // ============================================================================

    /// Calculates dynamic protocol fee based on volume discount and risk premium.
    fun calculate_fee(
        claimable: u64,
        total_amount: u64,
        spot_price: u64,
        strike_price: u64,
        hedge_direction: u8,
    ): u64 {
        // Base fee tier based on stream total amount (1 SUI = 1,000,000,000 MIST)
        let ONE_SUI = 1_000_000_000;
        let mut base_bps = 50; // 0.5%
        
        if (total_amount >= 10000 * ONE_SUI) {
            base_bps = 10; // 0.1%
        } else if (total_amount >= 5000 * ONE_SUI) {
            base_bps = 20; // 0.2%
        } else if (total_amount >= 1000 * ONE_SUI) {
            base_bps = 30; // 0.3%
        };

        let mut risk_bps = 0;

        if (strike_price > 0 && hedge_direction != 2) {
            if (hedge_direction == 0) { // FLOOR
                // Danger zone: Spot is less than 105% of Strike
                let danger_threshold = (strike_price * 105) / 100;
                if (spot_price < danger_threshold) {
                    risk_bps = 150; // +1.5%
                };
            } else if (hedge_direction == 1) { // CEILING
                // Danger zone: Spot is greater than 95% of Strike
                let danger_threshold = (strike_price * 95) / 100;
                if (spot_price > danger_threshold) {
                    risk_bps = 150; // +1.5%
                };
            };
        };

        let total_bps = base_bps + risk_bps;
        
        (claimable * total_bps) / 10_000
    }
}'''

content = content.replace('\\n}', calc_fee)

with open('c:\\PC\\Peach\\packages\\peach_contracts\\sources\\peach_stream.move', 'w') as f:
    f.write(content)
