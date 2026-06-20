"use client";

import React, { useMemo } from "react";
import { Terminal, ExternalLink, ShieldAlert, CheckCircle2, ArrowRightLeft, ShieldOff, Play, Check } from "lucide-react";
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { PEACH_PACKAGE_ID } from "@/lib/constants";

interface StreamActivityLogsProps {
  config: {
    id: string;
    startTimeMs: number;
    endTimeMs: number;
    targetValue: number;
  };
}

export default function StreamActivityLogs({ config }: StreamActivityLogsProps) {
  const { data, isPending } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventModule: { package: PEACH_PACKAGE_ID, module: "peach_stream" } },
      order: 'descending',
      limit: 100 // Fetch a chunk to filter locally
    },
    { refetchInterval: 5000 }
  );

  const allEvents = useMemo(() => {
    const events: any[] = [];
    const now = Date.now();

    if (data?.data) {
      data.data.forEach(e => {
        const parsed = e.parsedJson as any;
        if (parsed?.stream_id === config.id) {
          events.push({
            id: e.id.txDigest + e.id.eventSeq,
            type: e.type,
            timestampMs: Number(e.timestampMs),
            parsedJson: parsed,
            txDigest: e.id.txDigest,
            isSynthetic: false
          });
        }
      });
    }

    if (now >= config.startTimeMs) {
      events.push({
        id: `synthetic-start-${config.id}`,
        type: 'SyntheticStreamStarted',
        timestampMs: config.startTimeMs,
        parsedJson: {},
        isSynthetic: true
      });
    }

    if (now >= config.endTimeMs) {
      events.push({
        id: `synthetic-end-${config.id}`,
        type: 'SyntheticStreamEnded',
        timestampMs: config.endTimeMs,
        parsedJson: {},
        isSynthetic: true
      });
    }

    return events.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [data, config]);

  const renderEventDetails = (type: string, parsedJson: any) => {
    if (type === "SyntheticStreamStarted") {
      return {
        icon: <Play size={14} className="text-[#e8e4df]" />,
        title: "Streaming Started",
        desc: `Tokens began streaming to receiver.`,
        color: "text-[#e8e4df]"
      };
    }
    if (type === "SyntheticStreamEnded") {
      return {
        icon: <Check size={14} className="text-[#8a8690]" />,
        title: "Streaming Ended",
        desc: `Stream duration completed.`,
        color: "text-[#8a8690]"
      };
    }
    if (type.includes("StreamCreated")) {
      return {
        icon: <CheckCircle2 size={14} className="text-emerald-400" />,
        title: "Stream Initialized",
        desc: `${(parsedJson.total_amount / 1e9).toFixed(2)} SUI locked in escrow.`,
        color: "text-emerald-400"
      };
    }
    if (type.includes("StreamClaimed")) {
      return {
        icon: <ArrowRightLeft size={14} className="text-blue-400" />,
        title: "Claim Executed",
        desc: `${(parsedJson.sui_claimed / 1e9).toFixed(4)} SUI / ${(parsedJson.usdc_claimed / 1e6).toFixed(2)} USDC`,
        color: "text-blue-400"
      };
    }
    if (type.includes("GlobalHedgeInitiated") || type.includes("HedgeTriggered")) {
      return {
        icon: <ShieldAlert size={14} className="text-[#FF8B5E]" />,
        title: "Market Breach Detected",
        desc: `Hedge triggered at $${(parsedJson.trigger_price || parsedJson.spot_price) / 1e8}`,
        color: "text-[#FF8B5E]"
      };
    }
    if (type.includes("TWAPTrancheExecuted")) {
      return {
        icon: <ShieldAlert size={14} className="text-yellow-400" />,
        title: `TWAP Tranche ${parsedJson.tranche_number}`,
        desc: `Swapped ${(parsedJson.sui_swapped / 1e9).toFixed(2)} SUI → ${(parsedJson.usdc_received / 1e6).toFixed(2)} USDC`,
        color: "text-yellow-400"
      };
    }
    if (type.includes("StreamCanceled")) {
      return {
        icon: <ShieldOff size={14} className="text-red-400" />,
        title: "Stream Canceled",
        desc: `Funds returned to treasury and receiver.`,
        color: "text-red-400"
      };
    }
    if (type.includes("StreamCompleted")) {
      return {
        icon: <CheckCircle2 size={14} className="text-emerald-500" />,
        title: "Stream Completed",
        desc: `100% of tokens successfully claimed.`,
        color: "text-emerald-500"
      };
    }
    if (type.includes("HedgeDebtAccumulated")) {
      return {
        icon: <ShieldAlert size={14} className="text-purple-400" />,
        title: "Hedge Debt Buffered",
        desc: `Accumulated ${(parsedJson.amount_buffered / 1e9).toFixed(4)} SUI in debt.`,
        color: "text-purple-400"
      };
    }
    return {
      icon: <Terminal size={14} className="text-[#8a8690]" />,
      title: "Unknown Event",
      desc: JSON.stringify(parsedJson).substring(0, 30) + "...",
      color: "text-[#8a8690]"
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-surface-1/60 rounded-2xl border border-white/5 p-5 min-h-0">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Terminal size={16} className="text-[#8a8690]" />
        <h3 className="text-[#e8e4df] font-medium text-sm font-mono tracking-tight uppercase">Activity Logs</h3>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {isPending ? (
          <div className="flex items-center justify-center py-8 text-[#8a8690] text-sm font-mono animate-pulse">
            Syncing on-chain activity...
          </div>
        ) : allEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[#5a5660] text-xs font-mono">
            No activity recorded yet.
          </div>
        ) : (
          allEvents.map((event) => {
            const parsedJson = event.parsedJson as any;
            const timestamp = new Date(Number(event.timestampMs)).toLocaleTimeString([], { hour12: false });
            const txHash = event.txDigest ? `${event.txDigest.substring(0, 6)}...${event.txDigest.substring(event.txDigest.length - 4)}` : null;
            const explorerLink = event.txDigest ? `https://testnet.suivision.xyz/txblock/${event.txDigest}` : null;
            const details = renderEventDetails(event.type, parsedJson);

            return (
              <div 
                key={event.id} 
                className="flex flex-col gap-1 p-3 rounded-xl bg-[#141418] border border-white/[0.03] hover:border-white/[0.08] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {details.icon}
                    <span className={`text-xs font-mono font-medium ${details.color}`}>{details.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#5a5660] font-mono">{timestamp}</span>
                    {txHash && (
                      <a 
                        href={explorerLink!} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] flex items-center gap-1 text-[#8a8690] hover:text-[#e8e4df] transition-colors"
                      >
                        {txHash} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-[#8a8690] font-mono pl-6">
                  {details.desc}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
