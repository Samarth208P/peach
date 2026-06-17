"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Buffer } from "buffer";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";
import { HermesClient } from "@pythnetwork/hermes-client";
import { useToast } from "@/components/ToastProvider";

import { 
  PEACH_PACKAGE_ID, 
  DEEPBOOK_SUI_USDC_POOL_ID, 
  DEEP_TOKEN_TYPE, 
  USDC_TYPE, 
  SUI_CLOCK_OBJECT_ID,
  PYTH_HERMES_BASE_URL,
  PYTH_SUI_USD_FEED_ID,
  PYTH_STATE_ID,
  WORMHOLE_STATE_ID
} from "@/lib/constants";

interface StreamConfig {
  id: string;
  type: "inbound" | "outbound" | "self";
  targetValue: number;
  durationSeconds: number;
  elapsedSeconds: number;
  startTimeMs: number;
  endTimeMs: number;
  sender: string;
  receiver: string;
}

export default function TickingStreamRow({ config }: { config: StreamConfig }) {
  const [balance, setBalance] = useState(() => {
    const velocity = config.targetValue / config.durationSeconds;
    const now = Date.now();
    const elapsed = Math.max(0, Math.min(now - config.startTimeMs, config.endTimeMs - config.startTimeMs)) / 1000;
    return elapsed * velocity;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const preparePythUpdate = async (tx: Transaction) => {
    const hermes = new HermesClient(PYTH_HERMES_BASE_URL, {});
    const priceUpdates = await hermes.getLatestPriceUpdates([PYTH_SUI_USD_FEED_ID]);
    const bufferUpdates = priceUpdates.binary.data.map((hex: string) => Buffer.from(hex, 'hex'));
    
    const pythClient = new SuiPythClient(suiClient as any, PYTH_STATE_ID, WORMHOLE_STATE_ID);
    
    // Check if feed exists on-chain
    let objectId = await pythClient.getPriceFeedObjectId(PYTH_SUI_USD_FEED_ID);
    
    if (!objectId) {
      console.log("Price feed does not exist. Initializing oracle feed on-chain...");
      const initTx = new Transaction();
      await pythClient.createPriceFeed(initTx as any, bufferUpdates);
      await signAndExecuteTransaction({ transaction: initTx });
      
      console.log("Oracle initialized! Waiting for RPC sync...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Refetch object ID
      objectId = await pythClient.getPriceFeedObjectId(PYTH_SUI_USD_FEED_ID);
      if (!objectId) throw new Error("Failed to retrieve newly created PriceFeed ObjectId");
    }
    
    const priceInfoObjectIds = await pythClient.updatePriceFeeds(tx as any, bufferUpdates, [PYTH_SUI_USD_FEED_ID]);
    return priceInfoObjectIds[0];
  };

  const executeClaimTransaction = async (streamObjectId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const tx = new Transaction();
      
      const priceInfoObjectId = await preparePythUpdate(tx);

      const deepCoin = tx.moveCall({
        target: "0x2::coin::zero",
        typeArguments: [DEEP_TOKEN_TYPE],
      });

      tx.moveCall({
        target: `${PEACH_PACKAGE_ID}::peach_stream::claim_stream`,
        arguments: [
          tx.object(streamObjectId),
          tx.object(priceInfoObjectId),
          tx.object(DEEPBOOK_SUI_USDC_POOL_ID),
          deepCoin,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [USDC_TYPE],
      });

      await signAndExecuteTransaction({ transaction: tx });
      toast("Stream claimed successfully.", "success");
    } catch (e) {
      console.error("Claim Failed", e);
      toast("Claim failed. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeCancelTransaction = async (streamObjectId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const tx = new Transaction();
      
      const priceInfoObjectId = await preparePythUpdate(tx);

      const deepCoin = tx.moveCall({
        target: "0x2::coin::zero",
        typeArguments: [DEEP_TOKEN_TYPE],
      });

      tx.moveCall({
        target: `${PEACH_PACKAGE_ID}::peach_stream::cancel_stream`,
        arguments: [
          tx.object(streamObjectId),
          tx.object(priceInfoObjectId),
          tx.object(DEEPBOOK_SUI_USDC_POOL_ID),
          deepCoin,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [USDC_TYPE],
      });

      await signAndExecuteTransaction({ transaction: tx });
      toast("Stream cancelled. Funds returned.", "success");
    } catch (e) {
      console.error("Cancel Failed", e);
      toast("Cancel failed. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };
  
  useEffect(() => {
    const velocity = config.targetValue / config.durationSeconds;

    let animationFrameId: number;
    const tick = () => {
      const currentNow = Date.now();
      
      if (currentNow < config.startTimeMs) {
        // Hasn't started yet, keep checking
        animationFrameId = requestAnimationFrame(tick);
        return;
      }
      
      const elapsed = Math.max(0, Math.min(currentNow - config.startTimeMs, config.endTimeMs - config.startTimeMs)) / 1000;
      const currentBalance = elapsed * velocity;
      
      setBalance(currentBalance);
      
      if (currentNow < config.endTimeMs) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        setBalance(config.targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [config.targetValue, config.durationSeconds, config.startTimeMs, config.endTimeMs]);

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
                disabled={isProcessing}
                className="px-4 py-1.5 bg-[#FF8B5E] text-[#060608] text-xs font-semibold tracking-wide rounded-lg hover:bg-[#FF8B5E]/90 transition-colors shadow-[0_0_15px_rgba(255,139,94,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Processing..." : "Claim"}
              </button>
            )}
            {(config.type === "outbound" || config.type === "self") && (
              <button 
                onClick={() => executeCancelTransaction(config.id)}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-[#0d0d10] border border-white/5 text-[#e8e4df] text-xs font-medium rounded-lg hover:bg-[#141418] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Processing..." : "Cancel"}
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
