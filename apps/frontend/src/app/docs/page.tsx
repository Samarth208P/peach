"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import AnimatedHeroBackground from "@/components/AnimatedHeroBackground";
import { Book, Shield, Zap, TrendingDown, TrendingUp, Coins, Activity, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("intro");

  return (
    <div className="min-h-screen bg-[#060608] flex flex-col font-sans relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatedHeroBackground />
      </div>

      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-12 flex flex-col md:flex-row gap-8 relative z-10">
        
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
          <div className="text-xs font-semibold text-[#8a8690] uppercase tracking-wider mb-4 ml-3">Documentation</div>
          
          <NavButton 
            id="intro" 
            active={activeTab === "intro"} 
            onClick={() => setActiveTab("intro")} 
            icon={<Book size={16} />} 
            label="What is Peach?" 
          />
          <NavButton 
            id="modes" 
            active={activeTab === "modes"} 
            onClick={() => setActiveTab("modes")} 
            icon={<Shield size={16} />} 
            label="Protection Modes" 
          />
          <NavButton 
            id="fees" 
            active={activeTab === "fees"} 
            onClick={() => setActiveTab("fees")} 
            icon={<Coins size={16} />} 
            label="Fee Structure" 
          />
          <NavButton 
            id="claiming" 
            active={activeTab === "claiming"} 
            onClick={() => setActiveTab("claiming")} 
            icon={<Zap size={16} />} 
            label="Claiming Streams" 
          />
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 bg-[#0d0d10]/60 border border-white/5 rounded-3xl p-8 md:p-12">
          {activeTab === "intro" && <IntroSection />}
          {activeTab === "modes" && <ModesSection />}
          {activeTab === "fees" && <FeesSection />}
          {activeTab === "claiming" && <ClaimingSection />}
        </section>

      </main>
    </div>
  );
}

// --- Navigation Button ---
function NavButton({ id, active, onClick, icon, label }: { id: string, active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
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

function IntroSection() {
  return (
    <div className="space-y-6 text-[#e8e4df] leading-relaxed">
      <h1 className="text-3xl font-display font-medium tracking-tight mb-2">Welcome to Peach Protocol</h1>
      <p className="text-[#8a8690] text-lg mb-8">
        Peach is a smart-contract protocol on the Sui network that allows you to stream payments over time, while automatically hedging against market volatility.
      </p>
      
      <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-medium mb-3 flex items-center gap-2">
          <Activity className="text-[#FF8B5E]" size={20} /> The Problem
        </h3>
        <p className="text-[#8a8690]">
          When you lock tokens into a standard vesting contract or payment stream for months or years, you are at the absolute mercy of market volatility. If the token crashes by 50%, the employee receiving the stream loses 50% of their purchasing power.
        </p>
      </div>

      <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-medium mb-3 flex items-center gap-2">
          <Shield className="text-green-400" size={20} /> The Peach Solution
        </h3>
        <p className="text-[#8a8690]">
          Peach solves this by acting as an "autonomous hedge fund" for your payment streams. By integrating with the <strong>Pyth Network Oracle</strong> (for live price feeds) and <strong>DeepBook V3</strong> (for decentralized trading), Peach streams can automatically swap their unvested SUI into stablecoins (USDC) the exact moment the market crosses your safety threshold.
        </p>
      </div>
    </div>
  );
}

function ModesSection() {
  return (
    <div className="space-y-8 text-[#e8e4df] leading-relaxed">
      <div>
        <h1 className="text-3xl font-display font-medium tracking-tight mb-2">Protection Modes</h1>
        <p className="text-[#8a8690] text-lg">
          When creating a stream, you can choose between two primary hedging directions depending on your goals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl flex flex-col h-full">
          <div className="w-12 h-12 bg-[#FF8B5E]/10 rounded-xl flex items-center justify-center mb-4 border border-[#FF8B5E]/20">
            <TrendingDown className="text-[#FF8B5E]" size={24} />
          </div>
          <h3 className="text-xl font-medium mb-2">Floor (Downside Protection)</h3>
          <p className="text-[#8a8690] mb-4 flex-1">
            The hedge fires when the SUI price drops <strong>below</strong> your Strike Price.
          </p>
          <div className="bg-white/5 p-4 rounded-xl text-sm border border-white/5">
            <span className="font-semibold text-[#e8e4df]">Best For:</span> Payroll and employee compensation. Ensures that no matter how low the market drops, employees are guaranteed a minimum fiat equivalent value to pay rent and living expenses.
          </div>
        </div>

        <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl flex flex-col h-full">
          <div className="w-12 h-12 bg-[#FF8B5E]/10 rounded-xl flex items-center justify-center mb-4 border border-[#FF8B5E]/20">
            <TrendingUp className="text-[#FF8B5E]" size={24} />
          </div>
          <h3 className="text-xl font-medium mb-2">Ceiling (Upside Protection)</h3>
          <p className="text-[#8a8690] mb-4 flex-1">
            The hedge fires when the SUI price rises <strong>above</strong> your Strike Price.
          </p>
          <div className="bg-white/5 p-4 rounded-xl text-sm border border-white/5">
            <span className="font-semibold text-[#e8e4df]">Best For:</span> B2B Supply chain contracts. If you agreed to pay a supplier a fixed amount of SUI over a year, but SUI 10x's in value, you drastically overpaid. A ceiling swaps the SUI to USDC if it gets too expensive.
          </div>
        </div>
      </div>
      
      <div className="bg-[#FF8B5E]/5 border border-[#FF8B5E]/20 p-5 rounded-2xl flex items-start gap-4">
        <Lock className="text-[#FF8B5E] shrink-0 mt-1" size={20} />
        <div>
          <h4 className="text-[#FF8B5E] font-medium mb-1">What is a Strike Price?</h4>
          <p className="text-[#8a8690] text-sm">
            The Strike Price is the exact USD value per SUI where your protection activates. For example, if SUI is currently $1.00, and you set a Floor at $0.90, the smart contract will do absolutely nothing until SUI drops below $0.90. Once it does, it sells the SUI into USDC to protect the remaining value.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeesSection() {
  return (
    <div className="space-y-8 text-[#e8e4df] leading-relaxed">
      <div>
        <h1 className="text-3xl font-display font-medium tracking-tight mb-2">Fee Structure</h1>
        <p className="text-[#8a8690] text-lg">
          Peach uses a transparent, volume-based fee model with dynamic risk premiums. Fees are <strong>only deducted upon claiming</strong>, and they are calculated on the claimed amount.
        </p>
      </div>

      <div>
        <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
          <Coins className="text-[#FF8B5E]" size={20} /> Volume Tier Discounts
        </h3>
        <p className="text-[#8a8690] mb-4">
          The larger the total stream size, the lower your base fee rate. This incentivizes large institutional streams while keeping small retail streams sustainable.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 text-[#8a8690] font-medium uppercase tracking-wider text-xs">Total Stream Amount</th>
                <th className="py-3 px-4 text-[#8a8690] font-medium uppercase tracking-wider text-xs">Base Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4 font-mono">&lt; 1,000 SUI</td>
                <td className="py-3 px-4 font-mono text-[#FF8B5E]">0.50%</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4 font-mono">1,000 - 4,999 SUI</td>
                <td className="py-3 px-4 font-mono text-[#FF8B5E]">0.30%</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4 font-mono">5,000 - 9,999 SUI</td>
                <td className="py-3 px-4 font-mono text-[#FF8B5E]">0.20%</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4 font-mono">&ge; 10,000 SUI</td>
                <td className="py-3 px-4 font-mono text-green-400">0.10%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#141418] border border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-medium mb-2 text-[#FF8B5E] flex items-center gap-2">
          ⚠️ The Danger Zone (Risk Premium)
        </h3>
        <p className="text-[#8a8690] mb-4">
          If you claim your stream while the live Pyth spot price is within <strong>5% of your Strike Price</strong>, the system considers the stream to be in the "Danger Zone". 
        </p>
        <p className="text-[#8a8690] mb-4">
          Because the protocol is actively executing high-stakes atomic hedges to protect your downside (or upside) during this volatile period, a temporary <strong>1.50% Risk Premium</strong> is added to your fee.
        </p>
        <div className="text-sm border-l-2 border-[#FF8B5E] pl-4 text-[#8a8690] italic">
          Tip: To avoid the risk premium, simply wait for the market to stabilize away from your strike price before claiming your tokens.
        </div>
      </div>
    </div>
  );
}

function ClaimingSection() {
  return (
    <div className="space-y-6 text-[#e8e4df] leading-relaxed">
      <h1 className="text-3xl font-display font-medium tracking-tight mb-2">Claiming & Auto-Hedging</h1>
      <p className="text-[#8a8690] text-lg mb-8">
        How value moves from the locked escrow to your wallet.
      </p>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl">
          <h3 className="text-xl font-medium mb-2 text-white">Continuous Vesting</h3>
          <p className="text-[#8a8690]">
            Streams vest continuously, second by second. You do not have to wait for the end of the stream to access your funds. You can claim the unlocked portion at any time from your Dashboard.
          </p>
        </div>

        <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl">
          <h3 className="text-xl font-medium mb-2 text-white">The Hedge Trigger</h3>
          <p className="text-[#8a8690]">
            The magic of Peach happens <em>during the claim transaction</em>. When you click "Claim", the protocol first fetches the latest SUI price from the Pyth network. If the price crosses your strike threshold, the protocol will automatically take the unvested portion of your stream and route it through DeepBook V3 to swap it into USDC.
          </p>
        </div>
        
        <div className="bg-[#060608] border border-white/5 p-6 rounded-2xl">
          <h3 className="text-xl font-medium mb-2 text-white">Sub-Lot Buffering</h3>
          <p className="text-[#8a8690]">
            DeepBook has a minimum trade size. If the amount of SUI that needs to be hedged is too small to trade on DeepBook, the smart contract will temporarily log it as "Hedge Debt" and buffer it until the unvested amount crosses the minimum lot size, at which point it executes the swap.
          </p>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
        <Link 
          href="/dashboard/create" 
          className="flex items-center gap-2 bg-[#e8e4df] text-black px-6 py-3 rounded-xl font-medium hover:bg-white transition-colors"
        >
          Create your first stream <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
