"use client";

import { useEffect, useState } from "react";
import { Wallet, PieChart, Briefcase, ArrowUpRight, Clock, Shield } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PEACH_PACKAGE_ID, PYTH_HERMES_BASE_URL, PYTH_SUI_USD_FEED_ID } from "@/lib/constants";

interface SalvageRecord {
  id: string;
  refunded: number;
  settled: number;
  pendingDebt: number;
  salvageVaultId: string;
  date: number;
  receiver: string;
}

export default function TreasuryPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [totalLocked, setTotalLocked] = useState(0);
  const [pythSpotPrice, setPythSpotPrice] = useState<number | null>(null);
  const [totalSalvaged, setTotalSalvaged] = useState(0);
  const [salvageLedger, setSalvageLedger] = useState<SalvageRecord[]>([]);
  const [isFetchingObjects, setIsFetchingObjects] = useState(false);

  // Query StreamCreated events
  const { data: createdEvents, isLoading: isCreatedLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCreated` },
      order: "descending",
    }
  );

  // Query StreamCanceled events (now includes salvage_vault_id and pending_hedge_debt)
  const { data: canceledEvents, isLoading: isCanceledLoading } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::StreamCanceled` },
      order: "descending",
    }
  );

  // Query SalvageDissolved events
  const { data: dissolvedEvents } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PEACH_PACKAGE_ID}::peach_stream::SalvageDissolved` },
      order: "descending",
    }
  );

  // Live Pyth price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `${PYTH_HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${PYTH_SUI_USD_FEED_ID}`
        );
        const json = await res.json();
        const parsed = json?.parsed?.[0]?.price;
        if (parsed) {
          setPythSpotPrice(parseFloat(parsed.price) * Math.pow(10, parsed.expo));
        }
      } catch { /* keep last */ }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Process salvage ledger from StreamCanceled events
  useEffect(() => {
    if (!currentAccount || !canceledEvents) return;

    const userCanceled = canceledEvents.data.filter((event) => {
      const payload = event.parsedJson as any;
      return payload?.sender === currentAccount.address;
    });

    let salvagedSum = 0;
    const ledger: SalvageRecord[] = [];
    userCanceled.forEach((event) => {
      const data = event.parsedJson as any;
      const refund = Number(data.sender_refunded_sui) / 1e9;
      salvagedSum += refund;
      ledger.push({
        id: event.id.txDigest,
        refunded: refund,
        settled: Number(data.receiver_settled_sui) / 1e9,
        pendingDebt: Number(data.pending_hedge_debt || 0) / 1e9,
        salvageVaultId: data.salvage_vault_id || "",
        date: Number(event.timestampMs),
        receiver: data.receiver,
      });
    });
    setTotalSalvaged(salvagedSum);
    setSalvageLedger(ledger);
  }, [canceledEvents, currentAccount]);

  // Compute total locked from active stream objects
  useEffect(() => {
    if (!currentAccount || !createdEvents) return;

    const outboundEvents = createdEvents.data.filter((event) => {
      const payload = event.parsedJson as any;
      return payload?.sender === currentAccount.address;
    });

    const streamIds = outboundEvents.map((e) => (e.parsedJson as any).stream_id);
    if (streamIds.length > 0) {
      setIsFetchingObjects(true);
      suiClient
        .multiGetObjects({ ids: streamIds, options: { showContent: true } })
        .then((res) => {
          let lockedSum = 0;
          res.forEach((obj) => {
            if (obj.data?.content?.dataType === "moveObject") {
              const fields = obj.data.content.fields as any;
              lockedSum += Number(fields.total_amount) / 1e9;
            }
          });
          setTotalLocked(lockedSum);
          setIsFetchingObjects(false);
        })
        .catch(() => setIsFetchingObjects(false));
    } else {
      setTotalLocked(0);
    }
  }, [createdEvents, currentAccount, suiClient]);

  const isLoading = isCreatedLoading || isCanceledLoading || isFetchingObjects;
  const usdcValue = pythSpotPrice !== null ? totalLocked * pythSpotPrice : 0;
  const dissolvedCount = dissolvedEvents?.data?.length ?? 0;

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-10">
        <h1 className="text-3xl text-[#e8e4df] font-display font-medium tracking-tight mb-2">
          Treasury
        </h1>
        <p className="text-[#8a8690] text-sm">
          Corporate assets, SalvageVaults, and outbound stream commitments.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={14} className="text-[#8a8690]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Total Locked</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {isLoading ? "..." : totalLocked.toFixed(2)} <span className="text-sm text-[#8a8690]">SUI</span>
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={14} className="text-[#8a8690]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">USD Value</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            ${isLoading ? "..." : usdcValue.toFixed(2)}
          </div>
          {pythSpotPrice && (
            <span className="text-[9px] text-[#8a8690]">@ ${pythSpotPrice.toFixed(4)}/SUI</span>
          )}
        </div>

        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={14} className="text-[#FF8B5E]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Salvaged</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {isLoading ? "..." : totalSalvaged.toFixed(2)} <span className="text-sm text-[#8a8690]">SUI</span>
          </div>
          <span className="text-[9px] text-[#8a8690]">{salvageLedger.length} vaults created</span>
        </div>

        <div className="bg-[#0d0d10]/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-[#8a8690]" />
            <span className="text-[10px] text-[#8a8690] uppercase tracking-wider font-medium">Dissolved</span>
          </div>
          <div className="text-2xl font-display font-medium text-[#e8e4df]">
            {dissolvedCount}
          </div>
          <span className="text-[9px] text-[#8a8690]">SalvageVaults extracted</span>
        </div>
      </div>

      {/* Salvage Vault Ledger */}
      <div className="bg-[#0d0d10]/60 border border-white/5 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <Briefcase size={16} className="text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">SalvageVault Ledger</h2>
        </div>
        <p className="text-[11px] text-[#8a8690] mb-6 leading-relaxed max-w-2xl">
          When a stream is cancelled, the unearned balance is packaged into a SalvageVault NFT
          and transferred to your treasury. Use <code className="text-[#FF8B5E]">dissolve_salvage_vault</code> to extract funds.
        </p>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#8a8690]">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-3" />
            <p className="text-xs uppercase tracking-wider">Loading treasury</p>
          </div>
        ) : salvageLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50">
            <Clock size={20} className="text-[#8a8690] mb-3 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No SalvageVaults</p>
            <p className="text-[#8a8690] text-xs">Cancel an outbound stream to receive a SalvageVault.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {salvageLedger.map((record) => {
              const dateStr = new Date(record.date).toLocaleDateString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              });
              return (
                <div
                  key={record.id}
                  className="bg-[#060608] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-[#141418] transition-colors duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      <ArrowUpRight size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-[#e8e4df] font-medium">SalvageVault Created</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-[#141418] border border-white/5 text-[#8a8690]">
                          Settled
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8a8690] font-mono">
                        Recipient: {record.receiver.slice(0, 6)}...{record.receiver.slice(-4)}
                        {record.pendingDebt > 0 && (
                          <span className="ml-2 text-[#FF8B5E]">Pending debt: {record.pendingDebt.toFixed(4)} SUI</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end">
                    <div className="text-[#e8e4df] text-sm font-mono font-medium mb-0.5">
                      +{record.refunded.toFixed(2)} SUI refunded
                    </div>
                    <div className="text-[10px] text-[#8a8690]">
                      {record.settled.toFixed(2)} SUI settled to receiver · {dateStr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
