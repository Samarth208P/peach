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

    use peach_contracts::peach_stream::{Self, PeachStream};
    use peach_contracts::peach_registry::{Self, PeachRegistry};

    public struct TEST_USDC has drop {}

    const SENDER: address = @0xA;
    const RECEIVER: address = @0xB;
    const MARKET_MAKER: address = @0xC;

    const ONE_SUI: u64 = 1_000_000_000;
    const ONE_USDC: u64 = 1_000_000; // 6 decimals
    const STRIKE_1_5_USD: u64 = 150_000_000; // $1.50
    const HEDGE_FLOOR: u8 = 0;
    const HEDGE_CEILING: u8 = 1;
    const MIN_LOT_SIZE: u64 = 1_000_000; // 0.001 SUI min lot size

    // === Helpers ===

    fun setup_env(scenario: &mut Scenario): (Clock, DeepbookAdminCap, ID) {
        let mut clock = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clock, 1_000_000_000); // 1000 seconds
        
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
            1_000_000, // tick_size
            MIN_LOT_SIZE, // lot_size
            MIN_LOT_SIZE, // min_size
            true, // whitelisted
            false, // stable_pool
            admin_cap,
            ts::ctx(scenario)
        );
        ts::return_shared(db_reg);
        pool_id
    }

    fun setup_mock_pyth_price(
        scenario: &mut Scenario,
        clock: &Clock,
        price_val: u64,
        expo_val: u64,
        is_negative: bool
    ): ID {
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

        let price_info_obj = price_info::new_price_info_object_for_testing(
            price_info,
            ts::ctx(scenario)
        );
        let obj_id = sui::object::id(&price_info_obj);
        sui::transfer::public_share_object(price_info_obj);
        obj_id
    }

    fun update_mock_pyth_price(
        scenario: &mut Scenario,
        clock: &Clock,
        price_val: u64,
        expo_val: u64,
        is_negative: bool
    ) {
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

    #[test]
    fun test_e2e_breakage_downside_floor() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _db_reg_id) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        
        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);

        {
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let mut bm = balance_manager::new(ts::ctx(&mut scenario));
            let trade_proof = balance_manager::generate_proof_as_owner(&mut bm, ts::ctx(&mut scenario));
            
            let usdc_coin = coin::mint_for_testing<TEST_USDC>(10_000_000 * ONE_USDC, ts::ctx(&mut scenario));
            balance_manager::deposit(&mut bm, usdc_coin, ts::ctx(&mut scenario));
            
            // Also give the market maker SUI and DEEP just in case!
            let sui_coin = coin::mint_for_testing<SUI>(10_000_000 * ONE_SUI, ts::ctx(&mut scenario));
            balance_manager::deposit(&mut bm, sui_coin, ts::ctx(&mut scenario));
            
            let deep_coin = coin::mint_for_testing<DEEP>(1_000_000_000 * ONE_SUI, ts::ctx(&mut scenario));
            balance_manager::deposit(&mut bm, deep_coin, ts::ctx(&mut scenario));
            
            pool::place_limit_order(
                &mut pool,
                &mut bm,
                &trade_proof,
                1, // client_order_id
                constants::post_only(),
                constants::self_matching_allowed(),
                1_000_000_000, // price
                500 * ONE_SUI, // quantity
                true, // is_bid
                false, // pay_with_deep
                clock::timestamp_ms(&clock) + 10_000_000, // expire
                &clock,
                ts::ctx(&mut scenario)
            );
            
            sui::transfer::public_share_object(bm);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(
            &mut scenario,
            &clock,
            200000000, // price 2.00
            8, // expo 8
            true // negative expo (10^-8)
        );
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let start_time = clock::timestamp_ms(&clock);
            let end_time = start_time + 10_000_000;
            
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER,
                start_time,
                end_time,
                STRIKE_1_5_USD, // $1.50
                HEDGE_FLOOR,
                MIN_LOT_SIZE,
                coin,
                &mut registry,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let current_time = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current_time + 1_000_000); // advance 1000 sec
        };
        
        update_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true); // $2.00
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            
            peach_stream::claim_stream(
                &mut stream,
                &pyth_obj,
                &mut pool,
                deep_fee,
                &mut registry,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            std::debug::print(&stream);
            
            ts::return_shared(stream);
            ts::return_shared(registry);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        {
            let current_time = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current_time + 1_000_000); // advance another 1000 sec
        };
        
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true); // $1.00
        ts::next_tx(&mut scenario, RECEIVER);
        
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            
            peach_stream::claim_stream(
                &mut stream,
                &pyth_obj,
                &mut pool,
                deep_fee,
                &mut registry,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            std::debug::print(&stream);
            
            assert!(peach_stream::hedge_triggered(&stream), 0);
            
            ts::return_shared(stream);
            ts::return_shared(registry);
            ts::return_shared(pyth_obj);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_e2e_breakage_upside_ceiling() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _db_reg_id) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        
        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);

        {
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let mut bm = balance_manager::new(ts::ctx(&mut scenario));
            let trade_proof = balance_manager::generate_proof_as_owner(&mut bm, ts::ctx(&mut scenario));
            let usdc_coin = coin::mint_for_testing<TEST_USDC>(10_000_000 * ONE_USDC, ts::ctx(&mut scenario));
            balance_manager::deposit(&mut bm, usdc_coin, ts::ctx(&mut scenario));
            let sui_coin = coin::mint_for_testing<SUI>(10_000_000 * ONE_SUI, ts::ctx(&mut scenario));
            balance_manager::deposit(&mut bm, sui_coin, ts::ctx(&mut scenario));
            let deep_coin = coin::mint_for_testing<DEEP>(1_000_000_000 * ONE_SUI, ts::ctx(&mut scenario));
            balance_manager::deposit(&mut bm, deep_coin, ts::ctx(&mut scenario));
            
            // For ceiling hedge, taker sells SUI, so maker buys SUI (places bid)
            pool::place_limit_order(
                &mut pool,
                &mut bm,
                &trade_proof,
                1,
                constants::post_only(),
                constants::self_matching_allowed(),
                2_000_000_000, // Maker bids at $2.00
                500 * ONE_SUI, 
                true, // is_bid
                false, 
                clock::timestamp_ms(&clock) + 10_000_000, 
                &clock,
                ts::ctx(&mut scenario)
            );
            
            sui::transfer::public_share_object(bm);
            ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true); // $1.00
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let start_time = clock::timestamp_ms(&clock);
            let end_time = start_time + 10_000_000;
            
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, start_time, end_time, STRIKE_1_5_USD, HEDGE_CEILING, MIN_LOT_SIZE, coin, &mut registry, ts::ctx(&mut scenario)
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let current_time = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current_time + 1_000_000); 
        };
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true); // $1.00
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            peach_stream::claim_stream(&mut stream, &pyth_obj, &mut pool, deep_fee, &mut registry, &clock, ts::ctx(&mut scenario));
            assert!(!peach_stream::hedge_triggered(&stream), 0); // No hedge yet
            ts::return_shared(stream); ts::return_shared(registry); ts::return_shared(pyth_obj); ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        {
            let current_time = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current_time + 1_000_000); 
        };
        update_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true); // $2.00 (breakage!)
        ts::next_tx(&mut scenario, RECEIVER);
        
        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            peach_stream::claim_stream(&mut stream, &pyth_obj, &mut pool, deep_fee, &mut registry, &clock, ts::ctx(&mut scenario));
            assert!(peach_stream::hedge_triggered(&stream), 0); // Hedge triggered!
            ts::return_shared(stream); ts::return_shared(registry); ts::return_shared(pyth_obj); ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_e2e_sub_lot_accumulation() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _db_reg_id) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        
        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true); // $1.00
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let start_time = clock::timestamp_ms(&clock);
            let end_time = start_time + 10_000_000;
            
            // Set MIN_LOT_SIZE to a massive 200 SUI, so individual claims of 100 SUI won't trigger swap
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, start_time, end_time, STRIKE_1_5_USD, HEDGE_FLOOR, 200 * ONE_SUI, coin, &mut registry, ts::ctx(&mut scenario)
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let current_time = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current_time + 1_000_000); 
        };
        update_mock_pyth_price(&mut scenario, &clock, 100000000, 8, true); // $1.00 (needs hedge, but sub-lot)
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let mut stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            peach_stream::claim_stream(&mut stream, &pyth_obj, &mut pool, deep_fee, &mut registry, &clock, ts::ctx(&mut scenario));
            
            assert!(!peach_stream::hedge_triggered(&stream), 0);
            assert!(peach_stream::stream_accumulated_debt(&stream) > 0, 0); // debt accumulated!
            
            ts::return_shared(stream); ts::return_shared(registry); ts::return_shared(pyth_obj); ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_e2e_corporate_salvage() {
        let mut scenario = ts::begin(SENDER);
        let (mut clock, admin_cap, _db_reg_id) = setup_env(&mut scenario);
        ts::next_tx(&mut scenario, SENDER);
        
        let _pool_id = setup_deepbook_pool(&mut scenario, &admin_cap);
        ts::next_tx(&mut scenario, SENDER);

        let _pyth_id = setup_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true); // $2.00
        ts::next_tx(&mut scenario, SENDER);

        {
            let coin = coin::mint_for_testing<SUI>(1000 * ONE_SUI, ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            peach_stream::create_stream<TEST_USDC>(
                RECEIVER, clock::timestamp_ms(&clock), clock::timestamp_ms(&clock) + 10_000_000, STRIKE_1_5_USD, HEDGE_FLOOR, MIN_LOT_SIZE, coin, &mut registry, ts::ctx(&mut scenario)
            );
            ts::return_shared(registry);
        };
        ts::next_tx(&mut scenario, RECEIVER);

        {
            let current_time = clock::timestamp_ms(&clock);
            clock::set_for_testing(&mut clock, current_time + 2_000_000); 
        };
        
        update_mock_pyth_price(&mut scenario, &clock, 200000000, 8, true); // $2.00
        ts::next_tx(&mut scenario, SENDER);

        // Cancel stream
        {
            let stream = ts::take_shared<PeachStream<TEST_USDC>>(&mut scenario);
            let mut registry = ts::take_shared<PeachRegistry>(&mut scenario);
            let pyth_obj = ts::take_shared<PriceInfoObject>(&mut scenario);
            let mut pool = ts::take_shared<Pool<SUI, TEST_USDC>>(&mut scenario);
            let deep_fee = coin::mint_for_testing<DEEP>(1_000_000_000, ts::ctx(&mut scenario));
            
            peach_stream::cancel_stream(stream, &pyth_obj, &mut pool, deep_fee, &mut registry, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(registry); ts::return_shared(pyth_obj); ts::return_shared(pool);
        };
        ts::next_tx(&mut scenario, SENDER);
        
        // Dissolve Vault
        {
            let vault = ts::take_from_sender<peach_stream::SalvageVault<TEST_USDC>>(&mut scenario);
            peach_stream::dissolve_salvage_vault(vault, ts::ctx(&mut scenario));
        };

        sui::transfer::public_transfer(admin_cap, SENDER);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
