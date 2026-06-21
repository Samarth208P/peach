"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TickingStreamRow from "@/components/TickingStreamRow";
import { Activity, Clock, Plus } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PEACH_PACKAGE_ID, PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

interface StreamConfig {
  id: string;
  type: "inbound" | "outbound" | "self";
  targetValue: number;
  durationSeconds: number;
  elapsedSeconds: number;
  startTimeMs: number;
  endTimeMs: number;
  sender: string;
  receiver: string;
  strikePrice: number;
  hedgeDirection: number;
  hedgeTriggered: boolean;
  withdrawn: number;
}

export default function StreamsPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [activeStreams, setActiveStreams] = useState<StreamConfig[]>([]);
  const [isFetchingObjects, setIsFetchingObjects] = useState(false);
  const [pythSpotPrice, setPythSpotPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!PYTH_SUI_USD_FEED_ID) return;
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
        /* ignore */
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

  useEffect(() => {
    if (!createdEvents || !currentAccount) return;

    const userEvents = createdEvents.data.filter((event) => {
      const payload = event.parsedJson as any;
      return (
        payload?.sender === currentAccount.address ||
        payload?.receiver === currentAccount.address
      );
    });

    const streamIds = userEvents.map((e) => (e.parsedJson as any).stream_id);

    if (streamIds.length === 0) {
      setActiveStreams([]);
      return;
    }

    setIsFetchingObjects(true);
    suiClient
      .multiGetObjects({ ids: streamIds, options: { showContent: true } })
      .then((res) => {
        const active: StreamConfig[] = [];
        res.forEach((obj) => {
          if (obj.data?.content?.dataType === "moveObject") {
            const fields = obj.data.content.fields as any;
            const now = Date.now();
            const startTime = Number(fields.start_time);
            const endTime = Number(fields.end_time);
            const duration = (endTime - startTime) / 1000;
            const elapsed = Math.max(0, Math.min(now - startTime, endTime - startTime)) / 1000;

            let type: "inbound" | "outbound" | "self" = "self";
            if (fields.sender === currentAccount.address && fields.receiver !== currentAccount.address)
              type = "outbound";
            else if (fields.receiver === currentAccount.address && fields.sender !== currentAccount.address)
              type = "inbound";

            const targetValue = Number(fields.total_amount) / 1e9;
            const withdrawn = Number(fields.withdrawn) / 1e9;

            active.push({
              id: fields.id.id,
              type,
              targetValue,
              durationSeconds: duration,
              elapsedSeconds: elapsed,
              startTimeMs: startTime,
              endTimeMs: endTime,
              sender: fields.sender,
              receiver: fields.receiver,
              strikePrice: Number(fields.strike_price) / 1e8,
              hedgeDirection: Number(fields.hedge_direction),
              hedgeTriggered: fields.hedge_triggered === true,
              withdrawn,
            });
          }
        });
        setActiveStreams(active);
        setIsFetchingObjects(false);
      })
      .catch((err) => {
        console.error("Failed to fetch stream objects:", err);
        setIsFetchingObjects(false);
      });
  }, [createdEvents, currentAccount, suiClient]);

  const isLoading = isEventsLoading || isFetchingObjects;
  
  const actuallyActiveCount = activeStreams.filter(s => s.withdrawn < s.targetValue - 0.0001).length;

  return (
    <div className="flex flex-col gap-8 font-sans w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl text-[#e8e4df] font-display font-medium tracking-tight mb-2">
            Active Streams
          </h1>
          <p className="text-[#8a8690] text-sm">
            Real-time payment streams with autonomous hedging via Pyth + DeepBook V3.
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

      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity size={16} className="text-[#8a8690]" />
            <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
              Live Streams
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-widest">
              {actuallyActiveCount} active
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-3" />
            <p className="text-xs tracking-wider uppercase">Loading streams</p>
          </div>
        ) : activeStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Clock size={20} className="text-[#8a8690] mb-3 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Active Streams</p>
            <p className="text-[#8a8690] text-xs">
              Create a stream to start streaming protected payments.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeStreams.map((stream) => (
              <TickingStreamRow key={stream.id} config={stream} pythSpotPrice={pythSpotPrice || 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
