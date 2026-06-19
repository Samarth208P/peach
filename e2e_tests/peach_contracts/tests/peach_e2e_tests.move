#[test_only]
module peach_contracts::peach_e2e_tests {
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self, Clock};
    use pyth::i64::{Self};
    use pyth::price::{Self, Price};
    use pyth::price_info::{Self, PriceInfoObject, PriceInfo};
    use pyth::price_feed::{Self, PriceFeed};
    use pyth::price_identifier::{Self, PriceIdentifier};

    use deepbook::registry::{Self as db_registry, Registry, DeepbookAdminCap};
    use deepbook::pool::{Self, Pool};
    use deepbook::balance_manager::{Self, BalanceManager};
    use deepbook::constants;
    use token::deep::DEEP;

    use peach_contracts::peach_stream::{Self, PeachStream, KeeperCap};
    use peach_contracts::peach_registry::{Self, PeachRegistry};

    public struct TEST_USDC has drop {}

    const SENDER: address = @0xA;
    const RECEIVER: address = @0xB;
    const KEEPER: address = @0xC;
    const FALLBACK_BOT: address = @0xD;

    const ONE_SUI: u64 = 1_000_000_000;
    const ONE_USDC: u64 = 1_000_000;
    const STRIKE_1_5_USD: u64 = 150_000_000; // $1.50
    const HEDGE_FLOOR: u8 = 0;
    const PRESET_RETAIL: u8 = 0;
    const PRESET_CORPORATE: u8 = 1;
    const MIN_LOT_SIZE: u64 = 1_000_000;

    const STATUS_HEALTHY: u8 = 0;
    const STATUS_TWAP_ACTIVE: u8 = 1;
    const STATUS_FULLY_HEDGED: u8 = 2;

    // === Helpers ===

    fun setup_env(scenario: &mut Scenario): (Clock, DeepbookAdminCap, ID) {
        let mut clock = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clock, 1_000_000_000);

        let db_reg_id = db_registry::test_registry(ts::ctx(scenario));
        let admin_cap = db_registry::get_admin_cap_for_testing(ts::ctx(scenario));

        ts::next_tx(scenario, SENDER);
        peach_registry::share_registry_for_testing(ts::ctx(scenario));

        (clock, admin_cap, db_reg_id)
    }

    fun setup_deepbook_pool(scenario: &mut Scenario, admin_cap: &DeepbookAdminCap): ID {
        let mut db_reg = ts::take_shared<Registry>(scenario);
        let pool_id = pool::create_pool_admin<SUI, TEST_USDC>(
            &mut db_reg,
            1_000_000,
            MIN_LOT_SIZE,
            MIN_LOT_SIZE,
            true,
            false,
            admin_cap,
            ts::ctx(scenario)
        );
        ts::return_shared(db_reg);
        pool_id
    }

    fun seed_deepbook_liquidity(scenario: &mut Scenario, clock: &Clock) {
        let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(scenario);
        let mut bm = balance_manager::new(ts::ctx(scenario));
        let trade_proof = balance_manager::generate_proof_as_owner(&mut bm, ts::ctx(scenario));

        let usdc_coin = coin::mint_for_testing<TEST_USDC>(10_000_000 * ONE_USDC, ts::ctx(scenario));
        balance_manager::deposit(&mut bm, usdc_coin, ts::ctx(scenario));
        let sui_coin = coin::mint_for_testing<SUI>(10_000_000 * ONE_SUI, ts::ctx(scenario));
        balance_manager::deposit(&mut bm, sui_coin, ts::ctx(scenario));
        let deep_coin = coin::mint_for_testing<DEEP>(1_000_000_000 * ONE_SUI, ts::ctx(scenario));
        balance_manager::deposit(&mut bm, deep_coin, ts::ctx(scenario));

        pool::place_limit_order(
            &mut pool, &mut bm, &trade_proof,
            1, constants::post_only(), constants::self_matching_allowed(),
            1_000_000_000, 5000 * ONE_SUI, true, false,
            clock::timestamp_ms(clock) + 100_000_000, clock, ts::ctx(scenario)
        );

        sui::transfer::public_share_object(bm);
        ts::return_shared(pool);
    }

    fun setup_mock_pyth_price(scenario: &mut Scenario, clock: &Clock, price_val: u64, expo_val: u64, is_negative: bool): ID {
        let id_bytes = x"0000000000000000000000000000000000000000000000000000000000000001";
        let identifier = price_identifier::from_byte_vec(id_bytes);
        let i64_price = i64::new(price_val, false);
        let i64_expo = i64::new(expo_val, is_negative);
        let price = price::new(i64_price, 0, i64_expo, clock::timestamp_ms(clock) / 1000);
        let price_feed = price_feed::new(identifier, price, price);
        let price_info = price_info::new_price_info(
            clock::timestamp_ms(clock) / 1000,
            clock::timestamp_ms(clock) / 1000,
            price_feed
        );
        let price_info_obj = price_info::new_price_info_object_for_testing(price_info, ts::ctx(scenario));
        let obj_id = sui::object::id(&price_info_obj);
        sui::transfer::public_share_object(price_info_obj);
        obj_id
    }

    fun update_mock_pyth_price(scenario: &mut Scenario, clock: &Clock, price_val: u64, expo_val: u64, is_negative: bool) {
        let mut price_info_obj = ts::take_shared<PriceInfoObject>(scenario);
        let id_bytes = x"0000000000000000000000000000000000000000000000000000000000000001";
        let identifier = price_identifier::from_byte_vec(id_bytes);
        let i64_price = i64::new(price_val, false);
        let i64_expo = i64::new(expo_val, is_negative);
        let price = price::new(i64_price, 0, i64_expo, clock::timestamp_ms(clock) / 1000);
        let price_feed = price_feed::new(identifier, price, price);
        let price_info = price_info::new_price_info(
            clock::timestamp_ms(clock) / 1000,
            clock::timestamp_ms(clock) / 1000,
            price_feed
        );
        price_info::update_price_info_object_for_testing(&mut price_info_obj, &price_info);
        ts::return_shared(price_info_obj);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 1: Full TWAP lifecycle (Retail preset: create → initiate → 2x execute → claim USDC)
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_full_twap_lifecycle_retail() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);

        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);
        seed_deepbook_liquidity(&mut scenario, &clock);
        ts::next_tx(&mut scenario, SENDER);

        // Price starts at $2.00 (healthy)
        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true);
        ts::next_tx(&mut scenario, SENDER);

        // Create stream with RETAIL preset (3 tranches)
        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let start_time = clock::timestamp_ms(&clock);
            let end_time = start_time + 10_000_000;
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, start_time, end_time, STRIKE_1_5_USD,
                HEDGE_FLOOR, PRESET_RETAIL, MIN_LOT_SIZE, coin,
                &mut registry, ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // Crash price to $1.00
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, KEEPER);

        // Keeper initiates hedge
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = peach_stream::create_keeper_cap_for_testing(ts::ctx(&mut scenario));

            peach_stream::initiate_hedge(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            assert!(peach_stream::stream_liquidation_status(&stream) == STATUS_TWAP_ACTIVE, 0);
            assert!(peach_stream::stream_tranches_executed(&stream) == 1, 1);
            assert!(peach_stream::usdc_balance(&stream) > 0, 2);

            sui::transfer::public_transfer(keeper_cap, KEEPER);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // Advance clock past interval (300_000 ms = 5 min)
        {
            let current = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current + 400_000);
        };
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, KEEPER);

        // Execute tranche 2
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = ts::take_from_sender<KeeperCap>(&mut scenario);

            peach_stream::execute_tranche(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            assert!(peach_stream::stream_tranches_executed(&stream) == 2, 0);

            ts::return_to_sender(&scenario, keeper_cap);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // Advance clock for tranche 3
        {
            let current = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current + 400_000);
        };
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, KEEPER);

        // Execute tranche 3 (final)
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = ts::take_from_sender<KeeperCap>(&mut scenario);

            peach_stream::execute_tranche(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            assert!(peach_stream::stream_tranches_executed(&stream) == 3, 0);
            assert!(peach_stream::stream_liquidation_status(&stream) == STATUS_FULLY_HEDGED, 1);
            assert!(peach_stream::remaining_balance(&stream) == 0, 2);

            ts::return_to_sender(&scenario, keeper_cap);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, RECEIVER);

        // Advance time so funds vest, then claim (should get pure USDC)
        {
            let current = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current + 5_000_000);
        };
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));

            peach_stream::claim_stream(
                &mut stream, &pyth_obj, &mut pool, deep_fee,
                &mut registry, &clock, ts::ctx(&mut scenario),
            );

            // Stream should have paid out USDC (SUI balance is 0)
            assert!(peach_stream::remaining_balance(&stream) == 0, 0);

            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
            ts::return_shared(registry);
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 2: initiate_hedge reverts when market is healthy
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    #[expected_failure(abort_code = peach_stream::EMarketIsHealthy)]
    fun test_initiate_hedge_reverts_healthy_market() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);

        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);
        seed_deepbook_liquidity(&mut scenario, &clock);
        ts::next_tx(&mut scenario, SENDER);

        // Price at $2.00 (well above $1.50 strike)
        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true);
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, clock::timestamp_ms(&clock), clock::timestamp_ms(&clock) + 10_000_000,
                STRIKE_1_5_USD, HEDGE_FLOOR, PRESET_CORPORATE, MIN_LOT_SIZE, coin,
                &mut registry, ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // Try to initiate hedge with healthy price — should revert
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = peach_stream::create_keeper_cap_for_testing(ts::ctx(&mut scenario));

            peach_stream::initiate_hedge(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            sui::transfer::public_transfer(keeper_cap, KEEPER);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 3: execute_tranche respects rate-limit interval
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    #[expected_failure(abort_code = peach_stream::ETWAPIntervalNotElapsed)]
    fun test_execute_tranche_rate_limited() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);

        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);
        seed_deepbook_liquidity(&mut scenario, &clock);
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true);
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, clock::timestamp_ms(&clock), clock::timestamp_ms(&clock) + 10_000_000,
                STRIKE_1_5_USD, HEDGE_FLOOR, PRESET_CORPORATE, MIN_LOT_SIZE, coin,
                &mut registry, ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // Crash price
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, KEEPER);

        // Initiate hedge (tranche 1)
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = peach_stream::create_keeper_cap_for_testing(ts::ctx(&mut scenario));

            peach_stream::initiate_hedge(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            sui::transfer::public_transfer(keeper_cap, KEEPER);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // DON'T advance clock — try execute immediately (should fail)
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, KEEPER);

        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = ts::take_from_sender<KeeperCap>(&mut scenario);

            peach_stream::execute_tranche(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            ts::return_to_sender(&scenario, keeper_cap);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 4: Cancel during TWAP_ACTIVE — SalvageVault has both SUI + USDC
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_cancel_during_twap_salvage_dual_asset() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);

        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);
        seed_deepbook_liquidity(&mut scenario, &clock);
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true);
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, clock::timestamp_ms(&clock), clock::timestamp_ms(&clock) + 10_000_000,
                STRIKE_1_5_USD, HEDGE_FLOOR, PRESET_RETAIL, MIN_LOT_SIZE, coin,
                &mut registry, ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, KEEPER);

        // Crash and initiate (1 tranche executed)
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, KEEPER);

        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            let keeper_cap = peach_stream::create_keeper_cap_for_testing(ts::ctx(&mut scenario));

            peach_stream::initiate_hedge(
                &keeper_cap, &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            // After 1 of 3 tranches: stream has both SUI and USDC
            assert!(peach_stream::remaining_balance(&stream) > 0, 0);
            assert!(peach_stream::usdc_balance(&stream) > 0, 1);

            sui::transfer::public_transfer(keeper_cap, KEEPER);
            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        // Sender cancels mid-TWAP
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));

            peach_stream::cancel_stream(
                stream, &pyth_obj, &mut pool, deep_fee,
                &mut registry, &clock, ts::ctx(&mut scenario),
            );

            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, SENDER);

        // Verify SalvageVault has both assets
        {
            let vault = ts::take_from_sender<peach_stream::SalvageVault<TEST_USDC>>(&mut scenario);
            // Should have remaining SUI (2/3 not yet liquidated)
            assert!(peach_stream::salvage_sui_balance(&vault) > 0, 0);
            // Should have USDC from the 1 tranche that executed
            assert!(peach_stream::salvage_usdc_balance(&vault) > 0, 1);

            peach_stream::dissolve_salvage_vault(vault, ts::ctx(&mut scenario));
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 5: Fallback trigger reverts before 5-min delay
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    #[expected_failure(abort_code = peach_stream::EKeeperStillHasTime)]
    fun test_fallback_reverts_before_delay() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);

        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);
        seed_deepbook_liquidity(&mut scenario, &clock);
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true);
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, clock::timestamp_ms(&clock), clock::timestamp_ms(&clock) + 10_000_000,
                STRIKE_1_5_USD, HEDGE_FLOOR, PRESET_CORPORATE, MIN_LOT_SIZE, coin,
                &mut registry, ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, FALLBACK_BOT);

        // Crash price — but DON'T advance clock past 5 min
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, FALLBACK_BOT);

        // Attempt fallback immediately — should fail (keeper still has time)
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));

            peach_stream::fallback_hedge_trigger(
                &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 6: Fallback succeeds after 5-min delay
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_fallback_succeeds_after_delay() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);

        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);
        seed_deepbook_liquidity(&mut scenario, &clock);
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true);
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, clock::timestamp_ms(&clock), clock::timestamp_ms(&clock) + 10_000_000,
                STRIKE_1_5_USD, HEDGE_FLOOR, PRESET_CORPORATE, MIN_LOT_SIZE, coin,
                &mut registry, ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, FALLBACK_BOT);

        // Crash price at current time
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true);
        ts::next_tx(&mut scenario, FALLBACK_BOT);

        // Advance clock 6 minutes (past 5-min delay) — but DON'T update pyth timestamp
        // This means pyth publish_time is 6 minutes old → fallback condition met
        {
            let current = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current + 360_000);
        };
        ts::next_tx(&mut scenario, FALLBACK_BOT);

        // Fallback should succeed
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));

            peach_stream::fallback_hedge_trigger(
                &mut stream, &pyth_obj, &mut pool,
                deep_fee, 0, &clock, ts::ctx(&mut scenario),
            );

            // Stream should now be in TWAP_ACTIVE with 1 tranche executed
            assert!(peach_stream::stream_liquidation_status(&stream) == STATUS_TWAP_ACTIVE, 0);
            assert!(peach_stream::stream_tranches_executed(&stream) == 1, 1);
            assert!(peach_stream::usdc_balance(&stream) > 0, 2);

            ts::return_shared(stream);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
