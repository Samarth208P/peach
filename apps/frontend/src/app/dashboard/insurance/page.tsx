"use client";

import { useEffect, useState, useMemo } from "react";
import { Shield, TrendingDown, TrendingUp, Lock, Zap, Activity } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PEACH_PACKAGE_ID, PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

interface HedgeEvent {
  streamId: string;
  spotPrice: number;
  strikePrice: number;
  suiSwapped: number;
  hedgeDirection: number;
  accumulatedDebtCleared: number;
  timestamp: number;
}

interface StreamProtection {
  id: string;
  volume: number;
  strikePrice: number;
  hedgeDirection: number;
  endTime: number;
  hedgeTriggered: boolean;
  accumulatedDebt: number;
}

export default function InsurancePage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [activeProtections, setActiveProtections] = useState<StreamProtection[]>([]);
  const [protectedVolume, setProtectedVolume] = useState(0);
  const [pythSpotPrice, setPythSpotPrice] = useState<number | null>(null);
  const [isPythLoading, setIsPythLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Live Pyth SUI/USD price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${PYTH_SUI_USD_FEED_ID}`
        );
        const json = await res.json();
        const parsed = json?.parsed?.[0]?.price;
        if (parsed) {
          setPythSpotPrice(parseFloat(parsed.price) * Math.pow(10, parsed.expo));
        }
      } catch {
        setPythSpotPrice(null);
      } finally {
        setIsPythLoading(false);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 10_000);
    return () => clearInterval(interval);
  }, []);

  const { data: createdEvents, isLoading: isEventsLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCreated` },
      order: "descending",
    }
  );

  const { data: hedgeEventData, isLoading: isHedgeLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::HedgeTriggered` },
      order: "descending",
    }
  );

  // Parse hedge events with new fields
  const hedgeEvents = useMemo<HedgeEvent[]>(() => {
    if (!hedgeEventData?.data) return [];
    return hedgeEventData.data.map((e) => {
      const d = e.parsedJson as any;
      return {
        streamId: d.stream_id,
        spotPrice: Number(d.spot_price) / 1e8,
        strikePrice: Number(d.strike_price) / 1e8,
        suiSwapped: Number(d.sui_swapped) / 1e9,
        hedgeDirection: Number(d.hedge_direction),
        accumulatedDebtCleared: Number(d.accumulated_debt_cleared) / 1e9,
        timestamp: Number(e.timestampMs),
      };
    });
  }, [hedgeEventData]);

  // Hydrate protected streams from on-chain objects
  useEffect(() => {
    if (!createdEvents || !currentAccount) return;

    const outboundEvents = createdEvents.data.filter((event) => {
      const payload = event.parsedJson as any;
      return payload?.sender === currentAccount.address;
    });

    const streamIds = outboundEvents.map((e) => (e.parsedJson as any).stream_id);
    if (streamIds.length === 0) {
      setActiveProtections([]);
      return;
    }

    setIsFetching(true);
    suiClient
      .multiGetObjects({ ids: streamIds, options: { showContent: true } })
      .then((res) => {
        let totalVol = 0;
        const protections: StreamProtection[] = [];
        res.forEach((obj) => {
          if (obj.data?.content?.dataType === "moveObject") {
            const fields = obj.data.content.fields as any;
            const hedgeDir = Number(fields.hedge_direction);
            if (hedgeDir === 2) return; // HEDGE_NONE — skip

            const vol = Number(fields.total_amount) / 1e9;
            totalVol += vol;
            protections.push({
              id: fields.id.id,
              volume: vol,
              strikePrice: Number(fields.strike_price) / 1e8,
              hedgeDirection: hedgeDir,
              endTime: Number(fields.end_time),
              hedgeTriggered: fields.hedge_triggered === true,
              accumulatedDebt: Number(fields.accumulated_hedge_debt) / 1e9,
            });
          }
        });
        setProtectedVolume(totalVol);
        setActiveProtections(protections);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, [createdEvents, currentAccount, suiClient]);

  const isLoading = isEventsLoading || isHedgeLoading || isFetching || isPythLoading;
  const spotDisplay = pythSpotPrice !== null ? `$${pythSpotPrice.toFixed(4)}` : "Loading...";
  const totalDebtBuffered = activeProtections.reduce((a, p) => a + p.accumulatedDebt, 0);

  const directionLabel = (d: number) => (d === 0 ? "Floor" : "Ceiling");
  const directionIcon = (d: number) =>
    d === 0 ? <TrendingDown size={16} strokeWidth={1.5} /> : <TrendingUp size={16} strokeWidth={1.5} />;

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-10">
        <h1 className="text-3xl text-[#e8e4df] font-display font-medium tracking-tight mb-2">
          Active Protection
        </h1>
        <p className="text-[#8a8690] text-sm">
          Pyth oracle feeds + DeepBook V3 atomic hedge triggers. Floor and ceiling modes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={14} className="text-[#8a8690]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Protected Volume</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {isLoading ? "..." : protectedVolume.toFixed(2)} <span className="text-sm text-[#8a8690]">SUI</span>
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-[#8a8690]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Pyth Spot</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {spotDisplay}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[9px] text-[#8a8690] uppercase tracking-wider">Live</span>
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-[#8a8690]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Hedges Fired</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {isLoading ? "..." : hedgeEvents.length}
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-[#FF8B5E]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Debt Buffered</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {isLoading ? "..." : totalDebtBuffered.toFixed(4)} <span className="text-sm text-[#8a8690]">SUI</span>
          </div>
          <span className="text-[9px] text-[#8a8690]">Accumulator (sub-lot)</span>
        </div>
      </div>

      {/* Protected Streams */}
      <div className="bg-[#0d0d10]/60 border border-white/5 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield size={16} className="text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Protected Streams</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-3" />
            <p className="text-xs uppercase tracking-wider">Querying on-chain state</p>
          </div>
        ) : activeProtections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Shield size={20} className="text-[#8a8690] mb-3 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Protected Streams</p>
            <p className="text-[#8a8690] text-xs">
              Create a stream with Floor or Ceiling protection to enable auto-hedging.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeProtections.map((p) => {
              const now = Date.now();
              const daysLeft = Math.max(0, Math.ceil((p.endTime - now) / (86_400_000)));
              const spotNum = pythSpotPrice ?? 0;

              let statusColor = "bg-green-500/10 text-green-400";
              let statusLabel = "Protected";

              if (p.hedgeTriggered) {
                statusLabel = "Hedge Executed";
              } else if (p.hedgeDirection === 0 && spotNum > 0 && spotNum < p.strikePrice) {
                statusColor = "bg-[#FF8B5E]/15 text-[#FF8B5E]";
                statusLabel = "Below Strike";
              } else if (p.hedgeDirection === 1 && spotNum > 0 && spotNum > p.strikePrice) {
                statusColor = "bg-[#FF8B5E]/15 text-[#FF8B5E]";
                statusLabel = "Above Strike";
              }

              return (
                <div
                  key={p.id}
                  className="bg-[#060608] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-[#141418] transition-colors duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      {directionIcon(p.hedgeDirection)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-[#e8e4df] font-medium">
                          {directionLabel(p.hedgeDirection)} Protection
                        </span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8a8690] font-mono">
                        ID: {p.id.substring(0, 10)}...
                        {p.accumulatedDebt > 0 && (
                          <span className="ml-2 text-[#FF8B5E]">Buffered: {p.accumulatedDebt.toFixed(4)} SUI</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-5 text-right">
                    <div>
                      <div className="text-[9px] text-[#8a8690] mb-1 uppercase tracking-widest">Volume</div>
                      <div className="text-xs text-[#e8e4df] font-mono">{p.volume.toFixed(2)} SUI</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8a8690] mb-1 uppercase tracking-widest">Strike</div>
                      <div className="text-xs text-[#e8e4df] font-mono">${p.strikePrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8a8690] mb-1 uppercase tracking-widest">Expires</div>
                      <div className="text-xs text-[#e8e4df] font-mono">{daysLeft}d</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hedge Fire Log */}
      <div className="bg-[#0d0d10]/60 border border-[#FF8B5E]/10 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <Zap size={16} className="text-[#FF8B5E]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
            Auto-Hedge Execution Log
          </h2>
        </div>

        {hedgeEvents.length === 0 ? (
          <div className="py-8 text-center text-[#8a8690] text-xs">
            No automated hedges have executed yet.
          </div>
        ) : (
          <div className="space-y-2">
            {hedgeEvents.slice(0, 12).map((h, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#e8e4df] font-medium mb-0.5">
                    <span className={h.hedgeDirection === 0 ? "text-[#FF8B5E]" : "text-blue-400"}>
                      {h.hedgeDirection === 0 ? "Floor" : "Ceiling"}
                    </span>
                    <span>
                      Spot ${h.spotPrice.toFixed(3)} {h.hedgeDirection === 0 ? "<" : ">"} Strike ${h.strikePrice.toFixed(3)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8a8690] font-mono">
                    Stream: {h.streamId.slice(0, 10)}...
                    {h.accumulatedDebtCleared > 0 && (
                      <span className="ml-2">+ {h.accumulatedDebtCleared.toFixed(4)} SUI debt cleared</span>
                    )}
                    <span className="ml-2">{new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-[#FF8B5E] text-sm font-mono font-medium shrink-0">
                  {h.suiSwapped.toFixed(4)} SUI
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
