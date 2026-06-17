"use client";

import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { ArrowUpRight, ArrowDownLeft, Clock, History, Zap } from "lucide-react";
import { PEACH_PACKAGE_ID } from "@/lib/constants";

export default function HistoricalLedgerTable() {
  const currentAccount = useCurrentAccount();

  const { data: cancellationEvents, isLoading: isCancelLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCanceled` },
      order: "descending",
    }
  );

  const { data: claimEvents, isLoading: isClaimLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamClaimed` },
      order: "descending",
    }
  );

  const { data: hedgeEvents, isLoading: isHedgeLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::HedgeTriggered` },
      order: "descending",
    }
  );

  const isLoading = isCancelLoading || isClaimLoading || isHedgeLoading;

  // Cancellation history
  const userCancels =
    cancellationEvents?.data.filter((event) => {
      const payload = event.parsedJson as any;
      return (
        payload?.sender === currentAccount?.address ||
        payload?.receiver === currentAccount?.address
      );
    }) || [];

  // Claim history (receiver)
  const userClaims =
    claimEvents?.data.filter((event) => {
      const payload = event.parsedJson as any;
      return payload?.claimer === currentAccount?.address;
    }) || [];

  // Hedge events (any stream by current user)
  const userHedges = hedgeEvents?.data || [];

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">
          Transaction History
        </h1>
        <p className="text-[#8a8690] text-sm">
          Complete on-chain ledger — claims, hedge executions, and cancelled streams.
        </p>
      </div>

      {/* Claims Section */}
      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 mb-8">
        <div className="flex items-center gap-3 mb-8">
          <ArrowDownLeft className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Stream Claims</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying</p>
          </div>
        ) : userClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Clock className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Claims Yet</p>
            <p className="text-[#8a8690] text-xs">Your claimed amounts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {userClaims.map((tx) => {
              const data = tx.parsedJson as any;
              const suiClaimed = (Number(data.sui_claimed) / 1e9).toFixed(4);
              const usdcHedge = (Number(data.usdc_hedge_out) / 1e6).toFixed(2);
              const wasHedged = Number(data.usdc_hedge_out) > 0;
              const execPrice = (Number(data.execution_price) / 100_000_000).toFixed(3);

              return (
                <div
                  key={tx.id.txDigest}
                  className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#141418] transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl border text-[#8a8690] ${wasHedged ? "bg-[#FD8566]/10 border-[#FD8566]/20" : "bg-[#0d0d10] border-white/5"}`}>
                      {wasHedged ? <Zap size={18} strokeWidth={1.5} className="text-[#FD8566]" /> : <ArrowDownLeft size={18} strokeWidth={1.5} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[#e8e4df] text-sm font-medium">
                          {wasHedged ? "Hedged Claim (USDC)" : "Standard Claim (SUI)"}
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest ${wasHedged ? "bg-[#FD8566]/15 text-[#FD8566]" : "bg-white/5 text-[#8a8690]"}`}>
                          {wasHedged ? "⚡ DeepBook Swap" : "Direct"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8690]/70 font-mono tracking-wider">
                        TX: {tx.id.txDigest.substring(0, 16)}...{wasHedged ? ` · Pyth spot: $${execPrice}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end w-full sm:w-auto">
                    {wasHedged ? (
                      <>
                        <div className="text-[#FD8566] font-mono font-medium mb-1 text-sm">
                          +{usdcHedge} USDC
                        </div>
                        <div className="text-[11px] text-[#8a8690]">
                          {suiClaimed} SUI auto-converted
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[#e8e4df] font-mono font-medium mb-1 text-sm">
                          +{suiClaimed} SUI
                        </div>
                        <div className="text-[11px] text-[#8a8690]">
                          Spot: ${execPrice}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancellations Section */}
      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 mb-8">
        <div className="flex items-center gap-3 mb-8">
          <History className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Cancelled Streams</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
          </div>
        ) : userCancels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Clock className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Cancelled Streams</p>
          </div>
        ) : (
          <div className="space-y-3">
            {userCancels.map((tx) => {
              const data = tx.parsedJson as any;
              const isSender = data.sender === currentAccount?.address;
              const settledAmount = (Number(data.receiver_settled_sui) / 1e9).toFixed(4);
              const refundedAmount = (Number(data.sender_refunded_sui) / 1e9).toFixed(4);

              return (
                <div
                  key={tx.id.txDigest}
                  className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#141418] transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      {isSender ? <ArrowUpRight size={18} strokeWidth={1.5} /> : <ArrowDownLeft size={18} strokeWidth={1.5} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[#e8e4df] text-sm font-medium">
                          {isSender ? "Stream Cancelled (Sender)" : "Stream Settled (Receiver)"}
                        </span>
                        <span className="bg-[#141418] border border-white/5 text-[#8a8690] text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Finalized
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8690]/70 font-mono">
                        TX: {tx.id.txDigest.substring(0, 16)}...
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end w-full sm:w-auto">
                    <div className="text-[#e8e4df] text-sm font-mono font-medium mb-1">
                      {isSender ? `+${refundedAmount} SUI refunded` : `+${settledAmount} SUI settled`}
                    </div>
                    <div className="text-[11px] text-[#8a8690]">
                      {isSender ? `Recipient received ${settledAmount} SUI` : `Sender refunded ${refundedAmount} SUI`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hedge Fire Log */}
      {(userHedges.length > 0 || !isLoading) && (
        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-[#FD8566]/10 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-4 h-4 text-[#FD8566]" />
            <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
              DeepBook Auto-Hedge Executions
            </h2>
          </div>
          {userHedges.length === 0 ? (
            <div className="py-8 text-center text-[#8a8690] text-xs">
              No automated hedges have executed yet. Hedges fire when Pyth reports spot &lt; strike.
            </div>
          ) : (
            <div className="space-y-2">
              {userHedges.slice(0, 15).map((e, i) => {
                const d = e.parsedJson as any;
                const spot = (Number(d.spot_price) / 100_000_000).toFixed(3);
                const strike = (Number(d.strike_price) / 100_000_000).toFixed(3);
                const swapped = (Number(d.sui_swapped) / 1e9).toFixed(4);
                return (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div>
                      <div className="text-xs text-[#e8e4df] font-medium mb-0.5">
                        ⚡ Spot ${spot} &lt; Strike ${strike}
                      </div>
                      <div className="text-[10px] text-[#8a8690] font-mono">
                        Stream: {(d.stream_id as string).slice(0, 12)}... · {new Date(Number(e.timestampMs)).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-[#FD8566] text-sm font-mono font-medium">
                      {swapped} SUI → USDC
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
