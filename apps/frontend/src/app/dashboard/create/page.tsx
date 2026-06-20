"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, Zap, Lock, Calendar, User, Coins, TrendingDown } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import gsap from "gsap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  PEACH_PACKAGE_ID,
  PEACH_REGISTRY_ID,
  USDC_TYPE,
  HEDGE_FLOOR,
  PYTH_HERMES_BASE_URL,
  PYTH_SUI_USD_FEED_ID,
  PRESET_RETAIL,
  PRESET_CORPORATE,
  PRESET_INSTITUTIONAL,
} from "@/lib/constants";

export default function CreateStreamPage() {
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [riskDropPct, setRiskDropPct] = useState<number>(15);
  const [isExecuting, setIsExecuting] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [pythPrices, setPythPrices] = useState<Record<string, number>>({});
  const [estimatedFee, setEstimatedFee] = useState<number>(0);
  const [isDangerZone, setIsDangerZone] = useState<boolean>(false);
  const [twapPreset, setTwapPreset] = useState<number>(PRESET_CORPORATE);

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

  // Derived Spot Price (SUI/USD only)
  const pythSpotPrice = React.useMemo(() => {
    const suiFeedId = PYTH_SUI_USD_FEED_ID.replace('0x', '');
    return pythPrices[suiFeedId] || null;
  }, [pythPrices]);

  // Fetch SUI/USD price from Pyth
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const suiFeedId = PYTH_SUI_USD_FEED_ID.replace("0x", "");
        const res = await fetch(
          `${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${suiFeedId}&parsed=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        
        const newPrices: Record<string, number> = {};
        json?.parsed?.forEach((p: any) => {
          if (p?.price) {
            const priceUsd = parseFloat(p.price.price) * Math.pow(10, p.price.expo);
            newPrices[p.id] = priceUsd;
          }
        });
        setPythPrices(newPrices);
      } catch {
        /* ignore */
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Estimated Fee
  useEffect(() => {
    const val = parseFloat(amount || "0");
    if (val <= 0 || !pythSpotPrice) {
      setEstimatedFee(0);
      setIsDangerZone(false);
      return;
    }

    let baseBps = 50;
    if (val >= 10000) baseBps = 10;
    else if (val >= 5000) baseBps = 20;
    else if (val >= 1000) baseBps = 30;

    const derivedStrike = pythSpotPrice * (1 - riskDropPct / 100);

    let riskBps = 0;
    let danger = false;

    if (pythSpotPrice < derivedStrike * 1.05) { 
      riskBps = 150; 
      danger = true; 
    }

    setEstimatedFee((val * (baseBps + riskBps)) / 10000);
    setIsDangerZone(danger);
  }, [amount, riskDropPct, pythSpotPrice]);

  const handleCreate = async () => {
    if (!currentAccount || !amount || !recipient || !startDate || !endDate) return;

    const startTimeMs = startDate.getTime();
    const endTimeMs = endDate.getTime();

    if (startTimeMs < Date.now()) return toast("Start time cannot be in the past.", "error");
    if (endTimeMs <= startTimeMs) return toast("End time must be after start time.", "error");

    setIsExecuting(true);
    setTxResult(null);

    try {
      const txb = new Transaction();
      const amountInMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

      // Calculate dynamic strike based on risk level
      const derivedStrike = (pythSpotPrice || 0) * (1 - riskDropPct / 100);

      const strikePriceScaled = BigInt(Math.floor(derivedStrike * 100_000_000));
      const minLotMist = BigInt(0); // always use contract default

      const [streamCoin] = txb.splitCoins(txb.gas, [amountInMist]);

      txb.moveCall({
        target: `${PEACH_PACKAGE_ID}::peach_stream::create_stream`,
        typeArguments: [USDC_TYPE],
        arguments: [
          txb.pure.address(recipient),
          txb.pure.u64(BigInt(startTimeMs)),
          txb.pure.u64(BigInt(endTimeMs)),
          txb.pure.u64(strikePriceScaled),
          txb.pure.u8(HEDGE_FLOOR), // Always use floor
          txb.pure.u8(twapPreset),
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
  
  // Display variables for summary
  const derivedStrike = (pythSpotPrice || 0) * (1 - riskDropPct / 100);

  return (
    <div ref={containerRef} className="relative min-h-[calc(100vh-4rem)] p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* DatePicker Custom Styles for Dark Theme */}
      <style dangerouslySetInnerHTML={{__html: `
        .react-datepicker {
          background-color: #0d0d10 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 1rem !important;
          font-family: inherit !important;
          color: #e8e4df !important;
        }
        .react-datepicker__header {
          background-color: #060608 !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          border-top-left-radius: 1rem !important;
          border-top-right-radius: 1rem !important;
        }
        .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header {
          color: #e8e4df !important;
        }
        .react-datepicker__day {
          color: #8a8690 !important;
        }
        .react-datepicker__day:hover, .react-datepicker__time-name:hover {
          background-color: rgba(255,255,255,0.1) !important;
          border-radius: 0.5rem !important;
        }
        .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
          background-color: #FF8B5E !important;
          color: #000 !important;
          border-radius: 0.5rem !important;
        }
        .react-datepicker__time-container {
          border-left: 1px solid rgba(255,255,255,0.1) !important;
        }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item {
          color: #8a8690 !important;
        }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item:hover {
          background-color: rgba(255,255,255,0.1) !important;
        }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected {
          background-color: #FF8B5E !important;
          color: #000 !important;
        }
        .react-datepicker-popper {
          z-index: 9999 !important;
        }
        .react-datepicker__time-container, .react-datepicker__time {
          background-color: #0d0d10 !important;
        }
        .react-datepicker__triangle {
          display: none !important;
        }
      `}} />
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
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative z-20">
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

              {/* Asset Pair */}
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
                  <DatePicker
                    selected={startDate}
                    onChange={(date: Date | null) => setStartDate(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    minDate={new Date()}
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3.5 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E]/50 focus:ring-1 focus:ring-[#FF8B5E]/30 transition-all duration-300 text-sm"
                    placeholderText="Select start date & time"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#8a8690] flex items-center gap-2 ml-1 uppercase tracking-wider">
                    <Calendar size={12} /> End Time
                  </label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date: Date | null) => setEndDate(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    minDate={startDate || new Date()}
                    className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3.5 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E]/50 focus:ring-1 focus:ring-[#FF8B5E]/30 transition-all duration-300 text-sm"
                    placeholderText="Select end date & time"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Risk Level Slider */}
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-[#FF8B5E]/20 rounded-3xl p-8 relative z-10">
            <h2 className="text-base font-medium text-[#e8e4df] mb-2 flex items-center gap-2">
              <Shield size={16} className="text-[#FF8B5E]" />
              Risk Tolerance
            </h2>
            <p className="text-[#8a8690] text-xs mb-8 leading-relaxed">
              Slide to adjust your risk profile. We automatically deploy a downside protection "Floor" hedge. 
              Higher risk means the hedge only activates in extreme market crashes, reducing fees but increasing exposure.
            </p>

            <div className="relative mb-8 pt-4">
              <input 
                type="range" 
                min="5" 
                max="30" 
                step="0.1"
                value={riskDropPct}
                onChange={(e) => setRiskDropPct(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#FF8B5E]/30"
                style={{
                  background: `linear-gradient(to right, #FF8B5E ${((riskDropPct - 5) / 25) * 100}%, #141418 ${((riskDropPct - 5) / 25) * 100}%)`
                }}
              />
              <style dangerouslySetInnerHTML={{__html: `
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: #FF8B5E;
                  cursor: pointer;
                  box-shadow: 0 0 10px rgba(255,139,94,0.5);
                  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
                }
                input[type=range]::-webkit-slider-thumb:hover {
                  transform: scale(1.25);
                  box-shadow: 0 0 15px rgba(255,139,94,0.8);
                }
              `}} />
              <div className="flex justify-between mt-4 text-[10px] font-medium uppercase tracking-wider text-[#8a8690]">
                <span className={riskDropPct < 10 ? "text-[#FF8B5E] transition-colors" : "transition-colors"}>Low Risk (5%)</span>
                <span className={riskDropPct >= 10 && riskDropPct < 25 ? "text-[#FF8B5E] transition-colors" : "transition-colors"}>Medium Risk (15%)</span>
                <span className={riskDropPct >= 25 ? "text-[#FF8B5E] transition-colors" : "transition-colors"}>High Risk (30%)</span>
              </div>
            </div>

            <div className="bg-[#060608]/50 border border-[#FF8B5E]/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#8a8690] uppercase tracking-wider mb-1">Auto-Configured Strike Price</div>
                <div className="text-lg font-mono text-[#e8e4df]">${derivedStrike.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#8a8690] uppercase tracking-wider mb-1">Activation</div>
                <div className="text-sm font-medium text-[#FF8B5E] font-mono">
                  Spot drops {riskDropPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* TWAP Liquidation Speed */}
          <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative z-10">
            <h2 className="text-base font-medium text-[#e8e4df] mb-2 flex items-center gap-2">
              <Lock size={16} className="text-[#FF8B5E]" />
              Liquidation Speed
            </h2>
            <p className="text-[#8a8690] text-xs mb-6 leading-relaxed">
              When the hedge triggers, the unvested principal is converted to stablecoins in metered tranches
              to minimize market impact. Choose a speed matching your stream size.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTwapPreset(PRESET_RETAIL)}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-300 ${
                  twapPreset === PRESET_RETAIL
                    ? "border-[#FF8B5E]/60 bg-[#FF8B5E]/5"
                    : "border-white/[0.08] bg-[#060608]/50 hover:border-white/[0.15]"
                }`}
              >
                <div className="text-xs font-medium text-[#e8e4df] mb-1">Fast</div>
                <div className="text-[10px] text-[#8a8690]">3 tranches</div>
                <div className="text-[10px] text-[#8a8690]">15 min total</div>
                {twapPreset === PRESET_RETAIL && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF8B5E]" />
                )}
              </button>

              <button
                onClick={() => setTwapPreset(PRESET_CORPORATE)}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-300 ${
                  twapPreset === PRESET_CORPORATE
                    ? "border-[#FF8B5E]/60 bg-[#FF8B5E]/5"
                    : "border-white/[0.08] bg-[#060608]/50 hover:border-white/[0.15]"
                }`}
              >
                <div className="text-xs font-medium text-[#e8e4df] mb-1">Standard</div>
                <div className="text-[10px] text-[#8a8690]">5 tranches</div>
                <div className="text-[10px] text-[#8a8690]">1 hour total</div>
                {twapPreset === PRESET_CORPORATE && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF8B5E]" />
                )}
              </button>

              <button
                onClick={() => setTwapPreset(PRESET_INSTITUTIONAL)}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-300 ${
                  twapPreset === PRESET_INSTITUTIONAL
                    ? "border-[#FF8B5E]/60 bg-[#FF8B5E]/5"
                    : "border-white/[0.08] bg-[#060608]/50 hover:border-white/[0.15]"
                }`}
              >
                <div className="text-xs font-medium text-[#e8e4df] mb-1">Gradual</div>
                <div className="text-[10px] text-[#8a8690]">10 tranches</div>
                <div className="text-[10px] text-[#8a8690]">3 hours total</div>
                {twapPreset === PRESET_INSTITUTIONAL && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF8B5E]" />
                )}
              </button>
            </div>

            <div className="mt-4 text-[9px] text-[#8a8690] leading-relaxed px-1">
              Fast suits retail streams (&lt;1k SUI). Standard suits corporate payroll (1k-10k).
              Gradual suits institutional invoices (10k+) to minimize order-book impact.
            </div>
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
              <SummaryRow label="Auto-Strike Price" value={pythSpotPrice ? `$${derivedStrike.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "Fetching..."} accent={true} />
              <SummaryRow
                label="Minimum Trade Size"
                value="0.01 SUI"
              />
              <SummaryRow label="Price Oracle" value="Pyth Network" />
              <SummaryRow label="Liquidity" value="DeepBook V3" />
              <SummaryRow label="TWAP Preset" value={twapPreset === PRESET_RETAIL ? "Fast (3x5min)" : twapPreset === PRESET_CORPORATE ? "Standard (5x12min)" : "Gradual (10x18min)"} />
              
              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                <SummaryRow 
                  label="Protocol Fee (Estimated Max)" 
                  value={`${estimatedFee.toLocaleString(undefined, { maximumFractionDigits: 4 })} SUI`} 
                  accent={isDangerZone}
                />
                <div className="text-[9px] text-[#8a8690] leading-relaxed px-1">
                  Base fee tiers: 0.50% (&lt;1k SUI), 0.30% (&lt;5k), 0.20% (&lt;10k), 0.10% (&gt;=10k).
                  {isDangerZone && (
                    <span className="text-[#FF8B5E] block mt-1">
                      ⚠️ Spot price is within 5% of strike. A 1.50% Risk Premium is currently active.
                    </span>
                  )}
                </div>
              </div>
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
