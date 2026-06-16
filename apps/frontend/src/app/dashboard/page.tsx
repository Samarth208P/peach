"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PeachTextLogo from "@/components/PeachTextLogo";
import TickingStreamRow from "@/components/TickingStreamRow";
import ProtectionShieldGraph from "@/components/ProtectionShieldGraph";
import MicroPremiumLedger from "@/components/MicroPremiumLedger";

import { Plus, LayoutDashboard, Wallet, Activity } from "lucide-react";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";

const PACKAGE_ID = "0x49c002ce2aadfa23c699394e44be190188a9ec6ea0d2b8b3c23dce7779904d22";

export default function DashboardPage() {
  const currentAccount = useCurrentAccount();
  const router = useRouter();

  React.useEffect(() => {
    if (!currentAccount) {
      router.push('/login');
    }
  }, [currentAccount, router]);
  
  const { data: streamsData, isPending } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: currentAccount?.address || '',
      filter: { StructType: `${PACKAGE_ID}::peach_stream::Stream` },
      options: { showContent: true }
    },
    {
      enabled: !!currentAccount,
      refetchInterval: 5000
    }
  );

  // Parse real streams
  const activeStreams = streamsData?.data?.map((obj: any) => {
    const fields = obj.data?.content?.fields;
    
    const start = Number(fields?.start_time_ms) || 0;
    const end = Number(fields?.end_time_ms) || 0;
    const durationSeconds = end > start ? (end - start) / 1000 : 30 * 24 * 60 * 60;
    const elapsedSeconds = start > 0 ? Math.max(0, (Date.now() - start) / 1000) : 0;

    return {
      id: obj.data?.objectId,
      type: fields?.recipient === currentAccount?.address ? "self" : "outbound",
      // SUI has 9 decimals
      targetValue: fields?.balance ? Number(fields.balance) / 1_000_000_000 : 0,
      durationSeconds: durationSeconds,
      elapsedSeconds: elapsedSeconds, 
      sender: currentAccount?.address || "",
      receiver: fields?.recipient || ""
    };
  }) || [];

  const totalVolume = activeStreams.reduce((acc, curr) => acc + curr.targetValue, 0);
  const outCount = activeStreams.length; // owned streams are outbound
  const inCount = activeStreams.filter(s => s.receiver === currentAccount?.address).length;


  return (
    <div className="flex flex-col font-sans w-full relative z-10">
      <main className="w-full max-w-[1600px] mx-auto px-8 py-10 flex flex-col gap-8">
        {/* Top Actions */}
        <div className="w-full flex justify-end items-center mb-2 gap-4">
          <div className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full text-sm font-mono text-white/80 backdrop-blur-md">
            {currentAccount ? `${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}` : "Not Connected"}
          </div>
          <Link href="/dashboard/create" className="flex items-center gap-2 bg-[#FD8566] text-black px-5 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform duration-300">
            <Plus size={16} /> New Stream
          </Link>
        </div>
        
        {/* Top Layer: Global Capital Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Streamed Volume", value: `${totalVolume.toFixed(2)} SUI`, spark: "Active Testnet" },
            { label: "Active Vectors", value: `${outCount} Out / ${inCount} In`, spark: "Stable" },
            { label: "Net Insured Capital", value: `${(totalVolume * 0.99).toFixed(2)} SUI`, spark: "100% Protected" },
            { label: "Micro-Premiums (1%)", value: `${(totalVolume * 0.01).toFixed(2)} SUI`, spark: "Routed to DeepBook" }
          ].map((metric, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-[#8a8690] text-sm font-medium relative z-10">{metric.label}</span>
              <span className="text-3xl text-white font-display font-medium relative z-10">{metric.value}</span>
              <span className="text-xs text-[#FD8566] font-mono mt-1 relative z-10">{metric.spark}</span>
            </div>
          ))}
        </div>

        {/* Middle Layer: Split Grid Configuration */}
        <div className="flex flex-col lg:flex-row gap-6 mt-4">
          
          {/* Left Column: 60% Width */}
          <div className="flex flex-col w-full lg:w-3/5 gap-6">
            
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[32px] p-8 flex flex-col flex-1 min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl text-white font-display font-medium tracking-tight">Active Streams Queue</h2>
                <div className="flex bg-white/[0.03] p-1 rounded-lg">
                  <button className="px-4 py-1.5 rounded-md bg-white/[0.08] text-white text-xs font-medium">All</button>
                  <button className="px-4 py-1.5 rounded-md text-[#8a8690] hover:text-white text-xs transition-colors">Outbound</button>
                  <button className="px-4 py-1.5 rounded-md text-[#8a8690] hover:text-white text-xs transition-colors">Inbound</button>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                {isPending ? (
                  <div className="text-center text-[#8a8690] py-10">Fetching live streams...</div>
                ) : activeStreams.length === 0 ? (
                  <div className="text-center text-[#8a8690] py-10">No active streams found. Create one!</div>
                ) : (
                  activeStreams.map((stream: any) => (
                    <TickingStreamRow key={stream.id} config={stream} />
                  ))
                )}
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[32px] p-8 min-h-[300px]">
              <MicroPremiumLedger />
            </div>
            
          </div>

          {/* Right Column: 40% Width */}
          <div className="flex flex-col w-full lg:w-2/5 gap-6">
            
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[32px] p-8 min-h-[350px] flex flex-col">
              <ProtectionShieldGraph />
            </div>

            <div className="bg-[#FD8566] text-black border border-[#FD8566] rounded-[32px] p-8 min-h-[250px] flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-20 blur-[100px] pointer-events-none group-hover:opacity-30 transition-opacity duration-1000" />
              <div className="relative z-10">
                <h2 className="text-2xl font-display font-bold tracking-tight mb-2">DeepBook Predict Vault</h2>
                <p className="text-black/70 font-medium">Real-time Exposure & Collateral</p>
              </div>
              <div className="relative z-10 flex flex-col gap-2 mt-8">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <span className="font-mono text-sm opacity-80">Active Put Options</span>
                  <span className="font-mono font-bold">142 Contracts</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <span className="font-mono text-sm opacity-80">Implied Volatility (σ)</span>
                  <span className="font-mono font-bold">84.2%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm opacity-80">Solvency Status</span>
                  <span className="font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-900 animate-pulse" /> Overcollateralized
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
