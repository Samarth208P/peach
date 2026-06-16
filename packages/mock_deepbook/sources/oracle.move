module deepbook::oracle {
    use sui::object::UID;

    public struct OracleSVI has key, store {
        id: UID,
        mock_price: u64,
    }

    public fun get_current_price(oracle: &OracleSVI): u64 {
        oracle.mock_price
    }

    public fun create_oracle(mock_price: u64, ctx: &mut TxContext): OracleSVI {
        OracleSVI {
            id: sui::object::new(ctx),
            mock_price,
        }
    }
}
