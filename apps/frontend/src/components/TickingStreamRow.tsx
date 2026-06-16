"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";

const PACKAGE_ID = "0x23b6f040c2c08d3d4b692d48d2c1f9826148a57893098f7d143458f2953763bc";
const DEEPBOOK_PREDICT_POOL_ID = "0x4c926249761de71fae516c0305481da3aa38f9439b1f27c933b8bbc613352243";
const OPTION_USDC_TYPE = "0x2::sui::SUI";
const ORACLE_SVI_TESTNET_OBJECT_ID = "0xb79189c195876000b9de26caf42279766f3ab9c7b1b5c4764887e04b406b5b06";

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

    tx.moveCall({
      target: `${PACKAGE_ID}::peach_stream::claim_stream`,
      arguments: [
        tx.object(streamObjectId),                     // Target Shared Stream Object
        tx.object(DEEPBOOK_PREDICT_POOL_ID),          // DeepBook Predict Pool ID
        tx.object(ORACLE_SVI_TESTNET_OBJECT_ID),       // OracleSVI Object Pointer
        tx.object("0x6"),                              // System Clock
      ],
      typeArguments: [OPTION_USDC_TYPE],
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

    tx.moveCall({
      target: `${PACKAGE_ID}::peach_stream::cancel_stream`,
      arguments: [
        tx.object(streamObjectId),                     // Shared Object consumed by value
        tx.object(DEEPBOOK_PREDICT_POOL_ID),          
        tx.object(ORACLE_SVI_TESTNET_OBJECT_ID),   
        tx.object("0x6"),                              
      ],
      typeArguments: [OPTION_USDC_TYPE],
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
    <div className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-4 hover:bg-white/[0.04] transition-colors duration-300">
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${
            config.type === 'inbound' ? 'bg-green-500/10 text-green-400' : 
            config.type === 'self' ? 'bg-blue-500/10 text-blue-400' :
            'bg-[#FD8566]/10 text-[#FD8566]'
          }`}>
            {config.type === 'inbound' ? <ArrowDownLeft size={20} /> : 
             config.type === 'self' ? <RefreshCw size={20} /> :
             <ArrowUpRight size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">SUI Stream</span>
              <span className="bg-[#FD8566] text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wide">
                <ShieldCheck size={12} /> Protected
              </span>
            </div>
            <div className="text-xs text-[#8a8690] font-mono mt-1">
              {config.sender.substring(0, 6)}...{config.sender.slice(-4)} → {config.receiver.substring(0, 6)}...{config.receiver.slice(-4)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl text-white font-mono tracking-tight">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
          </div>
          <div className="text-xs text-[#8a8690] mt-1 mb-3">
            of ${config.targetValue.toLocaleString()}
          </div>
          <div className="flex justify-end gap-2">
            {(config.type === "inbound" || config.type === "self") && (
              <button 
                onClick={() => executeClaimTransaction(config.id)}
                className="px-3 py-1 bg-[#FD8566]/10 text-[#FD8566] text-xs font-medium rounded hover:bg-[#FD8566]/20 transition-colors"
              >
                Claim
              </button>
            )}
            {(config.type === "outbound" || config.type === "self") && (
              <button 
                onClick={() => executeCancelTransaction(config.id)}
                className="px-3 py-1 bg-white/5 text-white/70 text-xs font-medium rounded hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-1.5 bg-black rounded-full overflow-hidden relative">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/20 to-[#FD8566] rounded-full transition-all duration-75 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>

    </div>
  );
}
