"use client";

import React from "react";
import { Terminal, ExternalLink } from "lucide-react";
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { PEACH_PACKAGE_ID } from "@/lib/constants";

export default function MicroPremiumLedger() {
  const { data, isPending } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCreated` },
      order: 'descending',
      limit: 8
    },
    { refetchInterval: 3000 }
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <Terminal size={18} className="text-[#8a8690]" />
        <h3 className="text-white font-medium text-sm font-mono tracking-tight uppercase opacity-80">Stream Event Feed</h3>
      </div>
      
      <div className="flex-1 overflow-hidden bg-white/[0.02] backdrop-blur-md border border-white/[0.03] rounded-[20px] p-4">
        {isPending ? (
          <div className="flex items-center justify-center h-full text-[#8a8690] text-sm">
            Listening for on-chain events...
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#8a8690] text-sm">
            No PTB executions found for this contract yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.data.map((event, index) => {
              const parsedJson = event.parsedJson as any;
              const timestamp = new Date(Number(event.timestampMs)).toLocaleTimeString([], { hour12: false });
              const streamId = `st_${parsedJson.stream_id.substring(0, 6).toUpperCase()}`;
              // Convert 1% premium of total_amount mist to SUI
              const premiumSUI = ((Number(parsedJson.total_amount) * 0.01) / 1_000_000_000).toFixed(3);
              const txHash = `${event.id.txDigest.substring(0, 6)}...${event.id.txDigest.substring(event.id.txDigest.length - 4)}`;
              const explorerLink = `https://testnet.suivision.xyz/txblock/${event.id.txDigest}`;

              return (
                <div 
                  key={event.id.txDigest + event.id.eventSeq} 
                  className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[#8a8690]">{timestamp}</span>
                    <span className="text-white">{streamId}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[#FD8566]">- {premiumSUI} SUI</span>
                    <a href={explorerLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400/80 hover:text-blue-300 transition-colors">
                      {txHash} <ExternalLink size={10} />
                    </a>
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
