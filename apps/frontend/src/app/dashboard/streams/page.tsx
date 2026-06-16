"use client";

import { useEffect, useState } from "react";
import TickingStreamRow from "@/components/TickingStreamRow";
import { Activity, Clock } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

const PACKAGE_ID = "0xfeded63bda28be37a34d937fe8dfe8c294596a26f4c9805128812edfd085c025";

interface StreamConfig {
  id: string;
  type: "inbound" | "outbound" | "self";
  targetValue: number;
  durationSeconds: number;
  elapsedSeconds: number;
  sender: string;
  receiver: string;
}

export default function StreamsPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [activeStreams, setActiveStreams] = useState<StreamConfig[]>([]);
  const [isFetchingObjects, setIsFetchingObjects] = useState(false);

  // 1. Query all StreamCreated events globally
  const { data: createdEvents, isLoading: isEventsLoading } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::peach_stream::StreamCreated` },
      order: 'descending',
    }
  );

  useEffect(() => {
    if (!createdEvents || !currentAccount) return;
    
    // 2. Filter events to those involving the current user
    const userEvents = createdEvents.data.filter(event => {
       const payload = event.parsedJson as any;
       return payload?.sender === currentAccount.address || payload?.receiver === currentAccount.address;
    });

    const streamIds = userEvents.map(e => (e.parsedJson as any).stream_id);
    
    if (streamIds.length === 0) {
      setActiveStreams([]);
      return;
    }

    setIsFetchingObjects(true);

    // 3. Query the live Shared Objects to see which streams are still active (not deleted)
    suiClient.multiGetObjects({
      ids: streamIds,
      options: { showContent: true }
    }).then(res => {
       const active: StreamConfig[] = [];
       res.forEach(obj => {
         if (obj.data?.content?.dataType === 'moveObject') {
           const fields = obj.data.content.fields as any;
           
           const now = Date.now();
           const startTime = Number(fields.start_time);
           const endTime = Number(fields.end_time);
           const duration = (endTime - startTime) / 1000;
           const elapsed = Math.max(0, Math.min(now - startTime, endTime - startTime)) / 1000;

           let type = "self";
           if (fields.sender === currentAccount.address && fields.receiver !== currentAccount.address) type = "outbound";
           else if (fields.receiver === currentAccount.address && fields.sender !== currentAccount.address) type = "inbound";

           active.push({
             id: fields.id.id,
             type: type as any,
             targetValue: Number(fields.total_amount) / 1e9,
             durationSeconds: duration,
             elapsedSeconds: elapsed,
             sender: fields.sender,
             receiver: fields.receiver
           });
         }
       });
       setActiveStreams(active);
       setIsFetchingObjects(false);
    }).catch(err => {
      console.error("Failed to fetch stream objects:", err);
      setIsFetchingObjects(false);
    });
  }, [createdEvents, currentAccount, suiClient]);

  const isLoading = isEventsLoading || isFetchingObjects;

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">Active Streams</h1>
        <p className="text-[#8a8690] text-sm">Manage your real-time payment streams and view micro-allocations.</p>
      </div>

      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)]">
        
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <Activity className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Live Infrastructure</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690] relative z-10">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying Immutable Log</p>
          </div>
        ) : activeStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50 relative z-10">
            <Clock className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Active Infrastructure</p>
            <p className="text-[#8a8690] text-xs">Initialize a new compute tier or wait for inbound allocations.</p>
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
