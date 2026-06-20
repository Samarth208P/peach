"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Shield, RefreshCw } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Buffer } from "buffer";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";
import { HermesClient } from "@pythnetwork/hermes-client";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
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

const SuiIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M197.376 71.3347C198.854 69.5551 201.617 69.5551 203.094 71.3347L280.465 164.535L280.715 164.849C294.951 182.255 303.47 204.374 303.471 228.453C303.471 284.533 257.256 329.998 200.24 330C143.223 330 97 284.534 97 228.453C97.001 204.375 105.52 182.255 119.756 164.849L120.006 164.546L197.376 71.3347ZM138.523 178.129C127.606 191.477 121.069 208.448 121.068 226.913C121.068 269.921 156.51 304.789 200.23 304.791C212.695 304.791 224.493 301.954 234.984 296.905L234.996 296.899C235.197 296.798 235.337 296.604 235.369 296.381C236.074 290.481 235.777 283.729 234.151 276.87C230.251 260.431 216.717 245.436 193.471 232.401C166.73 217.454 150.739 198.154 146.261 175.008C146.023 173.777 145.813 172.551 145.647 171.332C145.567 170.744 144.826 170.531 144.447 170.988L138.523 178.129ZM204.156 108.504C202.132 106.065 198.339 106.065 196.314 108.504L184.775 122.412C181.245 126.711 177.091 133.852 174.298 142.374C171.504 150.898 170.051 160.849 171.996 170.756C175.007 186.079 186.483 199.563 206.521 210.763C236.193 227.395 254.216 247.942 259.75 271.895C260.043 273.162 260.296 274.42 260.51 275.665C260.613 276.242 261.346 276.432 261.718 275.98C272.775 262.589 279.402 245.508 279.402 226.913C279.402 208.594 272.965 191.748 262.202 178.449C262.199 178.446 262.2 178.441 262.202 178.438C262.205 178.435 262.206 178.43 262.203 178.427L204.156 108.504Z" fill="currentColor"/>
  </svg>
);

export default function TickingStreamRow({ config, pythSpotPrice = 0, disableClick = false }: { config: StreamConfig; pythSpotPrice?: number; disableClick?: boolean }) {
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
  const [localWithdrawn, setLocalWithdrawn] = useState(config.withdrawn || 0);

  useEffect(() => {
    setLocalWithdrawn(config.withdrawn || 0);
  }, [config.withdrawn]);

  gsap.registerPlugin(useGSAP);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const router = useRouter();

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
      
      setLocalWithdrawn((prev) => prev + unclaimed);
      
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

  const unclaimed = Math.max(0, balance - localWithdrawn);

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
    const remainingMs = Math.max(0, config.endTimeMs - Math.max(now, config.startTimeMs));
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

  }, [config.startTimeMs, config.endTimeMs]);

  const isProtected = (config.hedgeDirection ?? 2) !== 2;
  const dirLabel = config.hedgeDirection === 0 ? "Floor" : config.hedgeDirection === 1 ? "Ceiling" : "";

  const isCompleted = balance >= config.targetValue;

  return (
    <div className={`group w-full border rounded-2xl p-5 flex flex-col gap-4 transition-colors duration-300 ${
      isCompleted 
        ? "bg-[#060608]/50 border-white/[0.02] opacity-80" 
        : "bg-[#060608] border-white/5 hover:bg-[#141418]"
    } ${disableClick ? "" : "cursor-pointer"}`}
      onClick={() => {
        if (!disableClick) {
          router.push(`/dashboard/streams/${config.id}`);
        }
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${config.type === "inbound" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : config.type === "outbound" ? "bg-[#FF8B5E]/10 border-[#FF8B5E]/20 text-[#FF8B5E]" : "bg-[#0d0d10] border-white/5 text-[#8a8690]"}`}>
            <SuiIcon size={16} />
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
          {localWithdrawn > 0 && (
             <span className="text-[10px] text-[#8a8690] mr-2">
               Claimed: {localWithdrawn.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SUI
             </span>
          )}
          {(config.type === "inbound" || config.type === "self") && unclaimed > 0.0001 && (
            <button
              onClick={(e) => { e.stopPropagation(); executeClaimTransaction(config.id); }}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-[#FF8B5E] text-black text-xs font-semibold rounded-lg hover:bg-[#FFB088] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isProcessing ? "Processing..." : `Claim ${unclaimed.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}
            </button>
          )}
          {(config.type === "outbound" || config.type === "self") && !hasStarted && (
            <button
              onClick={(e) => { e.stopPropagation(); executeCancelTransaction(config.id); }}
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
