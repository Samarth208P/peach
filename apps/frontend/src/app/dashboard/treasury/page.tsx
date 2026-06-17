"use client";

import { useEffect, useState } from "react";
import { Wallet, PieChart, Coins, Briefcase, ArrowUpRight, Clock } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { PEACH_PACKAGE_ID, PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

interface SalvageRecord {
  id: string;
  returned: number;
  date: number;
  recipient: string;
}

export default function TreasuryPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [totalLocked, setTotalLocked] = useState(0);
  const [usdcPortfolio, setUsdcPortfolio] = useState(0);
  const [hedgingPremium, setHedgingPremium] = useState(0);
  const [totalSalvaged, setTotalSalvaged] = useState(0);
  const [salvageLedger, setSalvageLedger] = useState<SalvageRecord[]>([]);
  const [isFetchingObjects, setIsFetchingObjects] = useState(false);

  // 1. Query StreamCreated events for Total Locked
  const { data: createdEvents, isLoading: isCreatedLoading } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCreated` },
      order: 'descending',
    }
  );

  // 2. Query StreamCanceled events for Corporate Salvage
  const { data: canceledEvents, isLoading: isCanceledLoading } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCanceled` },
      order: 'descending',
    }
  );

  useEffect(() => {
    let activeSpot = 1.42;
    // Fetch live SUI/USD price from Pyth Hermes REST API
    fetch(`${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${PYTH_SUI_USD_FEED_ID}`)
      .then(r => r.json())
      .then(json => {
        const parsed = json?.parsed?.[0]?.price;
        if (parsed) activeSpot = parseFloat(parsed.price) * Math.pow(10, parsed.expo);
      })
      .catch(() => {});

    if (currentAccount && canceledEvents) {
      // Process Corporate Salvage
      const userCanceled = canceledEvents.data.filter(event => {
        const payload = event.parsedJson as any;
        return payload?.sender === currentAccount.address;
      });

      let salvagedSum = 0;
      const ledger: SalvageRecord[] = [];
      userCanceled.forEach(event => {
        const data = event.parsedJson as any;
        const refund = Number(data.sender_refunded_sui) / 1e9;
        salvagedSum += refund;
        ledger.push({
          id: event.id.txDigest,
          returned: refund,
          date: Number(event.timestampMs),
          recipient: data.receiver
        });
      });
      setTotalSalvaged(salvagedSum);
      setSalvageLedger(ledger);
    }

    if (currentAccount && createdEvents) {
      const outboundEvents = createdEvents.data.filter(event => {
        const payload = event.parsedJson as any;
        return payload?.sender === currentAccount.address;
      });

      const streamIds = outboundEvents.map(e => (e.parsedJson as any).stream_id);
      if (streamIds.length > 0) {
        setIsFetchingObjects(true);
        suiClient.multiGetObjects({
          ids: streamIds,
          options: { showContent: true }
        }).then(res => {
          let lockedSum = 0;
          res.forEach(obj => {
            if (obj.data?.content?.dataType === 'moveObject') {
              const fields = obj.data.content.fields as any;
              lockedSum += Number(fields.total_amount) / 1e9;
            }
          });
          setTotalLocked(lockedSum);
          setUsdcPortfolio(lockedSum * activeSpot);
          setHedgingPremium(lockedSum * 0.01 * activeSpot);
          setIsFetchingObjects(false);
        }).catch(() => setIsFetchingObjects(false));
      } else {
        setTotalLocked(0);
        setUsdcPortfolio(0);
        setHedgingPremium(0);
      }
    }
  }, [createdEvents, canceledEvents, currentAccount, suiClient]);

  const isLoading = isCreatedLoading || isCanceledLoading || isFetchingObjects;

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">Treasury Management</h1>
        <p className="text-[#8a8690] text-sm">Overview of your corporate assets, outbound commitments, and macro upside capture.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <Wallet size={16} strokeWidth={1.5} />
            </div>
            <h3 className="text-[11px] uppercase tracking-widest font-medium text-[#8a8690]">Total Locked</h3>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df] tracking-tight">
            {isLoading ? "..." : totalLocked.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm text-[#8a8690]">SUI</span>
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <PieChart size={16} strokeWidth={1.5} />
            </div>
            <h3 className="text-[11px] uppercase tracking-widest font-medium text-[#8a8690]">USDC Value</h3>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df] tracking-tight">
            ${isLoading ? "..." : usdcPortfolio.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <Coins size={16} strokeWidth={1.5} />
            </div>
            <h3 className="text-[11px] uppercase tracking-widest font-medium text-[#8a8690]">Hedging Premium</h3>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df] tracking-tight">
            ${isLoading ? "..." : hedgingPremium.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#FF8B5E]">
              <Briefcase size={16} strokeWidth={1.5} />
            </div>
            <h3 className="text-[11px] uppercase tracking-widest font-medium text-[#FF8B5E]">Corporate Salvage</h3>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df] tracking-tight relative z-10">
            {isLoading ? "..." : totalSalvaged.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm text-[#8a8690]">SUI</span>
          </div>
        </div>
      </div>

      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)]">
        
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <Briefcase className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Corporate Salvage Ledger</h2>
        </div>

        <p className="text-[13px] text-[#8a8690] mb-8 relative z-10 leading-relaxed max-w-2xl">
          When an outbound stream is cancelled early, the unstreamed SUI and the underlying DeepBook BalanceManager are returned to the corporate treasury.
        </p>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690] relative z-10">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying Treasury History</p>
          </div>
        ) : salvageLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50 relative z-10">
            <Clock className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Salvaged Streams</p>
            <p className="text-[#8a8690] text-xs">You have not cancelled any outbound streams yet.</p>
          </div>
        ) : (
          <div className="space-y-3 relative z-10">
            {salvageLedger.map((record) => {
              const dateObj = new Date(record.date);
              const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={record.id} className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#141418] hover:scale-[1.005] transition-all duration-500 ease-out">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      <ArrowUpRight size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[#e8e4df] text-sm font-medium">Stream Salvaged</span>
                        <span className="bg-[#141418] border border-white/5 text-[#8a8690] text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Settled
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8690]/70 font-mono tracking-wider">
                        Original Recipient: {record.recipient.substring(0,6)}...{record.recipient.slice(-4)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end w-full sm:w-auto">
                    <div className="text-[#e8e4df] font-mono font-medium mb-1.5 flex items-center gap-2">
                      +{record.returned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[#8a8690] text-xs">SUI</span>
                    </div>
                    <div className="text-[11px] text-[#8a8690]">
                      {dateStr}
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
