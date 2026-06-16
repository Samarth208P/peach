"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Zap, Info } from "lucide-react";
import PeachTextLogo from "@/components/PeachTextLogo";
import { useRouter } from "next/navigation";

export default function CreateStreamPage() {
  const router = useRouter();
  const [protectedStream, setProtectedStream] = useState(true);
  const [amount, setAmount] = useState("50000");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate transaction creation
    console.log("Spawning intent...");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#060608] flex flex-col font-sans">
      <header className="w-full border-b border-white/[0.05] bg-[#0a0a0c]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1000px] w-full mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-[#8a8690] hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <PeachTextLogo className="h-7 w-auto drop-shadow-[0_0_10px_rgba(253,133,102,0.1)]" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FD8566]/10 border border-[#FD8566]/20 rounded-full text-[#FD8566] text-xs font-mono">
            <Zap size={14} className="animate-pulse" />
            Gas Sponsored
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[800px] mx-auto px-6 py-16 flex flex-col gap-10">
        <div>
          <h1 className="text-4xl text-white font-display font-medium tracking-tight mb-3">Spawn New Stream</h1>
          <p className="text-[#8a8690] text-lg font-light">Configure payment routing and set your desired risk profile.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-10">
          
          {/* General Inputs */}
          <div className="bg-[#0a0a0c] border border-white/[0.05] rounded-[32px] p-10 flex flex-col gap-8 shadow-2xl">
            <div className="flex flex-col gap-3">
              <label className="text-white font-medium text-sm">Recipient Wallet Address</label>
              <input 
                type="text" 
                placeholder="0x..." 
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 text-white font-mono focus:outline-none focus:border-[#FD8566]/50 focus:bg-white/[0.05] transition-all"
                required
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex flex-col gap-3 flex-1">
                <label className="text-white font-medium text-sm flex items-center justify-between">
                  Total Value (SUI)
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8a8690] font-mono"></span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-5 pr-5 py-4 text-white font-mono text-xl focus:outline-none focus:border-[#FD8566]/50 focus:bg-white/[0.05] transition-all"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 flex-1">
                <label className="text-white font-medium text-sm">Duration</label>
                <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 text-white font-mono focus:outline-none focus:border-[#FD8566]/50 focus:bg-white/[0.05] transition-all appearance-none cursor-pointer">
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="14">14 Days</option>
                  <option value="7">7 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Heavy Toggle - Downside Protection */}
          <div className={`border-2 rounded-[32px] p-10 transition-all duration-500 relative overflow-hidden ${
            protectedStream ? "bg-[#FD8566]/5 border-[#FD8566]/30" : "bg-[#0a0a0c] border-white/[0.05]"
          }`}>
            {protectedStream && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FD8566]/50 via-[#FD8566] to-[#FD8566]/50 shadow-[0_0_20px_#FD8566]" />
            )}
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-500 ${protectedStream ? "bg-[#FD8566] text-black shadow-[0_0_20px_rgba(253,133,102,0.4)]" : "bg-white/[0.05] text-[#8a8690]"}`}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-2xl text-white font-display font-medium">DeepBook Price Protection</h3>
                  <p className="text-[#8a8690] text-sm mt-1">Hedge stream against market volatility</p>
                </div>
              </div>

              {/* The Heavy Toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={protectedStream}
                  onChange={() => setProtectedStream(!protectedStream)}
                />
                <div className="w-16 h-8 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#FD8566]"></div>
              </label>
            </div>

            {protectedStream && (
              <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.05] flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#8a8690]">Micro-Premium Route</span>
                  <span className="text-white font-mono">1.0% ($500.00)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#8a8690]">Guaranteed Minimum Floor</span>
                  <span className="text-green-400 font-mono font-medium">$49,500.00</span>
                </div>
                <div className="flex items-start gap-3 mt-2 p-3 bg-blue-500/10 text-blue-400 rounded-xl text-xs leading-relaxed">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p>A PTB will automatically deduct 1% to continuously purchase At-The-Money put options via DeepBook Predict, fully covering the remaining 99%.</p>
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit"
            className="w-full bg-white text-black py-5 rounded-[20px] text-lg font-medium hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300 relative group overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              Initialize PTB Contract
            </span>
            <div className="absolute inset-0 bg-[#FD8566] mix-blend-screen opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
          </button>
          
        </form>
      </main>
    </div>
  );
}
