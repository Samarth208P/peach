#[test_only]
module peach_contracts::peach_stream_tests {
    use sui::coin;
    use sui::sui::SUI;
    use sui::test_scenario::{Self as ts, Scenario};

    use peach_contracts::peach_stream::{Self, PeachStream};
    use peach_contracts::peach_registry::{Self, PeachRegistry};

    public struct TEST_USDC has drop {}

    const SENDER: address = @0xA;
    const RECEIVER: address = @0xB;

    const ONE_SUI: u64 = 1_000_000_000;
    const STRIKE_1USD: u64 = 100_000_000;
    const STRIKE_2_5USD: u64 = 250_000_000;

    // Hedge directions
    const HEDGE_FLOOR: u8 = 0;
    const HEDGE_CEILING: u8 = 1;
    const HEDGE_NONE: u8 = 2;

    // TWAP presets
    const PRESET_RETAIL: u8 = 0;
    const PRESET_CORPORATE: u8 = 1;
    const PRESET_INSTITUTIONAL: u8 = 2;

    // Liquidation status
    const STATUS_HEALTHY: u8 = 0;

    const DEFAULT_MIN_LOT: u64 = 10_000_000;

    // ── Helpers ──

    fun setup_registry(scenario: &mut Scenario) {
        ts::next_tx(scenario, SENDER);
        peach_registry::share_registry_for_testing(ts::ctx(scenario));
    }

    fun new_stream(
        scenario: &mut Scenario,
        amount: u64,
        start_time: u64,
        end_time: u64,
        strike_price: u64,
        hedge_direction: u8,
        twap_preset: u8,
        min_lot_size: u64,
    ) {
        let coin = coin::mint_for_testing<SUI>(amount, ts::ctx(scenario));
        let mut registry = ts::take_shared<PeachRegistry>(scenario);
        peach_stream::create_stream<TEST_USDC>(
            RECEIVER, start_time, end_time, strike_price,
            hedge_direction, twap_preset, min_lot_size, coin,
            &mut registry, ts::ctx(scenario),
        );
        ts::return_shared(registry);
    }

    fun new_floor_stream(scenario: &mut Scenario, amount: u64, start_time: u64, end_time: u64, strike_price: u64) {
        new_stream(scenario, amount, start_time, end_time, strike_price, HEDGE_FLOOR, PRESET_CORPORATE, 0);
    }

    fun new_ceiling_stream(scenario: &mut Scenario, amount: u64, start_time: u64, end_time: u64, strike_price: u64) {
        new_stream(scenario, amount, start_time, end_time, strike_price, HEDGE_CEILING, PRESET_CORPORATE, 0);
    }

