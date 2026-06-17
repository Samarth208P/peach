"use client";

import { useEffect, useState } from "react";
import TickingStreamRow from "@/components/TickingStreamRow";
import { Activity, Clock } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  PEACH_PACKAGE_ID,
} from "@/lib/constants";

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
  isHedged: boolean;
}

export default function StreamsPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [activeStreams, setActiveStreams] = useState<StreamConfig[]>([]);
  const [isFetchingObjects, setIsFetchingObjects] = useState(false);

  const { data: createdEvents, isLoading: isEventsLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCreated` },
      order: "descending",
    }
  );

  // Also fetch HedgeTriggered events to show hedge status
  const { data: hedgeEvents } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::HedgeTriggered` },
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

    // Build set of stream IDs that have been hedged
    const hedgedIds = new Set(
      (hedgeEvents?.data ?? []).map((e) => (e.parsedJson as any).stream_id)
    );

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
            if (
              fields.sender === currentAccount.address &&
              fields.receiver !== currentAccount.address
            )
              type = "outbound";
            else if (
              fields.receiver === currentAccount.address &&
              fields.sender !== currentAccount.address
            )
              type = "inbound";

            const streamId = fields.id.id;

            active.push({
              id: streamId,
              type,
              targetValue: Number(fields.total_amount) / 1e9,
              durationSeconds: duration,
              elapsedSeconds: elapsed,
              startTimeMs: startTime,
              endTimeMs: endTime,
              sender: fields.sender,
              receiver: fields.receiver,
              strikePrice: Number(fields.strike_price) / 100_000_000, // 8-dp → USD
              isHedged: hedgedIds.has(streamId) || fields.is_fully_hedged === true,
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
  }, [createdEvents, hedgeEvents, currentAccount, suiClient]);

  const isLoading = isEventsLoading || isFetchingObjects;

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">
          Active Streams
        </h1>
        <p className="text-[#8a8690] text-sm">
          Real-time payment streams protected by Pyth oracle and DeepBook V3 auto-hedge.
        </p>
      </div>

      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)]">
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <Activity className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">
            Live Infrastructure
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-widest">
              Pyth + DeepBook V3
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690] relative z-10">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying Immutable Log</p>
          </div>
        ) : activeStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50 relative z-10">
            <Clock className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Active Streams</p>
            <p className="text-[#8a8690] text-xs">
              Create a stream to start streaming protected payroll.
            </p>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            {activeStreams.map((stream) => (
              <TickingStreamRow key={stream.id} config={stream} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
