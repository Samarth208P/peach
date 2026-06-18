/// Module: `peach_contracts::peach_registry`
///
/// PILLAR 5: Historical Receipt Ledger — The Compliance & Audit Layer.
module peach_contracts::peach_registry {
    use sui::table::{Self, Table};
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};

    // ============================================================================
    // Errors
    // ============================================================================

    const EStreamAlreadyRegistered: u64 = 100;
    const EStreamNotFound: u64 = 101;
    const ENotAdmin: u64 = 102;

    // ============================================================================
    // Constants — Stream Status
    // ============================================================================

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_CANCELED: u8 = 1;
    const STATUS_COMPLETED: u8 = 2;

    // ============================================================================
    // Objects
    // ============================================================================

    /// Admin capability for the protocol owner to extract fees.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Singleton shared registry tracking all Peach streams for audit/compliance.
    public struct PeachRegistry has key {
        id: UID,
        streams: Table<ID, StreamRecord>,
        total_streams: u64,
        total_volume: u128,
        fee_treasury: Balance<SUI>,
    }

    public struct StreamRecord has store, drop {
        sender: address,
        receiver: address,
        total_amount: u64,
        strike_price: u64,
        hedge_direction: u8,
        start_time: u64,
        end_time: u64,
        status: u8,
        created_at: u64,
        finalized_at: u64,
        receiver_settled: u64,
        sender_refunded: u64,
    }

    // ============================================================================
    // Events
    // ============================================================================

    public struct StreamRegistered has copy, drop {
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
        registry_total_streams: u64,
    }

    public struct StreamFinalized has copy, drop {
        stream_id: ID,
        status: u8,
        finalized_at: u64,
    }

    public struct FeesWithdrawn has copy, drop {
        amount: u64,
        admin: address,
    }

    // ============================================================================
    // Init
    // ============================================================================

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(admin_cap, ctx.sender());

        let registry = PeachRegistry {
            id: object::new(ctx),
            streams: table::new(ctx),
            total_streams: 0,
            total_volume: 0,
            fee_treasury: balance::zero(),
        };
        transfer::share_object(registry);
    }

    // ============================================================================
    // Admin & Fee Operations
    // ============================================================================

    /// Withdraw collected fees to the admin.
    public fun withdraw_fees(
        _cap: &AdminCap,
        registry: &mut PeachRegistry,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        let withdraw_amount = if (amount == 0 || amount > balance::value(&registry.fee_treasury)) {
            balance::value(&registry.fee_treasury)
        } else {
            amount
        };

        event::emit(FeesWithdrawn {
            amount: withdraw_amount,
            admin: ctx.sender(),
        });

        coin::take(&mut registry.fee_treasury, withdraw_amount, ctx)
    }

    /// Deposit a fee collected during a stream claim.
    public(package) fun deposit_fee(
        registry: &mut PeachRegistry,
        fee: Balance<SUI>,
    ) {
        balance::join(&mut registry.fee_treasury, fee);
    }

    // ============================================================================
    // Friend-only write operations
    // ============================================================================

    public(package) fun register_stream(
        registry: &mut PeachRegistry,
        stream_id: ID,
        sender: address,
        receiver: address,
        total_amount: u64,
        strike_price: u64,
        hedge_direction: u8,
        start_time: u64,
        end_time: u64,
    ) {
        assert!(!table::contains(&registry.streams, stream_id), EStreamAlreadyRegistered);

        let record = StreamRecord {
            sender,
            receiver,
            total_amount,
            strike_price,
            hedge_direction,
            start_time,
            end_time,
            status: STATUS_ACTIVE,
            created_at: start_time,
            finalized_at: 0,
            receiver_settled: 0,
            sender_refunded: 0,
        };

        table::add(&mut registry.streams, stream_id, record);
        registry.total_streams = registry.total_streams + 1;
        registry.total_volume = registry.total_volume + (total_amount as u128);

        event::emit(StreamRegistered {
            stream_id,
            sender,
            receiver,
            total_amount,
            registry_total_streams: registry.total_streams,
        });
    }

    public(package) fun record_cancellation(
        registry: &mut PeachRegistry,
        stream_id: ID,
        receiver_settled: u64,
        sender_refunded: u64,
        timestamp: u64,
    ) {
        assert!(table::contains(&registry.streams, stream_id), EStreamNotFound);

        let record = table::borrow_mut(&mut registry.streams, stream_id);
        record.status = STATUS_CANCELED;
        record.finalized_at = timestamp;
        record.receiver_settled = receiver_settled;
        record.sender_refunded = sender_refunded;

        event::emit(StreamFinalized {
            stream_id,
            status: STATUS_CANCELED,
            finalized_at: timestamp,
        });
    }

    public(package) fun record_completion(
        registry: &mut PeachRegistry,
        stream_id: ID,
        total_amount: u64,
        timestamp: u64,
    ) {
        assert!(table::contains(&registry.streams, stream_id), EStreamNotFound);

        let record = table::borrow_mut(&mut registry.streams, stream_id);
        record.status = STATUS_COMPLETED;
        record.finalized_at = timestamp;
        record.receiver_settled = total_amount;
        record.sender_refunded = 0;

        event::emit(StreamFinalized {
            stream_id,
            status: STATUS_COMPLETED,
            finalized_at: timestamp,
        });
    }

    // ============================================================================
    // Public read-only views
    // ============================================================================

    public fun stream_exists(registry: &PeachRegistry, stream_id: ID): bool {
        table::contains(&registry.streams, stream_id)
    }

    public fun total_streams(registry: &PeachRegistry): u64 {
        registry.total_streams
    }

    public fun total_volume(registry: &PeachRegistry): u128 {
        registry.total_volume
    }

    public fun treasury_balance(registry: &PeachRegistry): u64 {
        balance::value(&registry.fee_treasury)
    }

    public fun stream_status(registry: &PeachRegistry, stream_id: ID): u8 {
        let record = table::borrow(&registry.streams, stream_id);
        record.status
    }

    public fun stream_sender(registry: &PeachRegistry, stream_id: ID): address {
        let record = table::borrow(&registry.streams, stream_id);
        record.sender
    }

    public fun stream_receiver(registry: &PeachRegistry, stream_id: ID): address {
        let record = table::borrow(&registry.streams, stream_id);
        record.receiver
    }

    public fun stream_total_amount(registry: &PeachRegistry, stream_id: ID): u64 {
        let record = table::borrow(&registry.streams, stream_id);
        record.total_amount
    }

    public fun stream_finalized_at(registry: &PeachRegistry, stream_id: ID): u64 {
        let record = table::borrow(&registry.streams, stream_id);
        record.finalized_at
    }

    public fun stream_receiver_settled(registry: &PeachRegistry, stream_id: ID): u64 {
        let record = table::borrow(&registry.streams, stream_id);
        record.receiver_settled
    }

    public fun stream_sender_refunded(registry: &PeachRegistry, stream_id: ID): u64 {
        let record = table::borrow(&registry.streams, stream_id);
        record.sender_refunded
    }

    // ============================================================================
    // Test-only
    // ============================================================================

    #[test_only]
    public fun create_registry_for_testing(ctx: &mut TxContext): PeachRegistry {
        PeachRegistry {
            id: object::new(ctx),
            streams: table::new(ctx),
            total_streams: 0,
            total_volume: 0,
            fee_treasury: balance::zero(),
        }
    }

    #[test_only]
    public fun share_registry_for_testing(ctx: &mut TxContext) {
        let registry = PeachRegistry {
            id: object::new(ctx),
            streams: table::new(ctx),
            total_streams: 0,
            total_volume: 0,
            fee_treasury: balance::zero(),
        };
        transfer::share_object(registry);
    }
}
