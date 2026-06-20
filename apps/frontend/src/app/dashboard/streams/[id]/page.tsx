"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import TickingStreamRow from "@/components/TickingStreamRow";
import StreamActivityLogs from "@/components/StreamActivityLogs";
import StreamActivityGraph from "@/components/StreamActivityGraph";
import { PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

export default function StreamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  const [streamConfig, setStreamConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pythSpotPrice, setPythSpotPrice] = useState<number | null>(null);

  // Fetch Pyth Price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const feedId = PYTH_SUI_USD_FEED_ID.replace("0x", "");
        const res = await fetch(
          `${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`
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

  // Fetch Stream Object
  useEffect(() => {
    if (!streamId || !currentAccount) return;

    setIsLoading(true);
    suiClient.getObject({
      id: streamId,
      options: { showContent: true }
    }).then(res => {
      if (res.data?.content?.dataType === "moveObject") {
        const fields = res.data.content.fields as any;
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

        setStreamConfig({
          id: fields.id.id,
          type,
          targetValue: Number(fields.total_amount) / 1e9,
          durationSeconds: duration,
          elapsedSeconds: elapsed,
          startTimeMs: startTime,
          endTimeMs: endTime,
          sender: fields.sender,
          receiver: fields.receiver,
          strikePrice: Number(fields.strike_price) / 1e8,
          hedgeDirection: Number(fields.hedge_direction),
          hedgeTriggered: fields.hedge_triggered === true,
          withdrawn: Number(fields.withdrawn) / 1e9,
        });
      }
    }).catch(err => {
      console.error("Failed to fetch stream details:", err);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [streamId, currentAccount, suiClient]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-[#8a8690]">
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-wider font-mono">Loading Stream Data</p>
      </div>
    );
  }

  if (!streamConfig) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center py-32">
        <h1 className="text-2xl text-[#e8e4df] font-medium mb-2">Stream Not Found</h1>
        <p className="text-[#8a8690] text-sm mb-6">This stream object may not exist or has been deleted.</p>
        <button 
          onClick={() => router.push('/dashboard/streams')}
          className="px-4 py-2 bg-surface-1 rounded-xl text-sm border border-white/5 hover:bg-surface-2 transition-colors"
        >
          Back to Streams
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full mx-auto font-sans h-full flex flex-col">
      <div className="flex justify-between items-start mb-4 shrink-0">
        <div>
          <h1 className="text-2xl text-[#e8e4df] font-display font-medium tracking-tight mb-1">
            Stream Details
          </h1>
          <p className="text-[#8a8690] text-sm flex items-center gap-2 font-mono">
            <Activity size={14} /> ID: {streamId}
          </p>
        </div>
        <button 
          onClick={() => router.push('/dashboard/streams')}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[#8a8690] hover:text-[#e8e4df] hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Main Row */}
        <div className="shrink-0">
          <TickingStreamRow 
            config={streamConfig} 
            pythSpotPrice={pythSpotPrice || 0} 
            disableClick={true} 
          />
        </div>

        {/* Analytics Grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 flex-1 min-h-0 pb-2">
          <div className="h-[300px] lg:h-auto shrink-0 lg:shrink min-h-0">
            <StreamActivityGraph config={streamConfig} currentPrice={pythSpotPrice || 0} />
          </div>
          <div className="flex-1 min-h-0 lg:h-auto">
            <StreamActivityLogs config={streamConfig} />
          </div>
        </div>
      </div>
    </div>
  );
}
