"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import AnimatedHeroBackground from "@/components/AnimatedHeroBackground";
import { TrendingDown, TrendingUp, ShieldAlert, BarChart3, ArrowRight, DollarSign, Activity } from "lucide-react";
import Link from "next/link";

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <div className="min-h-screen flex flex-col relative bg-[#060608] overflow-x-hidden w-full max-w-full font-sans">
      <AnimatedHeroBackground />

      <Header />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-8 xl:px-16 pt-32 pb-12 flex flex-col md:flex-row gap-8 relative z-10">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0 space-y-1 md:sticky md:top-32 md:h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
          <div className="text-xs font-semibold text-[#8a8690] uppercase tracking-wider mb-4 ml-3">Performance Data</div>
          
          <NavButton 
            active={activeTab === "summary"} 
            onClick={() => setActiveTab("summary")} 
            icon={<BarChart3 size={16} />} 
            label="Platform Impact" 
          />
          <NavButton 
            active={activeTab === "case1"} 
            onClick={() => setActiveTab("case1")} 
            icon={<TrendingDown size={16} />} 
            label="Payroll (Floor)" 
          />
          <NavButton 
            active={activeTab === "case2"} 
            onClick={() => setActiveTab("case2")} 
            icon={<TrendingUp size={16} />} 
            label="Vendors (Ceiling)" 
          />
          <NavButton 
            active={activeTab === "simulator"} 
            onClick={() => setActiveTab("simulator")} 
            icon={<Activity size={16} />} 
            label="Live Simulation" 
          />
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 bg-[#0d0d10]/60 border border-white/5 rounded-3xl p-6 md:p-8 overflow-x-auto">
          {activeTab === "summary" && <SummaryStatsSection />}
          {activeTab === "case1" && <CaseStudyOne />}
          {activeTab === "case2" && <CaseStudyTwo />}
          {activeTab === "simulator" && <SimulatorSection />}
        </section>

      </main>
    </div>
  );
}

