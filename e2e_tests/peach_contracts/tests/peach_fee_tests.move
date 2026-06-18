#[test_only]
module peach_contracts::peach_fee_tests {
    use peach_contracts::peach_stream;

    const ONE_SUI: u64 = 1_000_000_000;

    // Hedge directions
    const HEDGE_FLOOR: u8 = 0;
    const HEDGE_CEILING: u8 = 1;
    const HEDGE_NONE: u8 = 2;

    #[test]
    fun test_base_fee_tiers() {
        let claimable = 100 * ONE_SUI;
        let spot_price = 100_000_000;
        let strike_price = 100_000_000;
        
        // < 1000 SUI -> 50 bps
        let total_amount_1 = 500 * ONE_SUI;
        let fee_1 = peach_stream::calculate_fee_for_testing(claimable, total_amount_1, spot_price, 0, HEDGE_NONE);
        assert!(fee_1 == (claimable * 50) / 10_000, 0);

        // 1000-4999 SUI -> 30 bps
        let total_amount_2 = 2000 * ONE_SUI;
        let fee_2 = peach_stream::calculate_fee_for_testing(claimable, total_amount_2, spot_price, 0, HEDGE_NONE);
        assert!(fee_2 == (claimable * 30) / 10_000, 1);

        // 5000-9999 SUI -> 20 bps
        let total_amount_3 = 6000 * ONE_SUI;
        let fee_3 = peach_stream::calculate_fee_for_testing(claimable, total_amount_3, spot_price, 0, HEDGE_NONE);
        assert!(fee_3 == (claimable * 20) / 10_000, 2);

        // >= 10000 SUI -> 10 bps
        let total_amount_4 = 15000 * ONE_SUI;
        let fee_4 = peach_stream::calculate_fee_for_testing(claimable, total_amount_4, spot_price, 0, HEDGE_NONE);
        assert!(fee_4 == (claimable * 10) / 10_000, 3);
    }

    #[test]
    fun test_risk_premium_floor() {
        let claimable = 100 * ONE_SUI;
        let total_amount = 500 * ONE_SUI; // Base fee = 50 bps
        let strike_price = 100_000_000;

        // Spot well above strike -> Safe zone -> No risk premium -> 50 bps
        let spot_safe = 110_000_000; // 110% of strike
        let fee_safe = peach_stream::calculate_fee_for_testing(claimable, total_amount, spot_safe, strike_price, HEDGE_FLOOR);
        assert!(fee_safe == (claimable * 50) / 10_000, 0);

        // Spot very close to strike -> Danger zone (<105%) -> Risk premium (+150 bps) -> 200 bps
        let spot_danger = 104_000_000; // 104% of strike
        let fee_danger = peach_stream::calculate_fee_for_testing(claimable, total_amount, spot_danger, strike_price, HEDGE_FLOOR);
        assert!(fee_danger == (claimable * 200) / 10_000, 1);

        // Spot below strike -> Danger zone -> Risk premium -> 200 bps
        let spot_broken = 90_000_000; // 90% of strike
        let fee_broken = peach_stream::calculate_fee_for_testing(claimable, total_amount, spot_broken, strike_price, HEDGE_FLOOR);
        assert!(fee_broken == (claimable * 200) / 10_000, 2);
    }

    #[test]
    fun test_risk_premium_ceiling() {
        let claimable = 100 * ONE_SUI;
        let total_amount = 500 * ONE_SUI; // Base fee = 50 bps
        let strike_price = 100_000_000;

        // Spot well below strike -> Safe zone -> No risk premium -> 50 bps
        let spot_safe = 90_000_000; // 90% of strike
        let fee_safe = peach_stream::calculate_fee_for_testing(claimable, total_amount, spot_safe, strike_price, HEDGE_CEILING);
        assert!(fee_safe == (claimable * 50) / 10_000, 0);

        // Spot very close to strike -> Danger zone (>95%) -> Risk premium (+150 bps) -> 200 bps
        let spot_danger = 96_000_000; // 96% of strike
        let fee_danger = peach_stream::calculate_fee_for_testing(claimable, total_amount, spot_danger, strike_price, HEDGE_CEILING);
        assert!(fee_danger == (claimable * 200) / 10_000, 1);

        // Spot above strike -> Danger zone -> Risk premium -> 200 bps
        let spot_broken = 110_000_000; // 110% of strike
        let fee_broken = peach_stream::calculate_fee_for_testing(claimable, total_amount, spot_broken, strike_price, HEDGE_CEILING);
        assert!(fee_broken == (claimable * 200) / 10_000, 2);
    }
}
