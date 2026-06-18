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
    const hermes = new HermesClient(PYTH_HERMES_BASE_URL, {});
    const priceUpdates = await hermes.getLatestPriceUpdates([PYTH_SUI_USD_FEED_ID]);
    const bufferUpdates = priceUpdates.binary.data.map((hex: string) => Buffer.from(hex, "hex"));

    const pythClient = new SuiPythClient(suiClient as any, PYTH_STATE_ID, WORMHOLE_STATE_ID);

    let objectId = await pythClient.getPriceFeedObjectId(PYTH_SUI_USD_FEED_ID);

    if (!objectId) {
      const initTx = new Transaction();
      await pythClient.createPriceFeed(initTx as any, bufferUpdates);
      await signAndExecuteTransaction({ transaction: initTx });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      objectId = await pythClient.getPriceFeedObjectId(PYTH_SUI_USD_FEED_ID);
      if (!objectId) throw new Error("Failed to retrieve PriceFeed ObjectId");
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

  useEffect(() => {
    let baseBps = 50;
    if (config.targetValue >= 10000) baseBps = 10;
    else if (config.targetValue >= 5000) baseBps = 20;
    else if (config.targetValue >= 1000) baseBps = 30;

    let riskBps = 0;
    const strike = config.strikePrice || 0;
    const hedgeDirection = config.hedgeDirection ?? 2;
    let danger = false;

    if (strike > 0 && hedgeDirection !== 2 && pythSpotPrice > 0) {
      if (hedgeDirection === 0) { // FLOOR
        if (pythSpotPrice < strike * 1.05) { riskBps = 150; danger = true; }
      } else if (hedgeDirection === 1) { // CEILING
        if (pythSpotPrice > strike * 0.95) { riskBps = 150; danger = true; }
      }
    }

    const totalBps = baseBps + riskBps;
    setEstimatedFee((balance * totalBps) / 10000);
    setIsDangerZone(danger);
  }, [balance, config.targetValue, config.strikePrice, config.hedgeDirection, pythSpotPrice]);

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

  return (
    <div className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 hover:bg-[#141418] transition-colors duration-300">
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
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#141418] rounded-full overflow-visible relative mt-1">
        {/* The animated progress bar */}
        <div
          ref={progressBarRef}
          className="absolute top-0 left-0 h-full rounded-full flex items-center justify-end"
          // Removed static style={{ width: "0%" }} so React does not override GSAP during re-renders
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

      {/* Actions & Fee Info */}
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-2">
          {estimatedFee > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-[#8a8690] uppercase tracking-wider">Protocol Fee</span>
              <span className={`text-[11px] font-mono font-medium ${isDangerZone ? "text-[#FF8B5E]" : "text-[#e8e4df]"}`}>
                -{estimatedFee.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SUI
                {isDangerZone && " (Risk Premium)"}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          {(config.type === "inbound" || config.type === "self") && (
            <button
              onClick={() => executeClaimTransaction(config.id)}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-[#FF8B5E] text-black text-xs font-semibold rounded-lg hover:bg-[#FFB088] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Claim"}
            </button>
          )}
          {(config.type === "outbound" || config.type === "self") && !hasStarted && (
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
  );
}
