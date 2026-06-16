"use client";

import React from "react";
import Link from "next/link";
import PeachTextLogo from "@/components/PeachTextLogo";
import TickingStreamRow from "@/components/TickingStreamRow";
import ProtectionShieldGraph from "@/components/ProtectionShieldGraph";
import MicroPremiumLedger from "@/components/MicroPremiumLedger";
import { Plus, LayoutDashboard, Wallet, Activity } from "lucide-react";

export default function DashboardPage() {
  const mockStreams = [
    {
      id: "1",
      type: "outbound" as const,
      targetValue: 50000,
      durationSeconds: 30 * 24 * 60 * 60,
      elapsedSeconds: 15 * 24 * 60 * 60,
      sender: "0x89ab12cd34ef56gh",
      receiver: "0x12cd34ef56gh78ij"
    },
    {
      id: "2",
      type: "inbound" as const,
      targetValue: 12500,
      durationSeconds: 14 * 24 * 60 * 60,
      elapsedSeconds: 3 * 24 * 60 * 60,
      sender: "0xab12cd34ef56gh89",
      receiver: "0x89ab12cd34ef56gh"
    },
    {
      id: "3",
      type: "outbound" as const,
      targetValue: 8000,
      durationSeconds: 7 * 24 * 60 * 60,
      elapsedSeconds: 6 * 24 * 60 * 60,
      sender: "0x89ab12cd34ef56gh",
      receiver: "0xef56gh78ij90kl"
    }
  ];

  return (
    <div className="min-h-screen bg-[#060608] flex flex-col font-sans">
      {/* Top Nav */}
      <header className="w-full border-b border-white/[0.05] bg-[#0a0a0c]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] w-full mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Link href="/" className="group">
              <PeachTextLogo className="h-8 w-auto group-hover:scale-105 transition-transform duration-500 origin-left drop-shadow-[0_0_10px_rgba(253,133,102,0.1)]" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <span className="flex items-center gap-2 text-white font-medium text-sm">
                <LayoutDashboard size={16} className="text-[#FD8566]" /> Overview
              </span>
              <span className="flex items-center gap-2 text-[#8a8690] hover:text-white transition-colors cursor-pointer text-sm">
                <Activity size={16} /> Analytics
              </span>
              <span className="flex items-center gap-2 text-[#8a8690] hover:text-white transition-colors cursor-pointer text-sm">
                <Wallet size={16} /> Vault
              </span>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full text-sm font-mono text-white/80">
              0x89ab...56gh
            </div>
            <Link href="/dashboard/create" className="flex items-center gap-2 bg-[#FD8566] text-black px-5 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform duration-300">
              <Plus size={16} /> New Stream
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-8 py-10 flex flex-col gap-8">
        
        {/* Top Layer: Global Capital Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Streamed Volume", value: "$842,590.00", spark: "+12.5%" },
            { label: "Active Vectors", value: "3 Out / 1 In", spark: "Stable" },
            { label: "Net Insured Capital", value: "$62,500.00", spark: "100% Protected" },
            { label: "Ecosystem Savings", value: "$18,450.22", spark: "Last 30 Days" }
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
            
            <div className="bg-[#0a0a0c] border border-white/[0.05] rounded-[32px] p-8 flex flex-col flex-1 min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl text-white font-display font-medium tracking-tight">Active Streams Queue</h2>
                <div className="flex bg-white/[0.03] p-1 rounded-lg">
                  <button className="px-4 py-1.5 rounded-md bg-white/[0.08] text-white text-xs font-medium">All</button>
                  <button className="px-4 py-1.5 rounded-md text-[#8a8690] hover:text-white text-xs transition-colors">Outbound</button>
                  <button className="px-4 py-1.5 rounded-md text-[#8a8690] hover:text-white text-xs transition-colors">Inbound</button>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                {mockStreams.map(stream => (
                  <TickingStreamRow key={stream.id} config={stream} />
                ))}
              </div>
            </div>

            <div className="bg-[#0a0a0c] border border-white/[0.05] rounded-[32px] p-8 min-h-[300px]">
              <MicroPremiumLedger />
            </div>
            
          </div>

          {/* Right Column: 40% Width */}
          <div className="flex flex-col w-full lg:w-2/5 gap-6">
            
            <div className="bg-[#0a0a0c] border border-white/[0.05] rounded-[32px] p-8 min-h-[350px] flex flex-col">
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
