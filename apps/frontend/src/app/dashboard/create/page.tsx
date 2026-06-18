"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, Zap, Lock, Calendar, User, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import gsap from "gsap";
import {
  PEACH_PACKAGE_ID,
  PEACH_REGISTRY_ID,
  USDC_TYPE,
  HEDGE_FLOOR,
  HEDGE_CEILING,
  HEDGE_NONE,
} from "@/lib/constants";

export default function CreateStreamPage() {
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hedgeDirection, setHedgeDirection] = useState<number>(HEDGE_FLOOR);
  const [strikePrice, setStrikePrice] = useState("1.00");
  const [minLotSize, setMinLotSize] = useState(""); // empty = use default
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

      // Strike price: 0 if HEDGE_NONE, otherwise user value scaled to 8 decimals
      const strikePriceScaled =
        hedgeDirection === HEDGE_NONE
          ? BigInt(0)
          : BigInt(Math.floor(parseFloat(strikePrice) * 100_000_000));

      // Min lot size: 0 means use contract default (0.01 SUI)
      const minLotMist = minLotSize
        ? BigInt(Math.floor(parseFloat(minLotSize) * 1_000_000_000))
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
          txb.pure.u8(hedgeDirection),
          txb.pure.u64(minLotMist),
          streamCoin,
          txb.object(PEACH_REGISTRY_ID),
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
  const isProtected = hedgeDirection !== HEDGE_NONE;

  return (
    <div ref={containerRef} className="relative min-h-[calc(100vh-4rem)] p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div ref={headerRef} className="mb-10 relative z-10">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">
          Deploy Stream
        </h1>
        <p className="text-[#8a8690] max-w-xl text-sm leading-relaxed">
          Initialize a self-hedging payment stream. Choose a protection mode to automatically
          insulate value against market volatility via Pyth + DeepBook V3.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-10">
        {/* Left Column: Form */}
        <div ref={formRef} className="xl:col-span-8 space-y-6">

          {/* Stream Config */}
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8">
            <h2 className="text-base font-medium text-[#e8e4df] mb-6 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#FF8B5E] rounded-full inline-block" />
              Stream Details
            </h2>

            <div className="space-y-5">
              {/* Recipient */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                  <User size={12} /> Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3.5 text-[#e8e4df] placeholder:text-[#8a8690]/40 focus:outline-none focus:border-[#FF8B5E]/50 focus:ring-1 focus:ring-[#FF8B5E]/30 transition-all duration-300 font-mono text-sm"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                  <Coins size={12} /> Total Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl pl-5 pr-16 py-3.5 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E]/50 focus:ring-1 focus:ring-[#FF8B5E]/30 transition-all duration-300 text-xl font-display"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#8a8690] font-mono">
                    SUI
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                    <Calendar size={12} /> Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E]/50 transition-all duration-300 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                    <Calendar size={12} /> End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    min={startDate || new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E]/50 transition-all duration-300 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hedge Direction Selector */}
          <div className={`bg-[#0d0d10]/60 backdrop-blur-xl rounded-3xl p-8 transition-all duration-500 border ${isProtected ? "border-[#FF8B5E]/20" : "border-white/5"}`}>
            <h2 className="text-base font-medium text-[#e8e4df] mb-2 flex items-center gap-2">
              <Shield size={16} className={isProtected ? "text-[#FF8B5E]" : "text-[#8a8690]"} />
              Protection Mode
            </h2>
            <p className="text-[#8a8690] text-xs mb-6 leading-relaxed">
              Select a hedge direction based on your use case. The contract will automatically
              swap to USDC via DeepBook V3 when the Pyth oracle price crosses your strike.
            </p>

            {/* Direction Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => setHedgeDirection(HEDGE_FLOOR)}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
                  hedgeDirection === HEDGE_FLOOR
                    ? "bg-[#FF8B5E]/10 border-[#FF8B5E]/30 ring-1 ring-[#FF8B5E]/20"
                    : "bg-[#060608]/50 border-white/5 hover:border-white/10"
                }`}
              >
                <TrendingDown size={18} className={hedgeDirection === HEDGE_FLOOR ? "text-[#FF8B5E] mb-2" : "text-[#8a8690] mb-2"} />
                <div className="text-sm font-medium text-[#e8e4df] mb-1">Floor (Payroll)</div>
                <div className="text-[10px] text-[#8a8690] leading-relaxed">
                  Hedge when price drops below strike. Protects employee purchasing power.
                </div>
              </button>

              <button
                onClick={() => setHedgeDirection(HEDGE_CEILING)}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
                  hedgeDirection === HEDGE_CEILING
                    ? "bg-[#FF8B5E]/10 border-[#FF8B5E]/30 ring-1 ring-[#FF8B5E]/20"
                    : "bg-[#060608]/50 border-white/5 hover:border-white/10"
                }`}
              >
                <TrendingUp size={18} className={hedgeDirection === HEDGE_CEILING ? "text-[#FF8B5E] mb-2" : "text-[#8a8690] mb-2"} />
                <div className="text-sm font-medium text-[#e8e4df] mb-1">Ceiling (Supply-Chain)</div>
                <div className="text-[10px] text-[#8a8690] leading-relaxed">
                  Hedge when price rises above strike. Protects buyer material costs.
                </div>
              </button>

              <button
                onClick={() => setHedgeDirection(HEDGE_NONE)}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
                  hedgeDirection === HEDGE_NONE
                    ? "bg-white/5 border-white/15 ring-1 ring-white/10"
                    : "bg-[#060608]/50 border-white/5 hover:border-white/10"
                }`}
              >
                <Zap size={18} className={hedgeDirection === HEDGE_NONE ? "text-[#e8e4df] mb-2" : "text-[#8a8690] mb-2"} />
                <div className="text-sm font-medium text-[#e8e4df] mb-1">None (Raw Stream)</div>
                <div className="text-[10px] text-[#8a8690] leading-relaxed">
                  No hedging. Stream raw SUI directly with no oracle protection.
                </div>
              </button>
            </div>

            {/* Strike Price + Min Lot (shown when protected) */}
            {isProtected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                    <Lock size={12} /> Strike Price (USD/SUI)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8690]">$</span>
                    <input
                      type="number"
                      value={strikePrice}
                      onChange={(e) => setStrikePrice(e.target.value)}
                      step="0.01"
                      min="0.01"
                      className="w-full bg-[#060608]/80 border border-[#FF8B5E]/20 hover:border-[#FF8B5E]/40 rounded-xl pl-8 pr-4 py-3 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E] transition-all duration-300 font-mono text-sm"
                    />
                  </div>
                  <p className="text-[9px] text-[#8a8690] ml-1">
                    {hedgeDirection === HEDGE_FLOOR ? "Hedge fires when spot < this price" : "Hedge fires when spot > this price"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                    Min Lot Size (SUI)
                  </label>
                  <input
                    type="number"
                    value={minLotSize}
                    onChange={(e) => setMinLotSize(e.target.value)}
                    step="0.001"
                    min="0"
                    placeholder="0.01 (default)"
                    className="w-full bg-[#060608]/80 border border-white/[0.08] hover:border-white/[0.15] rounded-xl px-4 py-3 text-[#e8e4df] placeholder:text-[#8a8690]/40 focus:outline-none focus:border-[#FF8B5E]/50 transition-all duration-300 font-mono text-sm"
                  />
                  <p className="text-[9px] text-[#8a8690] ml-1">
                    Sub-lot claims buffer until this threshold. Leave empty for default.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summary & Deploy */}
        <div ref={summaryRef} className="xl:col-span-4">
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sticky top-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Zap size={14} className="text-[#FF8B5E]" />
              </div>
              <h3 className="text-[#e8e4df] font-medium">Transaction Summary</h3>
            </div>

            <div className="space-y-3 mb-6">
              <SummaryRow label="Escrow Amount" value={`${netAmount.toFixed(3)} SUI`} />
              <SummaryRow
                label="Protection"
                value={
                  hedgeDirection === HEDGE_FLOOR ? "Floor (Payroll)" :
                  hedgeDirection === HEDGE_CEILING ? "Ceiling (Supply)" : "None"
                }
                accent={isProtected}
              />
              {isProtected && (
                <>
                  <SummaryRow label="Strike" value={`$${strikePriceNum.toFixed(2)}`} />
                  <SummaryRow
                    label="Direction"
                    value={hedgeDirection === HEDGE_FLOOR ? "Spot < Strike → Swap" : "Spot > Strike → Swap"}
                  />
                </>
              )}
              <SummaryRow
                label="Min Lot"
                value={minLotSize ? `${parseFloat(minLotSize).toFixed(3)} SUI` : "0.01 SUI (default)"}
              />
              <SummaryRow label="Oracle" value={isProtected ? "Pyth Network" : "None"} />
              <SummaryRow label="DEX" value={isProtected ? "DeepBook V3" : "None"} />
            </div>

            <button
              onClick={handleCreate}
              disabled={isExecuting || !currentAccount || !amount || !recipient || !startDate || !endDate}
              className="w-full bg-[#FF8B5E] hover:bg-[#FFB088] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-black font-semibold rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors duration-300"
            >
              {isExecuting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign & Deploy</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {txResult && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 text-xs font-mono text-center flex flex-col gap-1">
                  <span className="font-semibold text-sm">Transaction Confirmed</span>
                  <span className="opacity-80 truncate">{txResult}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-[#8a8690]">{label}</span>
      <span className={`text-xs font-mono ${accent ? "text-[#FF8B5E]" : "text-[#e8e4df]"}`}>{value}</span>
    </div>
  );
}
