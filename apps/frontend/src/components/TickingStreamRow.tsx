"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Shield, RefreshCw } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Buffer } from "buffer";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";
import { HermesClient } from "@pythnetwork/hermes-client";
import { useToast } from "@/components/ToastProvider";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import {
  PEACH_PACKAGE_ID,
  PEACH_REGISTRY_ID,
  DEEPBOOK_SUI_USDC_POOL_ID,
  DEEP_TOKEN_TYPE,
  USDC_TYPE,
  SUI_CLOCK_OBJECT_ID,
  PYTH_HERMES_BASE_URL,
  PYTH_SUI_USD_FEED_ID,
  PYTH_STATE_ID,
  WORMHOLE_STATE_ID,
  COIN_ZERO_TARGET,
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
  strikePrice?: number;
  hedgeDirection?: number;
  hedgeTriggered?: boolean;
  withdrawn?: number;
  // v2 dual-asset state machine fields
  liquidationStatus?: number; // 0=HEALTHY, 1=TWAP_ACTIVE, 2=FULLY_HEDGED
  twapTranches?: number;
  tranchesExecuted?: number;
  usdcBalance?: number;
  suiBalance?: number;
}

export default function TickingStreamRow({ config, pythSpotPrice = 0 }: { config: StreamConfig; pythSpotPrice?: number }) {
  const [balance, setBalance] = useState(() => {
    const velocity = config.targetValue / config.durationSeconds;
    const now = Date.now();
    const elapsed = Math.max(0, Math.min(now - config.startTimeMs, config.endTimeMs - config.startTimeMs)) / 1000;
    return elapsed * velocity;
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const flowBgRef = useRef<HTMLDivElement>(null);

  const [hasStarted, setHasStarted] = useState(() => Date.now() >= config.startTimeMs);

  gsap.registerPlugin(useGSAP);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const preparePythUpdate = async (tx: Transaction) => {
    const feedId = PYTH_SUI_USD_FEED_ID.replace("0x", "");
    const hermes = new HermesClient(PYTH_HERMES_BASE_URL, {});
    const priceUpdates = await hermes.getLatestPriceUpdates([feedId]);
    const bufferUpdates = priceUpdates.binary.data.map((hex: string) => Buffer.from(hex, "hex"));

    const pythClient = new SuiPythClient(suiClient as any, PYTH_STATE_ID, WORMHOLE_STATE_ID);

    let objectId = await pythClient.getPriceFeedObjectId(feedId);

    if (!objectId) {
      const initTx = new Transaction();
      await pythClient.createPriceFeed(initTx as any, bufferUpdates);
      await signAndExecuteTransaction({ transaction: initTx });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      objectId = await pythClient.getPriceFeedObjectId(feedId);
      if (!objectId) throw new Error("Failed to retrieve PriceFeed ObjectId");
    }

    const priceInfoObjectIds = await pythClient.updatePriceFeeds(tx as any, bufferUpdates, [feedId]);
    return priceInfoObjectIds[0];
  };

  const executeClaimTransaction = async (streamObjectId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const tx = new Transaction();
      const priceInfoObjectId = await preparePythUpdate(tx);

      const deepCoin = tx.moveCall({
        target: COIN_ZERO_TARGET,
        typeArguments: [DEEP_TOKEN_TYPE],
      });

      tx.moveCall({
        target: `${PEACH_PACKAGE_ID}::peach_stream::claim_stream`,
        arguments: [
          tx.object(streamObjectId),
          tx.object(priceInfoObjectId),
          tx.object(DEEPBOOK_SUI_USDC_POOL_ID),
          deepCoin,
          tx.object(PEACH_REGISTRY_ID),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [USDC_TYPE],
      });

      await signAndExecuteTransaction({ transaction: tx });
      toast("Stream claimed successfully.", "success");
    } catch (e: any) {
      console.error("Claim Failed", e);
      toast(`Claim failed: ${e?.message ?? "Unknown error"}`, "error");
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
        target: COIN_ZERO_TARGET,
        typeArguments: [DEEP_TOKEN_TYPE],
      });

      tx.moveCall({
        target: `${PEACH_PACKAGE_ID}::peach_stream::cancel_stream`,
        arguments: [
          tx.object(streamObjectId),
          tx.object(priceInfoObjectId),
          tx.object(DEEPBOOK_SUI_USDC_POOL_ID),
          deepCoin,
          tx.object(PEACH_REGISTRY_ID),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [USDC_TYPE],
      });

      await signAndExecuteTransaction({ transaction: tx });
      toast("Stream cancelled. SalvageVault sent to treasury.", "success");
    } catch (e: any) {
      console.error("Cancel Failed", e);
      toast(`Cancel failed: ${e?.message ?? "Unknown error"}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const velocity = config.targetValue / config.durationSeconds;
    let animationFrameId: number;

    const tick = () => {
      const currentNow = Date.now();

      if (currentNow >= config.startTimeMs && !hasStarted) {
        setHasStarted(true);
      }

      if (currentNow < config.startTimeMs) {
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
  }, [config.targetValue, config.durationSeconds, config.startTimeMs, config.endTimeMs, hasStarted]);

  // Dynamic fee calculation mirroring the smart contract
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [isDangerZone, setIsDangerZone] = useState(false);
  const [willHedge, setWillHedge] = useState(false);

  const unclaimed = Math.max(0, balance - (config.withdrawn || 0));

  useEffect(() => {
    let baseBps = 50;
    if (config.targetValue >= 10000) baseBps = 10;
    else if (config.targetValue >= 5000) baseBps = 20;
    else if (config.targetValue >= 1000) baseBps = 30;

    let riskBps = 0;
    const strike = config.strikePrice || 0;
    const hedgeDirection = config.hedgeDirection ?? 2;
    let danger = false;
    let hedge = false;

    if (strike > 0 && hedgeDirection !== 2 && pythSpotPrice > 0) {
      if (hedgeDirection === 0) { // FLOOR
        if (pythSpotPrice < strike) { hedge = true; }
        if (pythSpotPrice < strike * 1.05) { riskBps = 150; danger = true; }
      } else if (hedgeDirection === 1) { // CEILING
        if (pythSpotPrice > strike) { hedge = true; }
        if (pythSpotPrice > strike * 0.95) { riskBps = 150; danger = true; }
      }
    }

    const totalBps = baseBps + riskBps;
    setEstimatedFee((unclaimed * totalBps) / 10000);
    setIsDangerZone(danger);
    setWillHedge(hedge);
  }, [unclaimed, config.targetValue, config.strikePrice, config.hedgeDirection, pythSpotPrice]);

  useGSAP(() => {
    if (!progressBarRef.current || !flowBgRef.current) return;

    const now = Date.now();
    const durationTotalMs = config.endTimeMs - config.startTimeMs;
    const durationTotalSecs = durationTotalMs / 1000;
    
    // Calculate initial percentage
    const elapsedMs = Math.max(0, Math.min(now - config.startTimeMs, durationTotalMs));
    const initialPercentage = (elapsedMs / durationTotalMs) * 100;
    
    // Calculate remaining duration
    const remainingMs = Math.max(0, config.endTimeMs - now);
    const remainingSecs = remainingMs / 1000;
    
    const delayMs = Math.max(0, config.startTimeMs - now);
    const delaySecs = delayMs / 1000;

    // 1. Animate width smoothly
    if (remainingSecs > 0) {
      gsap.set(progressBarRef.current, { width: `${initialPercentage}%` });
      gsap.to(progressBarRef.current, {
        width: "100%",
        duration: remainingSecs,
        delay: delaySecs,
        ease: "none",
      });
    } else {
      gsap.set(progressBarRef.current, { width: "100%" });
    }

    // 2. Flowing gradient background effect
    gsap.to(flowBgRef.current, {
      backgroundPosition: "200% 0",
      duration: 1.5,
      repeat: -1,
      ease: "none",
    });

    // 3. Pulsing glow head (REMOVED)

  }, [config.startTimeMs, config.endTimeMs]);

  const isProtected = (config.hedgeDirection ?? 2) !== 2;
  const dirLabel = config.hedgeDirection === 0 ? "Floor" : config.hedgeDirection === 1 ? "Ceiling" : "";

  const isCompleted = balance >= config.targetValue;

  return (
    <div className={`group w-full border rounded-2xl p-5 flex flex-col gap-4 transition-colors duration-300 ${
      isCompleted 
        ? "bg-[#060608]/50 border-white/[0.02] opacity-80" 
        : "bg-[#060608] border-white/5 hover:bg-[#141418]"
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
            {config.type === "inbound" ? <ArrowDownLeft size={16} strokeWidth={1.5} /> :
             config.type === "self" ? <RefreshCw size={16} strokeWidth={1.5} /> :
             <ArrowUpRight size={16} strokeWidth={1.5} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#e8e4df] font-medium">SUI Stream</span>
              {isProtected && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-[#FF8B5E]/10 text-[#FF8B5E] border border-[#FF8B5E]/20 flex items-center gap-0.5">
                  <ShieldCheck size={9} /> {dirLabel} {config.strikePrice ? `$${config.strikePrice.toFixed(2)}` : ""}
                </span>
              )}
              {config.hedgeTriggered && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-green-500/10 text-green-400">
                  Hedged
                </span>
              )}
              {config.liquidationStatus === 1 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  TWAP {config.tranchesExecuted || 0}/{config.twapTranches || 5}
                </span>
              )}
              {config.liquidationStatus === 2 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">
                  Protected
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#8a8690] font-mono mt-1">
              {config.sender.slice(0, 6)}...{config.sender.slice(-4)} → {config.receiver.slice(0, 6)}...{config.receiver.slice(-4)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg text-[#e8e4df] font-mono tracking-tight">
            {balance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SUI
          </div>
          <div className="text-[10px] text-[#8a8690] mt-0.5">
            of {config.targetValue.toLocaleString()} SUI
          </div>
          {(config.usdcBalance ?? 0) > 0 && (
            <div className="text-[10px] text-green-400 font-mono mt-0.5">
              + {((config.usdcBalance ?? 0) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
            </div>
          )}
        </div>
      </div>

      {/* Progress bar (only shown if not completed) */}
      {!isCompleted && (
        <div className="w-full h-1.5 bg-[#141418] group-hover:bg-[#222228] transition-colors duration-300 rounded-full overflow-visible relative mt-1">
          {/* The animated progress bar */}
          <div
            ref={progressBarRef}
            className="absolute top-0 left-0 h-full rounded-full flex items-center justify-end"
          >
            {/* Flowing background layer */}
            <div 
              ref={flowBgRef}
              className="absolute inset-0 rounded-full"
              style={{ 
                 background: 'linear-gradient(90deg, rgba(255,139,94,0.4) 0%, #FF8B5E 50%, rgba(255,139,94,0.4) 100%)',
                 backgroundSize: '200% 100%'
              }}
            />
          </div>
        </div>
      )}

      {/* TWAP Progress (shown when hedging is active) */}
      {config.liquidationStatus === 1 && (config.twapTranches ?? 0) > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-[#8a8690] uppercase tracking-wider whitespace-nowrap">TWAP</span>
          <div className="flex-1 h-1 bg-[#141418] rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400/80 rounded-full transition-all duration-500"
              style={{ width: `${((config.tranchesExecuted ?? 0) / (config.twapTranches ?? 5)) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-[#8a8690] font-mono whitespace-nowrap">
            {config.tranchesExecuted ?? 0}/{config.twapTranches ?? 5}
          </span>
        </div>
      )}

      {/* Actions & Fee Info */}
      <div className="flex justify-between items-center mt-2">
        <div className="flex flex-col gap-1">
          {estimatedFee > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-[#8a8690] uppercase tracking-wider">Protocol Fee</span>
              <span className={`text-[11px] font-mono font-medium ${isDangerZone ? "text-[#FF8B5E]" : "text-[#e8e4df]"}`}>
                -{estimatedFee.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SUI
                {isDangerZone && " (Risk Premium)"}
              </span>
            </div>
          )}
          {unclaimed > 0.0001 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-[#8a8690] uppercase tracking-wider">Will Receive</span>
              <span className="text-[11px] font-mono font-medium text-[#e8e4df]">
                {willHedge ? "~ USDC (Hedged)" : "SUI"}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 items-center">
          {(config.withdrawn || 0) > 0 && (
             <span className="text-[10px] text-[#8a8690] mr-2">
               Claimed: {(config.withdrawn || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SUI
             </span>
          )}
          {(config.type === "inbound" || config.type === "self") && unclaimed > 0.0001 && (
            <button
              onClick={() => executeClaimTransaction(config.id)}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-[#FF8B5E] text-black text-xs font-semibold rounded-lg hover:bg-[#FFB088] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isProcessing ? "Processing..." : `Claim ${unclaimed.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}
            </button>
          )}
          {(config.type === "outbound" || config.type === "self") && !hasStarted && (
            <button
              onClick={() => executeCancelTransaction(config.id)}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-[#0d0d10] border border-white/5 text-[#e8e4df] text-xs font-medium rounded-lg hover:bg-[#141418] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isProcessing ? "Processing..." : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
