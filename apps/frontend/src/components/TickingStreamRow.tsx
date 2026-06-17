"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";

import { 
  PEACH_PACKAGE_ID, 
  PYTH_SUI_USD_PRICE_INFO_OBJECT_ID, 
  DEEPBOOK_SUI_USDC_POOL_ID, 
  DEEP_TOKEN_TYPE, 
  USDC_TYPE, 
  SUI_CLOCK_OBJECT_ID 
} from "@/lib/constants";

interface StreamConfig {
  id: string;
  type: "inbound" | "outbound" | "self";
  targetValue: number;
  durationSeconds: number;
  elapsedSeconds: number;
  sender: string;
  receiver: string;
}

export default function TickingStreamRow({ config }: { config: StreamConfig }) {
  const [balance, setBalance] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const initialValueRef = useRef<number>(0);
  
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const executeClaimTransaction = async (streamObjectId: string) => {
    const tx = new Transaction();

    const deepCoin = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [DEEP_TOKEN_TYPE],
    });

    tx.moveCall({
      target: `${PEACH_PACKAGE_ID}::peach_stream::claim_stream`,
      arguments: [
        tx.object(streamObjectId),
        tx.object(PYTH_SUI_USD_PRICE_INFO_OBJECT_ID),
        tx.object(DEEPBOOK_SUI_USDC_POOL_ID),
        deepCoin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [USDC_TYPE],
    });

    try {
      await signAndExecuteTransaction({ transaction: tx });
      console.log("Claim Successful");
    } catch (e) {
      console.error("Claim Failed", e);
    }
  };

  const executeCancelTransaction = async (streamObjectId: string) => {
    const tx = new Transaction();

    const deepCoin = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [DEEP_TOKEN_TYPE],
    });

    tx.moveCall({
      target: `${PEACH_PACKAGE_ID}::peach_stream::cancel_stream`,
      arguments: [
        tx.object(streamObjectId),
        tx.object(PYTH_SUI_USD_PRICE_INFO_OBJECT_ID),
        tx.object(DEEPBOOK_SUI_USDC_POOL_ID),
        deepCoin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [USDC_TYPE],
    });

    try {
      await signAndExecuteTransaction({ transaction: tx });
      console.log("Cancel Successful");
    } catch (e) {
      console.error("Cancel Failed", e);
    }
  };
  
  useEffect(() => {
    // Reset start time on effect run
    startTimeRef.current = null;
    
    // Initial value based on elapsed seconds
    const velocity = config.targetValue / config.durationSeconds;
    initialValueRef.current = config.elapsedSeconds * velocity;
    setBalance(initialValueRef.current);

    let animationFrameId: number;
    const tick = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      
      const elapsedMs = timestamp - startTimeRef.current;
      const additionalValue = (velocity * elapsedMs) / 1000;
      
      const currentBalance = initialValueRef.current + additionalValue;
      if (currentBalance < config.targetValue) {
        setBalance(currentBalance);
        animationFrameId = requestAnimationFrame(tick);
      } else {
        setBalance(config.targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [config.targetValue, config.durationSeconds, config.elapsedSeconds]);

  const percentage = Math.min((balance / config.targetValue) * 100, 100);

  return (
    <div className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col gap-5 hover:bg-[#141418] hover:scale-[1.005] transition-all duration-500 ease-out">
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
            {config.type === 'inbound' ? <ArrowDownLeft size={18} strokeWidth={1.5} /> : 
             config.type === 'self' ? <RefreshCw size={18} strokeWidth={1.5} /> :
             <ArrowUpRight size={18} strokeWidth={1.5} />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[#e8e4df] text-sm font-medium">SUI Stream</span>
              <span className="bg-[#141418] border border-[#FF8B5E]/20 text-[#FF8B5E] text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest">
                <ShieldCheck size={10} /> Protected
              </span>
            </div>
            <div className="text-[11px] text-[#8a8690]/70 font-mono mt-1 tracking-wider">
              {config.sender.substring(0, 6)}...{config.sender.slice(-4)} → {config.receiver.substring(0, 6)}...{config.receiver.slice(-4)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl text-[#e8e4df] font-mono tracking-tight">
            {balance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SUI
          </div>
          <div className="text-[11px] text-[#8a8690] mt-1 mb-3">
            of {config.targetValue.toLocaleString()} SUI Total
          </div>
          <div className="flex justify-end gap-2">
            {(config.type === "inbound" || config.type === "self") && (
              <button 
                onClick={() => executeClaimTransaction(config.id)}
                className="px-4 py-1.5 bg-[#FF8B5E] text-[#060608] text-xs font-semibold tracking-wide rounded-lg hover:bg-[#FF8B5E]/90 transition-colors shadow-[0_0_15px_rgba(255,139,94,0.15)]"
              >
                Claim
              </button>
            )}
            {(config.type === "outbound" || config.type === "self") && (
              <button 
                onClick={() => executeCancelTransaction(config.id)}
                className="px-4 py-1.5 bg-[#0d0d10] border border-white/5 text-[#e8e4df] text-xs font-medium rounded-lg hover:bg-[#141418] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-1 bg-[#141418] rounded-full overflow-hidden relative">
        <div 
          className="absolute top-0 left-0 h-full bg-[#FF8B5E] rounded-full transition-all duration-75 ease-linear shadow-[0_0_8px_rgba(255,139,94,0.4)]"
          style={{ width: `${percentage}%` }}
        />
      </div>

    </div>
  );
}
