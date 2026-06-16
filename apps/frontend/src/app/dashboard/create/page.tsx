"use client";

import React, { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, Zap, CheckCircle2 } from "lucide-react";

const PACKAGE_ID = "0xfeded63bda28be37a34d937fe8dfe8c294596a26f4c9805128812edfd085c025";
const DEEPBOOK_SPOT_POOL_ID = "0x7f23e4215286561ba08d4b29bb887565a44848d73b06103faee202df3b9df728";
const DEEPBOOK_PREDICT_POOL_ID = "0x3b1cfc560205d12a23bb800bc19e342718a3d58de41bb33cf517d925e01ba062";
const OPTION_USDC_TYPE = "0x0111111111111111111111111111111111111111111111111111111111111111::db_usdc::DB_USDC";

export default function CreateStreamPage() {
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isProtected, setIsProtected] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const router = useRouter();

  React.useEffect(() => {
    if (!currentAccount) {
      router.push('/login');
    }
  }, [currentAccount, router]);

  const handleCreate = async () => {
    if (!currentAccount || !amount || !recipient || !startDate || !endDate) return;
    setIsExecuting(true);

    try {
      const txb = new Transaction();
      
      const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);
      const startTimeMs = new Date(startDate).getTime();
      const endTimeMs = new Date(endDate).getTime();
      const currentStrikePrice = 1_000_000; // Example fixed strike price for testnet
      
      let streamCoin;
      
      if (isProtected) {
        const premiumAmount = Math.floor(amountInMist * 0.01);
        const netStreamAmount = amountInMist - premiumAmount;
        
        const [baseCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(amountInMist)]);
        const [premiumSuiCoin, streamSui] = txb.splitCoins(baseCoin, [
          txb.pure.u64(premiumAmount),
          txb.pure.u64(netStreamAmount),
        ]);
        
        // DeepBook V3 Spot Swap (Convert SUI to USDC)
        const [swappedUsdcCoin] = txb.moveCall({
          target: `deepbook::clob_v3::swap_exact_base_for_quote`,
          arguments: [
            txb.object(DEEPBOOK_SPOT_POOL_ID),
            premiumSuiCoin,
            txb.pure.u64(0),
            txb.object("0x6"),
          ],
          typeArguments: [OPTION_USDC_TYPE],
        });

        // Initialize self-hedged Peach Stream Object state
        txb.moveCall({
          target: `${PACKAGE_ID}::peach_stream::create_stream`,
          arguments: [
            txb.pure.address(recipient),
            txb.pure.u64(startTimeMs),
            txb.pure.u64(endTimeMs),
            txb.pure.u64(currentStrikePrice),
            streamSui,       
            swappedUsdcCoin,     
            txb.object(DEEPBOOK_PREDICT_POOL_ID),
          ],
          typeArguments: [OPTION_USDC_TYPE],
        });
      } else {
        const [stream] = txb.splitCoins(txb.gas, [BigInt(amountInMist)]);
        
        // Non-hedged streams wouldn't use this new method, but for compatibility if it is toggled off, 
        // we would route to the old create_stream without USDC, or require USDC = 0 (dust). 
        // For simplicity, we just pass empty USDC or handle appropriately, but we assume it's protected for this demo.
        txb.moveCall({
          target: `${PACKAGE_ID}::peach_stream::create_stream_unprotected`, // Assuming an unprotected version exists, or error out
          arguments: [
            txb.pure.address(recipient),
            txb.pure.u64(startTimeMs),
            txb.pure.u64(endTimeMs),
            stream
          ]
        });
      }

      const result = await signAndExecuteTransaction({
        transaction: txb,
      });

      console.log("Success:", result);
      router.push("/dashboard");
    } catch (e) {
      console.error("PTB Execution Failed:", e);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-3xl text-white font-display font-medium tracking-tight mb-2">Create New Stream</h1>
        <p className="text-[#8a8690]">Configure a continuous payment stream with optional downside protection.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/[0.04] rounded-3xl p-6">
            <h2 className="text-lg font-medium text-white mb-6">Stream Configuration</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-[#8a8690] mb-2">Recipient Address</label>
                <input 
                  type="text" 
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#060608] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FD8566]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8a8690] mb-2">Total Amount (SUI)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#060608] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FD8566]/50 transition-colors text-2xl font-display"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#3898FF] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">SUI</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#8a8690] mb-2">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#060608] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FD8566]/50 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8a8690] mb-2">End Time</label>
                  <input 
                    type="datetime-local" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#060608] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FD8566]/50 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-[#FD8566]/20 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FD8566]/5 rounded-full blur-[60px] pointer-events-none" />
            
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-[#FD8566]" />
                  <h2 className="text-lg font-medium text-white">Price Safety Switch</h2>
                </div>
                <p className="text-[#8a8690] text-sm max-w-sm">
                  Automatically route a 1% micro-premium into DeepBook Predict to hedge against SUI volatility during the stream duration.
                </p>
              </div>
              
              <button 
                onClick={() => setIsProtected(!isProtected)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 ${isProtected ? 'bg-[#FD8566]' : 'bg-white/10'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${isProtected ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/[0.04] rounded-3xl p-6">
            <h2 className="text-lg font-medium text-white mb-6">Summary</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center pb-4 border-b border-white/[0.04]">
                <span className="text-[#8a8690]">Recipient gets</span>
                <span className="text-white font-medium">{isProtected ? (parseFloat(amount || "0") * 0.99).toFixed(2) : amount} SUI</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/[0.04]">
                <span className="text-[#8a8690]">Premium (1%)</span>
                <span className="text-[#FD8566] font-medium">{isProtected ? (parseFloat(amount || "0") * 0.01).toFixed(2) : "0.00"} SUI</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#8a8690]">Total Deposit</span>
                <span className="text-white font-display text-xl">{amount || "0"} SUI</span>
              </div>
            </div>

            <button 
              onClick={handleCreate}
              disabled={isExecuting || !currentAccount || !amount || !recipient || !startDate || !endDate}
              className="w-full bg-[#FD8566] hover:bg-[#ff957a] disabled:opacity-50 text-white font-medium rounded-xl py-4 flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(253,133,102,0.3)]"
            >
              {isExecuting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Create Stream</span>
                </>
              )}
            </button>
            
            {!currentAccount && (
              <p className="text-center text-xs text-[#FD8566] mt-4">Wallet disconnected. Please connect to continue.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
