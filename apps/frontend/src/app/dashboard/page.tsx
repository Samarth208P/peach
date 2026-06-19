"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentAccount, useSuiClientQuery, useSuiClient } from "@mysten/dapp-kit";
import {
  Plus,
  Activity,
  Shield,
  TrendingDown,
  Zap,
  ArrowRight,
  Clock,
  Wallet,
} from "lucide-react";


import { PEACH_PACKAGE_ID, PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

interface StreamSummary {
  id: string;
  sender: string;
  receiver: string;
  totalAmount: number;
  startTime: number;
  endTime: number;
  strikePrice: number;
  hedgeDirection: number;
  hedgeTriggered: boolean;
  accumulatedDebt: number;
  totalHedged: number;
  remaining: number;
}

export default function DashboardPage() {
  const currentAccount = useCurrentAccount();
  const router = useRouter();
  const suiClient = useSuiClient();

  const [streams, setStreams] = useState<StreamSummary[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [assetPrices, setAssetPrices] = useState<Record<string, number>>({});

  // Fetch prices once
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // SUI/USD is the primary feed; other commodities use separate queries
        const suiFeedId = "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";
        const res = await fetch(
          `${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${suiFeedId}&parsed=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json?.parsed) {
          const prices: Record<string, number> = {};
          json.parsed.forEach((p: any) => {
            if (p?.price) {
              const price = parseFloat(p.price.price) * Math.pow(10, p.price.expo);
              if (p.id === suiFeedId) prices.SUI = price;
            }
          });
          setAssetPrices(prices);
        }
      } catch (err) {
        console.error("Price fetch error:", err);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, []);

  // Query StreamCreated events
  const { data: createdEvents } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCreated` },
      order: "descending",
    },
    { enabled: !!currentAccount, refetchInterval: 8000 }
  );

  // Query HedgeTriggered events
  const { data: hedgeEvents } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::HedgeTriggered` },
      order: "descending",
    },
    { enabled: !!currentAccount, refetchInterval: 10000 }
  );

  // Query HedgeDebtAccumulated events
  const { data: debtEvents } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::HedgeDebtAccumulated` },
      order: "descending",
    },
    { enabled: !!currentAccount, refetchInterval: 10000 }
  );

  // Hydrate stream objects from on-chain
  useEffect(() => {
    if (!createdEvents?.data || !currentAccount) {
      setIsHydrating(false);
      return;
    }

    const userEvents = createdEvents.data.filter((e) => {
      const p = e.parsedJson as any;
      return p?.sender === currentAccount.address || p?.receiver === currentAccount.address;
    });

    const streamIds = userEvents.map((e) => (e.parsedJson as any).stream_id);
    if (streamIds.length === 0) {
      setStreams([]);
      setIsHydrating(false);
      return;
    }

    setIsHydrating(true);
    suiClient
      .multiGetObjects({ ids: streamIds, options: { showContent: true } })
      .then((res) => {
        const hydrated: StreamSummary[] = [];
        res.forEach((obj) => {
          if (obj.data?.content?.dataType === "moveObject") {
            const f = obj.data.content.fields as any;
            hydrated.push({
              id: f.id.id,
              sender: f.sender,
              receiver: f.receiver,
              totalAmount: Number(f.total_amount) / 1e9,
              startTime: Number(f.start_time),
              endTime: Number(f.end_time),
              strikePrice: Number(f.strike_price) / 1e8,
              hedgeDirection: Number(f.hedge_direction),
              hedgeTriggered: f.hedge_triggered === true,
              accumulatedDebt: Number(f.accumulated_hedge_debt) / 1e9,
              totalHedged: Number(f.total_hedged_amount) / 1e9,
              remaining: Number(f.balance) / 1e9,
            });
          }
        });
        setStreams(hydrated);
      })
      .catch(console.error)
      .finally(() => setIsHydrating(false));
  }, [createdEvents, currentAccount, suiClient]);

  // Computed metrics
  const totalVolume = streams.reduce((a, s) => a + s.totalAmount, 0);
  const activeCount = streams.length;
  const protectedCount = streams.filter((s) => s.hedgeDirection !== 2).length;
  const hedgeFiredCount = hedgeEvents?.data?.length ?? 0;
  const totalHedgedSui = useMemo(() => {
    if (!hedgeEvents?.data) return 0;
    return hedgeEvents.data.reduce((acc, e) => {
      const d = e.parsedJson as any;
      return acc + Number(d.sui_swapped || 0) / 1e9;
    }, 0);
  }, [hedgeEvents]);
  const totalAccumulatedDebt = streams.reduce((a, s) => a + s.accumulatedDebt, 0);
  const outboundCount = streams.filter((s) => s.sender === currentAccount?.address).length;
  const inboundCount = streams.filter((s) => s.receiver === currentAccount?.address).length;

  const hedgeDirectionLabel = (d: number) => {
    if (d === 0) return "Floor";
    if (d === 1) return "Ceiling";
    return "None";
  };

  return (
    <div className="flex flex-col gap-8 font-sans w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-[#e8e4df] font-display font-medium tracking-tight mb-1">
            Dashboard
          </h1>
          <p className="text-[#8a8690] text-sm">
            Self-hedging payment streams — live protocol overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/create"
            className="flex items-center gap-2 bg-[#FF8B5E] text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#FFB088] transition-colors duration-300"
          >
            <Plus size={14} strokeWidth={2.5} /> New Stream
          </Link>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Wallet size={16} strokeWidth={1.5} />}
          label="Total Volume"
          value={`${totalVolume.toFixed(2)} SUI`}
          sub={assetPrices.SUI ? `$${(totalVolume * assetPrices.SUI).toFixed(2)} USD` : undefined}
        />
        <MetricCard
          icon={<Activity size={16} strokeWidth={1.5} />}
          label="Active Streams"
          value={`${activeCount}`}
          sub={`${outboundCount} out / ${inboundCount} in`}
        />
        <MetricCard
          icon={<Shield size={16} strokeWidth={1.5} />}
          label="Protected"
          value={`${protectedCount}`}
          sub={totalAccumulatedDebt > 0 ? `${totalAccumulatedDebt.toFixed(4)} SUI buffered` : "All clear"}
          accent={protectedCount > 0}
        />
        <MetricCard
          icon={<Zap size={16} strokeWidth={1.5} />}
          label="Hedges Fired"
          value={`${hedgeFiredCount}`}
          sub={totalHedgedSui > 0 ? `${totalHedgedSui.toFixed(2)} SUI swapped` : "No hedges yet"}
        />
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Prices */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={16} className="text-[#8a8690]" />
              <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Market Prices</h2>
            </div>
            <div className="flex flex-col gap-5">
              <PriceRow name="SUI" symbol="SUI/USD" price={assetPrices.SUI} />
            </div>
          </div>
        </div>

        {/* Right: Streams */}
        <div className="lg:col-span-2">
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity size={16} className="text-[#8a8690]" />
            <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
              Recent Streams
            </h2>
          </div>
          <Link
            href="/dashboard/streams"
            className="flex items-center gap-1 text-xs text-[#8a8690] hover:text-[#FF8B5E] transition-colors"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {isHydrating ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-3" />
            <p className="text-xs uppercase tracking-wider">Loading streams</p>
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Clock size={20} className="text-[#8a8690] mb-3 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No streams yet</p>
            <p className="text-[#8a8690] text-xs mb-4">
              Deploy your first self-hedging payment stream.
            </p>
            <Link
              href="/dashboard/create"
              className="flex items-center gap-2 bg-[#FF8B5E] text-black px-4 py-2 rounded-xl text-xs font-medium hover:bg-[#FFB088] transition-colors"
            >
              <Plus size={12} /> Create Stream
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {streams.slice(0, 5).map((stream) => {
              const now = Date.now();
              const progress = Math.min(
                100,
                Math.max(0, ((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100)
              );
              const isInbound = stream.receiver === currentAccount?.address;
              const dirLabel = hedgeDirectionLabel(stream.hedgeDirection);

              return (
                <div
                  key={stream.id}
                  className="flex items-center gap-4 p-4 bg-[#060608] border border-white/5 rounded-2xl hover:bg-[#141418] transition-colors duration-300"
                >
                  {/* Direction indicator */}
                  <div className={`p-2 rounded-xl border ${isInbound ? "bg-green-500/5 border-green-500/10" : "bg-[#0d0d10] border-white/5"}`}>
                    {isInbound ? (
                      <TrendingDown size={16} className="text-green-400" />
                    ) : (
                      <Activity size={16} className="text-[#8a8690]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-[#e8e4df] font-medium">
                        {stream.totalAmount.toFixed(2)} SUI
                      </span>
                      {stream.hedgeDirection !== 2 && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-[#FF8B5E]/10 text-[#FF8B5E] border border-[#FF8B5E]/20">
                          {dirLabel} ${stream.strikePrice.toFixed(2)}
                        </span>
                      )}
                      {stream.hedgeTriggered && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-green-500/10 text-green-400">
                          Hedged
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#8a8690] font-mono truncate">
                      {stream.sender.slice(0, 6)}...{stream.sender.slice(-4)} → {stream.receiver.slice(0, 6)}...{stream.receiver.slice(-4)}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-[#8a8690] font-mono">{progress.toFixed(0)}%</span>
                    <div className="w-20 h-1 bg-[#141418] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FF8B5E] rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}

// ─── Price Row Component ─────────────────────────────────────────────────────

function PriceRow({ name, symbol, price }: { name: string; symbol: string; price?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-sm text-[#e8e4df] font-medium">{name}</span>
        <span className="text-[10px] text-[#8a8690] font-mono">{symbol}</span>
      </div>
      <div className="text-sm font-mono text-[#e8e4df]">
        {price !== undefined ? `$${price.toFixed(4)}` : "..."}
      </div>
    </div>
  );
}

// ─── Metric Card Component ───────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 hover:bg-[#141418]/60 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg border ${accent ? "bg-[#FF8B5E]/10 border-[#FF8B5E]/20 text-[#FF8B5E]" : "bg-[#060608] border-white/5 text-[#8a8690]"}`}>
          {icon}
        </div>
        <span className="text-[11px] text-[#8a8690] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-display font-medium text-[#e8e4df] tracking-tight mb-1">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-[#8a8690] font-mono">{sub}</div>
      )}
    </div>
  );
}
