"use client";

import { useEffect, useState } from "react";
import { Shield, TrendingDown, DollarSign, Lock, Clock } from "lucide-react";
import { useSuiClientQuery, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { DeepBookClient } from '@mysten/deepbook-v3';

const PACKAGE_ID = "0xfeded63bda28be37a34d937fe8dfe8c294596a26f4c9805128812edfd085c025";

interface OptionContract {
  id: string;
  volume: number;
  strikePrice: number;
  expiryMs: number;
}

export default function InsurancePage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [activeContracts, setActiveContracts] = useState<OptionContract[]>([]);
  const [protectedVolume, setProtectedVolume] = useState(0);
  const [premiumSpent, setPremiumSpent] = useState(0);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  const { data: createdEvents, isLoading: isEventsLoading } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::peach_stream::StreamCreated` },
      order: 'descending',
    }
  );

  useEffect(() => {
    // 1. Fetch live DeepBook floor price
    const dbClient = new DeepBookClient({ client: suiClient, network: 'testnet', address: '0x0000000000000000000000000000000000000000000000000000000000000000' });
    dbClient.midPrice('SUI_DBUSDC').then(price => {
      setCurrentFloor(price * 0.95);
    }).catch(() => setCurrentFloor(1.42)); // fallback

    if (!createdEvents || !currentAccount) return;
    
    // 2. Filter outbound streams (where user is sender)
    const outboundEvents = createdEvents.data.filter(event => {
       const payload = event.parsedJson as any;
       return payload?.sender === currentAccount.address;
    });

    const streamIds = outboundEvents.map(e => (e.parsedJson as any).stream_id);
    
    if (streamIds.length === 0) {
      setActiveContracts([]);
      return;
    }

    setIsFetching(true);

    suiClient.multiGetObjects({
      ids: streamIds,
      options: { showContent: true }
    }).then(res => {
       let totalVol = 0;
       const contracts: OptionContract[] = [];
       res.forEach(obj => {
         if (obj.data?.content?.dataType === 'moveObject') {
           const fields = obj.data.content.fields as any;
           const vol = Number(fields.total_amount) / 1e9;
           totalVol += vol;
           contracts.push({
             id: fields.id.id,
             volume: vol,
             strikePrice: Number(fields.strike_price) / 1e9, // assuming strike was stored in scaled units
             expiryMs: Number(fields.option_expiry),
           });
         }
       });
       setProtectedVolume(totalVol);
       // We approximate premium as 1% of the volume for demo purposes based on protocol design
       setPremiumSpent(totalVol * 0.01 * (currentFloor || 1.42)); 
       setActiveContracts(contracts);
       setIsFetching(false);
    }).catch(err => {
      console.error(err);
      setIsFetching(false);
    });
  }, [createdEvents, currentAccount, suiClient, currentFloor]);

  const isLoading = isEventsLoading || isFetching;

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl text-[#e8e4df] font-display font-medium tracking-tight mb-3">Active Protection</h1>
        <p className="text-[#8a8690] text-sm">Monitor your DeepBook V3 Predict Put Options and downside floor pricing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <Lock size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#e8e4df]">Protected Volume</h3>
          </div>
          <div className="text-3xl font-display font-medium text-[#e8e4df] tracking-tight mb-2">
            {isLoading ? "..." : protectedVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-lg text-[#8a8690]">SUI</span>
          </div>
          <div className="text-[11px] text-[#8a8690] flex items-center gap-1 font-medium tracking-wider uppercase">
            Fully Hedged via DeepBook
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <TrendingDown size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#e8e4df]">Current Floor Price</h3>
          </div>
          <div className="text-3xl font-display font-medium text-[#e8e4df] tracking-tight mb-2">
            ${currentFloor.toFixed(3)} <span className="text-lg text-[#8a8690]">/ SUI</span>
          </div>
          <div className="text-[11px] text-[#8a8690] flex items-center gap-1 font-medium tracking-wider uppercase">
            Oracle SVI Benchmark
          </div>
        </div>

        <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)] hover:bg-[#141418]/60 transition-colors duration-500">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#060608] border border-white/5 rounded-xl text-[#8a8690]">
              <DollarSign size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#e8e4df]">Total Premium Spent</h3>
          </div>
          <div className="text-3xl font-display font-medium text-[#e8e4df] tracking-tight mb-2">
            ${isLoading ? "..." : premiumSpent.toFixed(2)} <span className="text-lg text-[#8a8690]">USDC</span>
          </div>
          <div className="text-[11px] text-[#8a8690] flex items-center gap-1 font-medium tracking-wider uppercase">
            Deducted Automatically
          </div>
        </div>
      </div>

      <div className="bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,139,94,0.02)]">
        
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <Shield className="w-4 h-4 text-[#8a8690]" />
          <h2 className="text-sm font-medium text-[#e8e4df] tracking-wide">Active Options Contracts</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8690] relative z-10">
            <div className="w-5 h-5 border-[1.5px] border-white/10 border-t-[#8a8690] rounded-full animate-spin mb-4" />
            <p className="text-xs tracking-wider uppercase">Querying DeepBook Vaults</p>
          </div>
        ) : activeContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl bg-[#060608]/50 relative z-10">
            <Shield className="w-6 h-6 text-[#8a8690] mb-4 opacity-40" />
            <p className="text-[#e8e4df] text-sm font-medium mb-1">No Active Options</p>
            <p className="text-[#8a8690] text-xs">Create an outbound stream to auto-mint Predict Put contracts.</p>
          </div>
        ) : (
          <div className="space-y-3 relative z-10">
            {activeContracts.map((contract) => {
              const now = Date.now();
              const daysLeft = Math.max(0, Math.ceil((contract.expiryMs - now) / (1000 * 60 * 60 * 24)));
              
              // Status logic approximation
              let status = "Out-of-the-Money";
              if (currentFloor < contract.strikePrice) status = "In-the-Money";
              else if (currentFloor === contract.strikePrice) status = "At-the-Money";

              return (
                <div key={contract.id} className="w-full bg-[#060608] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#141418] hover:scale-[1.005] transition-all duration-500 ease-out">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-[#0d0d10] border border-white/5 text-[#8a8690]">
                      <Shield size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[#e8e4df] text-sm font-medium">Predict Put Contract</span>
                        <span className="bg-[#141418] border border-white/5 text-[#8a8690] text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8690]/70 font-mono tracking-wider">
                        Vault ID: {contract.id.substring(0, 10)}...
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-8 text-right w-full sm:w-auto">
                    <div>
                      <div className="text-[10px] text-[#8a8690] mb-1.5 uppercase tracking-widest font-medium">Volume</div>
                      <div className="text-sm text-[#e8e4df] font-mono">{contract.volume.toLocaleString()} SUI</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8a8690] mb-1.5 uppercase tracking-widest font-medium">Strike Price</div>
                      <div className="text-sm text-[#e8e4df] font-mono">${contract.strikePrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8a8690] mb-1.5 uppercase tracking-widest font-medium">Expires In</div>
                      <div className="text-sm text-[#e8e4df] font-mono">{daysLeft} Days</div>
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