// --- Navigation Button ---
function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium ${
        active 
          ? "bg-[#FF8B5E]/10 text-[#FF8B5E]" 
          : "text-[#8a8690] hover:text-[#e8e4df] hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Content Sections ---

function SummaryStatsSection() {
  return (
    <div className="space-y-6 text-[#e8e4df]">
      <h1 className="text-2xl font-display font-medium tracking-tight mb-2">Protocol Projections</h1>
      <p className="text-[#8a8690] text-sm mb-6">
        Peach doesn't just move tokens; it preserves financial energy. Here are the projected performance improvements of our auto-hedging infrastructure against market volatility.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#060608] border border-white/5 p-5 rounded-2xl">
          <div className="text-[#8a8690] text-[10px] font-bold uppercase tracking-wider mb-2">Projected Value Retention</div>
          <div className="text-3xl font-mono text-green-400 mb-1">Up to +260%</div>
          <div className="text-xs text-[#8a8690]">Vs. unhedged streams during severe drawdowns</div>
        </div>
        <div className="bg-[#060608] border border-white/5 p-5 rounded-2xl">
          <div className="text-[#8a8690] text-[10px] font-bold uppercase tracking-wider mb-2">Treasury Liability Cap</div>
          <div className="text-3xl font-mono text-[#FF8B5E] mb-1">-70% Risk</div>
          <div className="text-xs text-[#8a8690]">Reduction in B2B overpayment exposure</div>
        </div>
        <div className="bg-[#060608] border border-white/5 p-5 rounded-2xl">
          <div className="text-[#8a8690] text-[10px] font-bold uppercase tracking-wider mb-2">Slippage Mitigation</div>
          <div className="text-3xl font-mono text-white mb-1">&lt; 1.5%</div>
          <div className="text-xs text-[#8a8690]">Target max variance via DeepBook V3 routing</div>
        </div>
      </div>

      <div className="bg-[#141418] border border-[#FF8B5E]/20 p-6 rounded-2xl">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <ShieldAlert className="text-[#FF8B5E]" size={18} /> Projected Impact: 42% Black Swan Crash
        </h3>
        <p className="text-[#8a8690] text-sm mb-4">
          During a modeled 42% market crash over a 72-hour window, standard unhedged streams lose nearly half their value. 
        </p>
        <div className="flex items-end gap-6 h-32 mt-6">
          <div className="flex-1 flex flex-col justify-end items-center gap-2">
            <div className="w-full bg-red-500/20 rounded-t-lg relative group h-[58%] border-t border-red-500/50">
              <div className="absolute -top-6 left-0 right-0 text-center text-xs font-mono text-red-400">-42% Loss</div>
            </div>
            <div className="text-xs text-[#8a8690]">Standard Stream</div>
          </div>
          <div className="flex-1 flex flex-col justify-end items-center gap-2">
            <div className="w-full bg-green-500/20 rounded-t-lg relative group h-[96%] border-t border-green-500/50">
              <div className="absolute -top-6 left-0 right-0 text-center text-xs font-mono text-green-400">-4% (Slippage Model)</div>
            </div>
            <div className="text-xs text-[#8a8690] font-semibold text-white">Peach Floor Projection</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseStudyOne() {
  return (
    <div className="space-y-6 text-[#e8e4df]">
      <h1 className="text-2xl font-display font-medium tracking-tight mb-2">Employee Payroll (Crash Projection)</h1>
      <p className="text-[#8a8690] text-sm mb-6">
        How a "Floor" stream mathematically guarantees your employees can pay rent even if the crypto market collapses.
      </p>

      <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl mb-6">
        <h3 className="text-white font-medium mb-4">The Setup: Hiring a Lead Developer</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Total Compensation</div>
            <div className="font-mono text-white">120,000 SUI</div>
          </div>
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Duration</div>
            <div className="font-mono text-white">12 Months</div>
          </div>
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Starting Price</div>
            <div className="font-mono text-white">$1.00 / SUI</div>
          </div>
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Peach Floor Set</div>
            <div className="font-mono text-green-400">$0.90 / SUI</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse bg-white/5 rounded-xl overflow-hidden">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              <th className="py-4 px-4 text-[#8a8690] font-medium">Timeline</th>
              <th className="py-4 px-4 text-[#8a8690] font-medium">Modeled SUI Price</th>
              <th className="py-4 px-4 text-[#8a8690] font-medium text-right">Unprotected Projection</th>
              <th className="py-4 px-4 text-[#8a8690] font-medium text-right">Peach Hedged Projection</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5 hover:bg-white/5">
              <td className="py-4 px-4 font-medium">Month 1 (Normal)</td>
              <td className="py-4 px-4 font-mono">$1.05</td>
              <td className="py-4 px-4 text-right font-mono">$10,500</td>
              <td className="py-4 px-4 text-right font-mono">$10,500</td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 bg-red-500/5">
              <td className="py-4 px-4 font-medium text-red-400">Month 4 (Crash)</td>
              <td className="py-4 px-4 font-mono text-red-400">$0.40</td>
              <td className="py-4 px-4 text-right font-mono text-red-400">$4,000 <span className="text-[10px] block opacity-70">-60% Purchasing Power</span></td>
              <td className="py-4 px-4 text-right font-mono text-green-400">$9,000 <span className="text-[10px] block opacity-70">+125% Improvement</span></td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 bg-red-500/10">
              <td className="py-4 px-4 font-medium text-red-500">Month 7 (Bear Market)</td>
              <td className="py-4 px-4 font-mono text-red-400">$0.25</td>
              <td className="py-4 px-4 text-right font-mono text-red-400">$2,500 <span className="text-[10px] block opacity-70">-75% Purchasing Power</span></td>
              <td className="py-4 px-4 text-right font-mono text-green-400">$9,000 <span className="text-[10px] block opacity-70">+260% Improvement</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl mt-6">
        <DollarSign className="text-green-400" size={24} />
        <div>
          <div className="text-sm font-semibold text-green-400">Projected Peak Retention: Up to +260% Better vs Unhedged</div>
          <div className="text-xs text-[#8a8690] mt-1">The developer retains their livelihood because their income is mathematically protected by Peach infrastructure.</div>
        </div>
      </div>
    </div>
  );
}

function CaseStudyTwo() {
  return (
    <div className="space-y-6 text-[#e8e4df]">
      <h1 className="text-2xl font-display font-medium tracking-tight mb-2">B2B Vendors (Spike Projection)</h1>
      <p className="text-[#8a8690] text-sm mb-6">
        How a "Ceiling" stream prevents you from accidentally overpaying a supplier by 300% when your token moons.
      </p>

      <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl mb-6">
        <h3 className="text-white font-medium mb-4">The Setup: Marketing Agency Contract</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Total Budget</div>
            <div className="font-mono text-white">60,000 SUI</div>
          </div>
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Monthly Release</div>
            <div className="font-mono text-white">5,000 SUI</div>
          </div>
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Starting Price</div>
            <div className="font-mono text-white">$1.00 / SUI</div>
          </div>
          <div>
            <div className="text-[#8a8690] text-xs mb-1">Peach Ceiling Set</div>
            <div className="font-mono text-[#FF8B5E]">$1.20 / SUI</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse bg-white/5 rounded-xl overflow-hidden">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              <th className="py-4 px-4 text-[#8a8690] font-medium">Timeline</th>
              <th className="py-4 px-4 text-[#8a8690] font-medium">Modeled SUI Price</th>
              <th className="py-4 px-4 text-[#8a8690] font-medium text-right">Unprotected Liability</th>
              <th className="py-4 px-4 text-[#8a8690] font-medium text-right">Peach Capped Liability</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5 hover:bg-white/5">
              <td className="py-4 px-4 font-medium">Month 1 (Normal)</td>
              <td className="py-4 px-4 font-mono">$1.00</td>
              <td className="py-4 px-4 text-right font-mono">$5,000</td>
              <td className="py-4 px-4 text-right font-mono">$5,000</td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 bg-[#FF8B5E]/10">
              <td className="py-4 px-4 font-medium text-[#FF8B5E]">Month 3 (Bull Run)</td>
              <td className="py-4 px-4 font-mono text-[#FF8B5E]">$2.50</td>
              <td className="py-4 px-4 text-right font-mono text-red-400">$12,500 <span className="text-[10px] block opacity-70">Overpayment Risk</span></td>
              <td className="py-4 px-4 text-right font-mono text-green-400">$6,000 <span className="text-[10px] block opacity-70">Liability Reduced 52%</span></td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 bg-[#FF8B5E]/20">
              <td className="py-4 px-4 font-medium text-[#FF8B5E]">Month 6 (Mega Pump)</td>
              <td className="py-4 px-4 font-mono text-[#FF8B5E]">$4.00</td>
              <td className="py-4 px-4 text-right font-mono text-red-400">$20,000 <span className="text-[10px] block opacity-70">Severe Treasury Bleed</span></td>
              <td className="py-4 px-4 text-right font-mono text-green-400">$6,000 <span className="text-[10px] block opacity-70">Liability Reduced 70%</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimulatorSection() {
  return (
    <div className="space-y-6 text-[#e8e4df]">
      <h1 className="text-2xl font-display font-medium tracking-tight mb-2">Live Math Simulation</h1>
      <p className="text-[#8a8690] text-sm mb-6">
        See exactly how the smart contract executes a Floor claim during a crash event.
      </p>

      <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl font-mono text-sm shadow-2xl shadow-black">
        <div className="text-green-400 mb-6 font-bold tracking-widest">{`> INITIALIZING PEACH_STREAM::CLAIM_STREAM`}</div>
        
        <div className="space-y-4 text-[#8a8690]">
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span>[1] Unlocked Tokens Request:</span>
            <span className="text-white">5,000.00 SUI</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span>[2] Checking Stream Floor Strike:</span>
            <span className="text-white">$0.95 USD/SUI</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3 bg-red-500/5 p-2 rounded">
            <span className="text-red-400">[3] Oracle Pyth Spot Price:</span>
            <span className="text-red-400">$0.60 USD/SUI (CRASH DETECTED)</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span>[4] Decision Matrix:</span>
            <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded">EXECUTE HEDGE</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span>[5] Routing via DeepBook V3:</span>
            <span className="text-white">Hedging 5,000 SUI at limit</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span>[6] Standard Unprotected Value:</span>
            <span>$3,000.00</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-3 text-green-400">
            <span>[7] Peach Protected Value (at $0.95):</span>
            <span>$4,750.00</span>
          </div>
          <div className="flex justify-between pt-4 text-white font-bold text-lg bg-white/5 p-4 rounded-xl mt-2">
            <span>FINAL CLAIM OUTPUT:</span>
            <span className="text-green-400">+$1,750.00 Saved</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
        <Link 
          href="/dashboard/create" 
          className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl text-sm font-semibold hover:scale-105 transition-all duration-300 shadow-xl shadow-white/10"
        >
          Protect Your Treasury <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}


