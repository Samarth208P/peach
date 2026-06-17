"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, Zap, Lock, Info, Calendar, User, Coins } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import gsap from "gsap";
import {
  PEACH_PACKAGE_ID,
  USDC_TYPE,
} from "@/lib/constants";

export default function CreateStreamPage() {
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isProtected, setIsProtected] = useState(true);
  const [strikePrice, setStrikePrice] = useState("1.00");
  const [isExecuting, setIsExecuting] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);

  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentAccount) router.push("/login");
  }, [currentAccount, router]);

  // Subtle GSAP entrance animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
      );

      gsap.fromTo([formRef.current, summaryRef.current],
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power2.out", delay: 0.15 }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleCreate = async () => {
    if (!currentAccount || !amount || !recipient || !startDate || !endDate) return;

    const startTimeMs = new Date(startDate).getTime();
    const endTimeMs = new Date(endDate).getTime();

    if (startTimeMs < Date.now()) return toast("Start time cannot be in the past.", "error");
    if (endTimeMs <= startTimeMs) return toast("End time must be after start time.", "error");

    setIsExecuting(true);
    setTxResult(null);

    try {
      const txb = new Transaction();
      const amountInMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

      const strikePriceScaled = isProtected
        ? BigInt(Math.floor(parseFloat(strikePrice) * 100_000_000))
        : BigInt(0);

      const [streamCoin] = txb.splitCoins(txb.gas, [amountInMist]);

      txb.moveCall({
        target: `${PEACH_PACKAGE_ID}::peach_stream::create_stream`,
        typeArguments: [USDC_TYPE],
        arguments: [
          txb.pure.address(recipient),
          txb.pure.u64(BigInt(startTimeMs)),
          txb.pure.u64(BigInt(endTimeMs)),
          txb.pure.u64(strikePriceScaled),
          streamCoin,
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: txb });
      setTxResult(result.digest);
      toast("Stream deployed successfully!", "success");
      setTimeout(() => router.push("/dashboard/streams"), 1500);
    } catch (e: any) {
      console.error("PTB Execution Failed:", e);
      toast(`Transaction failed: ${e?.message ?? e}`, "error");
    } finally {
      setIsExecuting(false);
    }
  };

  const netAmount = parseFloat(amount || "0");
  const strikePriceNum = parseFloat(strikePrice || "0");

  return (
    <div ref={containerRef} className="relative min-h-[calc(100vh-4rem)] p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* Ambient Background Blobs (Fixed to prevent scroll lag) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-5%] left-[10%] w-[50%] h-[50%] rounded-full bg-[#FF8B5E]/[0.06] blur-[120px] animate-blob" />
        <div className="absolute top-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[#3898FF]/[0.05] blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[45%] rounded-full bg-[#FF8B5E]/[0.04] blur-[100px] animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <div ref={headerRef} className="mb-10 relative z-10 pl-2">
        <h1 className="text-4xl text-white font-display font-semibold tracking-tight mb-3">
          Deploy Stream
        </h1>
        <p className="text-[#8a8690] max-w-xl text-[15px] leading-relaxed">
          Initialize a continuous, non-custodial payment stream. Enable Pyth protection to automatically hedge downside risk on-chain via DeepBook V3.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-10">
        {/* Left Column: Form Config */}
        <div ref={formRef} className="xl:col-span-8 space-y-6">
          
          {/* Stream Config Panel */}
          <div className="glass rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <h2 className="text-lg font-medium text-white mb-8 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-[#FD8566] rounded-full inline-block" />
              Stream Details
            </h2>

            <div className="space-y-6">
              {/* Recipient */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#8a8690] flex items-center gap-2 ml-1">
                  <User className="w-4 h-4" /> Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-4 text-white placeholder:text-[#8a8690]/40 focus:outline-none focus:border-[#FD8566]/50 focus:ring-1 focus:ring-[#FD8566]/50 transition-all duration-300 font-mono text-sm shadow-inner"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#8a8690] flex items-center gap-2 ml-1">
                  <Coins className="w-4 h-4" /> Total Amount
                </label>
                <div className="relative group/input">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl pl-5 pr-16 py-4 text-white focus:outline-none focus:border-[#FD8566]/50 focus:ring-1 focus:ring-[#FD8566]/50 transition-all duration-300 text-xl font-display shadow-inner"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3898FF] to-[#60A5FA] flex items-center justify-center shadow-[0_0_15px_rgba(56,152,255,0.3)]">
                      <span className="text-[10px] font-bold text-white tracking-wider">SUI</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#8a8690] flex items-center gap-2 ml-1">
                    <Calendar className="w-4 h-4" /> Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-[#FD8566]/50 focus:ring-1 focus:ring-[#FD8566]/50 transition-all duration-300 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#8a8690] flex items-center gap-2 ml-1">
                    <Calendar className="w-4 h-4" /> End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    min={startDate || new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-[#FD8566]/50 focus:ring-1 focus:ring-[#FD8566]/50 transition-all duration-300 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Protection Config Panel */}
          <div className={`glass rounded-3xl p-8 relative overflow-hidden transition-all duration-500 border ${isProtected ? "border-[#FD8566]/30 shadow-[0_0_40px_rgba(253,133,102,0.08)]" : "border-white/[0.06]"}`}>
            {/* Glowing corner if protected */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-[#FD8566]/10 rounded-full blur-[60px] pointer-events-none transition-opacity duration-700 ${isProtected ? "opacity-100" : "opacity-0"}`} />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between relative z-10 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl transition-colors duration-500 ${isProtected ? "bg-[#FD8566]/20 text-[#FD8566]" : "bg-white/5 text-[#8a8690]"}`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <h2 className={`text-lg font-medium transition-colors duration-500 ${isProtected ? "text-white glow-text" : "text-[#8a8690]"}`}>Pyth Safety Switch</h2>
                </div>
                <p className="text-[#8a8690] text-sm max-w-md leading-relaxed ml-11">
                  Auto-swap your unvested SUI to USDC via DeepBook V3 if the live Pyth oracle detects a price drop below your floor.
                </p>
              </div>
              
              <button
                onClick={() => setIsProtected(!isProtected)}
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-500 flex-shrink-0 ${isProtected ? "bg-[#FD8566] shadow-[0_0_15px_rgba(253,133,102,0.4)]" : "bg-white/10"}`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-500 shadow-md ${isProtected ? "translate-x-9" : "translate-x-1"}`} />
              </button>
            </div>

            <div className={`transition-all duration-500 overflow-hidden relative z-10 ${isProtected ? "max-h-40 mt-8 opacity-100" : "max-h-0 mt-0 opacity-0"}`}>
              <div className="pt-6 border-t border-white/[0.06] ml-11">
                <label className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#FD8566]" /> Strike Price Floor (USD per SUI)
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative w-full sm:w-64">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8690] font-medium">$</span>
                    <input
                      type="number"
                      value={strikePrice}
                      onChange={(e) => setStrikePrice(e.target.value)}
                      step="0.01"
                      min="0.01"
                      className="w-full bg-[#060608]/80 border border-[#FD8566]/30 hover:border-[#FD8566]/60 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-[#FD8566] focus:ring-1 focus:ring-[#FD8566]/50 transition-all duration-300 font-mono shadow-inner"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Receipt & Deploy */}
        <div ref={summaryRef} className="xl:col-span-4">
          <div className="glass rounded-3xl p-1 relative overflow-hidden sticky top-8">
            <div className="bg-[#0a0a0c]/40 rounded-[22px] p-6 lg:p-8 h-full border border-white/[0.02]">
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <Zap className="w-4 h-4 text-[#FD8566]" />
                </div>
                <h3 className="text-white font-medium text-lg">Transaction Summary</h3>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-end pb-4 border-b border-white/[0.06] border-dashed">
                  <span className="text-[#8a8690] text-sm">Escrow Amount</span>
                  <div className="text-right">
                    <span className="text-white text-xl font-display font-medium">{netAmount.toFixed(3)}</span>
                    <span className="text-[#8a8690] text-sm ml-1">SUI</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/[0.06] border-dashed">
                  <span className="text-[#8a8690] text-sm">Protection</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isProtected ? "bg-[#FD8566]/10 text-[#FD8566] border border-[#FD8566]/20" : "bg-white/5 text-[#8a8690] border border-white/10"}`}>
                    {isProtected ? "ACTIVE" : "OFF"}
                  </span>
                </div>
                {isProtected && (
                  <div className="flex justify-between items-center pb-4 border-b border-white/[0.06] border-dashed animate-in fade-in duration-300">
                    <span className="text-[#8a8690] text-sm">Strike Floor</span>
                    <span className="text-white font-mono text-sm">${strikePriceNum.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pb-2">
                  <span className="text-[#8a8690] text-sm">Oracle</span>
                  <span className="text-[#8a8690] text-sm flex items-center gap-1.5">
                    {isProtected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                    {isProtected ? "Pyth Network" : "None"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={isExecuting || !currentAccount || !amount || !recipient || !startDate || !endDate}
                className="group relative w-full bg-[#FD8566] hover:bg-white disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white hover:text-black font-semibold rounded-2xl py-4.5 flex items-center justify-center gap-2 transition-all duration-500 overflow-hidden"
              >
                {/* Button Hover Sweep Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
                
                {isExecuting ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign & Deploy</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </button>

              {txResult && (
                <div className="mt-5 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <p className="text-green-400 text-xs font-mono text-center flex flex-col gap-1">
                    <span className="font-semibold text-sm">✓ Transaction Confirmed</span>
                    <span className="opacity-80 truncate">{txResult}</span>
                  </p>
                </div>
              )}

              {!currentAccount && (
                <p className="text-center text-xs text-[#FD8566] mt-5 flex items-center justify-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Please connect your Sui wallet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
