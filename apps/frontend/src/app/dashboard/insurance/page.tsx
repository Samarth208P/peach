"use client";

import { useEffect, useState, useMemo } from "react";
import { Shield, TrendingDown, Lock, Zap, Activity } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PEACH_PACKAGE_ID, PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

interface HedgeEvent {
  streamId: string;
  spotPrice: number;    // USD (8-dp scaled → human)
  strikePrice: number;  // USD
  suiSwapped: number;   // SUI
  timestamp: number;
}

interface StreamProtection {
  id: string;
  volume: number;
  strikePrice: number;
  endTime: number;
  isHedged: boolean;
}

export default function InsurancePage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [activeProtections, setActiveProtections] = useState<StreamProtection[]>([]);
  const [protectedVolume, setProtectedVolume] = useState(0);
  const [pythSpotPrice, setPythSpotPrice] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch live Pyth SUI/USD price via Hermes REST
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${PYTH_SUI_USD_FEED_ID}`
        );
        const json = await res.json();
        const parsed = json?.parsed?.[0]?.price;
        if (parsed) {
          const price = parseFloat(parsed.price) * Math.pow(10, parsed.expo);
          setPythSpotPrice(price);
        }
      } catch {
        setPythSpotPrice(null);
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

  // Derive hedgeEvents from query data — no separate state needed
  const hedgeEvents = useMemo<HedgeEvent[]>(() => {
    if (!hedgeEventData?.data) return [];
    return hedgeEventData.data.map((e) => {
      const d = e.parsedJson as any;
      return {
        streamId: d.stream_id,
        spotPrice: Number(d.spot_price) / 100_000_000,
        strikePrice: Number(d.strike_price) / 100_000_000,
        suiSwapped: Number(d.sui_swapped) / 1e9,
        timestamp: Number(e.timestampMs),
      };
    });
  }, [hedgeEventData]);

  useEffect(() => {
    if (!createdEvents || !currentAccount) return;

    // Only outbound streams (user is sender)
    const outboundEvents = createdEvents.data.filter((event) => {
      const payload = event.parsedJson as any;
      return payload?.sender === currentAccount.address;
    });

    const streamIds = outboundEvents.map((e) => (e.parsedJson as any).stream_id);
    if (streamIds.length === 0) {
      setActiveProtections([]);
      return;
    }

    const hedgedIds = new Set(hedgeEvents.map((h) => h.streamId));

    setIsFetching(true);
    suiClient
      .multiGetObjects({ ids: streamIds, options: { showContent: true } })
      .then((res) => {
        let totalVol = 0;
        const protections: StreamProtection[] = [];
        res.forEach((obj) => {
          if (obj.data?.content?.dataType === "moveObject") {
            const fields = obj.data.content.fields as any;
            const sp = Number(fields.strike_price);
            if (sp === 0) return; // unprotected stream

            const vol = Number(fields.total_amount) / 1e9;
            totalVol += vol;
            protections.push({
              id: fields.id.id,
              volume: vol,
              strikePrice: sp / 100_000_000,
              endTime: Number(fields.end_time),
              isHedged: hedgedIds.has(fields.id.id) || fields.is_fully_hedged === true,
            });
          }
        });
        setProtectedVolume(totalVol);
        setActiveProtections(protections);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, [createdEvents, currentAccount, suiClient, hedgeEvents]);

  const isLoading = isEventsLoading || isHedgeLoading || isFetching;
  const spotDisplay = pythSpotPrice !== null ? `$${pythSpotPrice.toFixed(3)}` : "Loading...";

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">
          Active Protection
        </h1>
        <p className="text-[#8a8690] text-sm">
          Live Pyth oracle feeds + automated DeepBook V3 hedge triggers. No options. Real swaps.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <Lock size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#e8e4df]">Protected Volume</h3>
          </div>
          <div className="text-3xl font-display font-medium text-[#e8e4df] tracking-tight mb-2">
            {isLoading ? "..." : protectedVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
            <span className="text-lg text-[#8a8690]">SUI</span>
          </div>
          <div className="text-[11px] text-[#8a8690] flex items-center gap-1 font-medium tracking-wider uppercase">
            Pyth-gated hedge floor
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <TrendingDown size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#e8e4df]">Pyth Live Spot</h3>
          </div>
          <div className="text-3xl font-display font-medium text-[#e8e4df] tracking-tight mb-2">
            {spotDisplay}{" "}
            <span className="text-lg text-[#8a8690]">/ SUI</span>
          </div>
          <div className="text-[11px] text-[#8a8690] flex items-center gap-1 font-medium tracking-wider uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live via Hermes API
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <Zap size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#e8e4df]">Auto-Hedges Fired</h3>
          </div>
          <div className="text-3xl font-display font-medium text-[#e8e4df] tracking-tight mb-2">
            {isLoading ? "..." : hedgeEvents.length}
          </div>
          <div className="text-[11px] text-[#8a8690] flex items-center gap-1 font-medium tracking-wider uppercase">
            DeepBook V3 spot swaps
          </div>
        </div>
      </div>

      {/* Active protections */}
      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 mb-8">
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <Shield className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
            Protected Streams
          </h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying On-Chain State</p>
          </div>
        ) : activeProtections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Shield className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Protected Streams</p>
            <p className="text-[#8a8690] text-xs">
              Create a stream with a strike price to enable Pyth hedge protection.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeProtections.map((p) => {
              const now = Date.now();
              const daysLeft = Math.max(0, Math.ceil((p.endTime - now) / (1000 * 60 * 60 * 24)));
              const spotNum = pythSpotPrice ?? 0;
              let statusColor = "bg-green-500/10 text-green-400";
              let statusLabel = "✓ Protected";
              
              if (p.isHedged) {
                statusColor = "bg-green-500/10 text-green-400";
                statusLabel = "✓ Hedging Completed";
              } else if (spotNum > 0 && spotNum < p.strikePrice) {
                statusColor = "bg-[#FD8566]/15 text-[#FD8566]";
                statusLabel = "Hedging Active";
              }

              return (
                <div
                  key={p.id}
                  className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#141418] transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      <Shield size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[#e8e4df] text-sm font-medium">
                          Pyth-Gated Stream
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8690]/70 font-mono tracking-wider">
                        ID: {p.id.substring(0, 10)}...
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-right w-full sm:w-auto">
                    <div>
                      <div className="text-[10px] text-[#8a8690] mb-1.5 uppercase tracking-widest font-medium">Volume</div>
                      <div className="text-sm text-[#e8e4df] font-mono">{p.volume.toFixed(2)} SUI</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8a8690] mb-1.5 uppercase tracking-widest font-medium">Strike</div>
                      <div className="text-sm text-[#e8e4df] font-mono">${p.strikePrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8a8690] mb-1.5 uppercase tracking-widest font-medium">Expires</div>
                      <div className="text-sm text-[#e8e4df] font-mono">{daysLeft}d</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hedge fire log */}
      {hedgeEvents.length > 0 && (
        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-[#FD8566]/10 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-4 h-4 text-[#FD8566]" />
            <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
              Auto-Hedge Fire Log
            </h2>
          </div>
          <div className="space-y-3">
            {hedgeEvents.slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div>
                  <div className="text-xs text-[#e8e4df] font-medium mb-1">
                    DeepBook Spot Swap Executed
                  </div>
                  <div className="text-[10px] text-[#8a8690] font-mono">
                    Stream: {h.streamId.slice(0, 10)}... — Spot ${h.spotPrice.toFixed(3)} vs Strike ${h.strikePrice.toFixed(3)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#FD8566] font-mono font-medium">{h.suiSwapped.toFixed(4)} SUI → USDC</div>
                  <div className="text-[10px] text-[#8a8690]">
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