    fun new_unhedged_stream(scenario: &mut Scenario, amount: u64, start_time: u64, end_time: u64) {
        new_stream(scenario, amount, start_time, end_time, 0, HEDGE_NONE, PRESET_CORPORATE, 0);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Stream creation tests
    // ════════════════════════════════════════════════════════════════════════════

    #[test]
    fun create_floor_stream_sets_expected_state() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::stream_sender(&stream) == SENDER, 0);
            assert!(peach_stream::stream_receiver(&stream) == RECEIVER, 1);
            assert!(peach_stream::total_amount(&stream) == ONE_SUI, 2);
            assert!(peach_stream::remaining_balance(&stream) == ONE_SUI, 3);
            assert!(peach_stream::stream_withdrawn(&stream) == 0, 4);
            assert!(peach_stream::stream_strike_price(&stream) == STRIKE_1USD, 5);
            assert!(peach_stream::stream_hedge_direction(&stream) == HEDGE_FLOOR, 6);
            assert!(!peach_stream::hedge_triggered(&stream), 7);
            assert!(peach_stream::stream_accumulated_debt(&stream) == 0, 8);
            assert!(peach_stream::stream_min_lot_size(&stream) == DEFAULT_MIN_LOT, 9);
            // v2: check new fields
            assert!(peach_stream::stream_liquidation_status(&stream) == STATUS_HEALTHY, 10);
            assert!(peach_stream::stream_twap_tranches(&stream) == 5, 11); // Corporate preset
            assert!(peach_stream::stream_tranches_executed(&stream) == 0, 12);
            assert!(peach_stream::usdc_balance(&stream) == 0, 13);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    #[test]
    fun create_stream_with_retail_preset() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD, HEDGE_FLOOR, PRESET_RETAIL, 0);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::stream_twap_tranches(&stream) == 3, 0);
            assert!(peach_stream::stream_twap_interval(&stream) == 300_000, 1);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    #[test]
    fun create_stream_with_institutional_preset() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD, HEDGE_FLOOR, PRESET_INSTITUTIONAL, 0);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::stream_twap_tranches(&stream) == 10, 0);
            assert!(peach_stream::stream_twap_interval(&stream) == 1_080_000, 1);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    #[test]
    fun create_ceiling_stream_sets_hedge_direction() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_ceiling_stream(&mut scenario, 2 * ONE_SUI, 1000, 5000, STRIKE_2_5USD);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::stream_hedge_direction(&stream) == HEDGE_CEILING, 0);
            assert!(peach_stream::stream_strike_price(&stream) == STRIKE_2_5USD, 1);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    #[test]
    fun create_unhedged_stream_sets_none_direction() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_unhedged_stream(&mut scenario, ONE_SUI, 1000, 5000);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::stream_hedge_direction(&stream) == HEDGE_NONE, 0);
            assert!(peach_stream::stream_strike_price(&stream) == 0, 1);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Validation tests
    // ════════════════════════════════════════════════════════════════════════════

    #[test]
    #[expected_failure(abort_code = peach_stream::EZeroDeposit)]
    fun create_stream_rejects_zero_deposit() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, 0, 1000, 5000, STRIKE_1USD);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = peach_stream::EInvalidTimeline)]
    fun create_stream_rejects_inverted_timeline() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, ONE_SUI, 5000, 1000, STRIKE_1USD);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = peach_stream::EInvalidTimeline)]
    fun create_stream_rejects_equal_times() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, ONE_SUI, 5000, 5000, STRIKE_1USD);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = peach_stream::EInvalidHedgeDirection)]
    fun create_stream_rejects_invalid_hedge_direction() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD, 5, PRESET_CORPORATE, 0);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = peach_stream::EInvalidTWAPPreset)]
    fun create_stream_rejects_invalid_twap_preset() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD, HEDGE_FLOOR, 99, 0);
        ts::end(scenario);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Vesting math
    // ════════════════════════════════════════════════════════════════════════════

    #[test]
    fun claimable_follows_linear_schedule() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::claimable_at(&stream, 0) == 0, 0);
            assert!(peach_stream::claimable_at(&stream, 1000) == 0, 1);
            assert!(peach_stream::claimable_at(&stream, 2000) == ONE_SUI / 4, 2);
            assert!(peach_stream::claimable_at(&stream, 3000) == ONE_SUI / 2, 3);
            assert!(peach_stream::claimable_at(&stream, 4000) == (ONE_SUI * 3) / 4, 4);
            assert!(peach_stream::claimable_at(&stream, 5000) == ONE_SUI, 5);
            assert!(peach_stream::claimable_at(&stream, 9999) == ONE_SUI, 6);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    #[test]
    fun claimable_handles_large_amounts_without_overflow() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        let big = 1_000_000 * ONE_SUI;
        new_unhedged_stream(&mut scenario, big, 0, 1_000_000);

        ts::next_tx(&mut scenario, RECEIVER);
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&scenario);
            assert!(peach_stream::claimable_at(&stream, 500_000) == big / 2, 0);
            assert!(peach_stream::claimable_at(&stream, 1_000_000) == big, 1);
            ts::return_shared(stream);
        };
        ts::end(scenario);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Registry integration
    // ════════════════════════════════════════════════════════════════════════════

    #[test]
    fun registry_tracks_stream_creation() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD);

        ts::next_tx(&mut scenario, SENDER);
        {
            let registry = ts::take_shared<PeachRegistry>(&scenario);
            assert!(peach_registry::total_streams(&registry) == 1, 0);
            assert!(peach_registry::total_volume(&registry) == (ONE_SUI as u128), 1);
            ts::return_shared(registry);
        };
        ts::end(scenario);
    }

    #[test]
    fun registry_tracks_multiple_streams() {
        let mut scenario = ts::begin(SENDER);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, SENDER);
        new_floor_stream(&mut scenario, ONE_SUI, 1000, 5000, STRIKE_1USD);

        ts::next_tx(&mut scenario, SENDER);
        new_ceiling_stream(&mut scenario, 2 * ONE_SUI, 2000, 8000, STRIKE_2_5USD);

        ts::next_tx(&mut scenario, SENDER);
        new_unhedged_stream(&mut scenario, 3 * ONE_SUI, 0, 10000);

        ts::next_tx(&mut scenario, SENDER);
        {
            let registry = ts::take_shared<PeachRegistry>(&scenario);
            assert!(peach_registry::total_streams(&registry) == 3, 0);
            assert!(peach_registry::total_volume(&registry) == (6 * ONE_SUI as u128), 1);
            ts::return_shared(registry);
        };
        ts::end(scenario);
    }
}
