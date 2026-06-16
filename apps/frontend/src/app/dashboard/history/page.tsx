"use client";

import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';
import { ArrowUpRight, ArrowDownLeft, Clock, History } from 'lucide-react';

const PACKAGE_ID = "0xfeded63bda28be37a34d937fe8dfe8c294596a26f4c9805128812edfd085c025";

export default function HistoricalLedgerTable() {
  const currentAccount = useCurrentAccount();

  // Pull all cancellation receipts emitted by the package
  const { data: cancellationEvents, isLoading } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::peach_stream::StreamCanceled` },
      order: 'descending',
    }
  );

  // Filter events locally where the user was a participant
  const userHistory = cancellationEvents?.data.filter((event) => {
    const payload = event.parsedJson as any;
    return payload?.sender === currentAccount?.address || payload?.receiver === currentAccount?.address;
  }) || [];

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">Transaction History</h1>
        <p className="text-[#8a8690] text-sm">View your terminated and completed stream receipts, including salvaged premiums.</p>
      </div>

      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)]">
        
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <History className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Ledger</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690] relative z-10">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying Immutable Log</p>
          </div>
        ) : userHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50 relative z-10">
            <Clock className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No History Found</p>
            <p className="text-[#8a8690] text-xs">You haven't participated in any terminated streams yet.</p>
          </div>
        ) : (
          <div className="space-y-3 relative z-10">
            {userHistory.map((tx) => {
              const data = tx.parsedJson as any;
              const isSender = data.sender === currentAccount?.address;
              const settledAmount = (data.receiver_settled_sui / 1e9).toFixed(2);
              const refundedAmount = (data.sender_refunded_sui / 1e9).toFixed(2);

              return (
                <div key={tx.id.txDigest} className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#141418] hover:scale-[1.005] transition-all duration-500 ease-out">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      {isSender ? <ArrowUpRight size={18} strokeWidth={1.5} /> : <ArrowDownLeft size={18} strokeWidth={1.5} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[#e8e4df] text-sm font-medium">{isSender ? 'Outbound Cancelled' : 'Inbound Claimed'}</span>
                        <span className="bg-[#141418] border border-white/5 text-[#8a8690] text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Finalized
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8690]/70 font-mono tracking-wider">
                        TX: {tx.id.txDigest.substring(0, 16)}...
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end w-full sm:w-auto">
                    <div className="text-[#e8e4df] text-sm font-mono font-medium mb-1.5 flex items-center gap-2">
                      {isSender ? `+${refundedAmount}` : `+${settledAmount}`}
                      <span className="text-[#8a8690] text-xs">SUI</span>
                    </div>
                    <div className="text-[11px] text-[#8a8690]">
                      {isSender ? `${settledAmount} SUI paid to recipient` : `${refundedAmount} SUI returned to sender`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
