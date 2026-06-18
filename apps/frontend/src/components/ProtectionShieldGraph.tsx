"use client";

import React, { useEffect, useState } from "react";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { DeepBookClient } from '@mysten/deepbook-v3';
import { useSuiClient } from '@mysten/dapp-kit';
import { ZERO_ADDRESS } from "@/lib/constants";

interface DataPoint {
  time: number;
  spot: number;
  floor: number;
  inTheMoney: boolean;
}

export default function ProtectionShieldGraph() {
  const [data, setData] = useState<DataPoint[]>([]);
  const initialPriceRef = React.useRef<number | null>(null);
  const [gain, setGain] = useState<{ amount: number, percent: number } | null>(null);
  const suiClient = useSuiClient();

  useEffect(() => {
    let active = true;
    let timeIndex = 0;
    const maxPoints = 30;
    // Initialize DeepBook Client with the dApp kit suiClient
    const dbClient = new DeepBookClient({ 
      client: suiClient, 
      network: 'testnet',
      address: ZERO_ADDRESS
    });
    
    const fetchPrice = async () => {
      try {
        // The poolKey for testnet SUI/USDC is 'SUI_DBUSDC'
        const poolKey = 'SUI_DBUSDC';
        const currentPrice = await dbClient.midPrice(poolKey);
        // The Floor is dynamic based on the Option contract, but for demo we set it slightly below spot
        const floorPrice = currentPrice * 0.95; 

        if (initialPriceRef.current === null) {
          initialPriceRef.current = currentPrice;
        } else {
          const diff = currentPrice - initialPriceRef.current;
          const pct = (diff / initialPriceRef.current) * 100;
          setGain({ amount: diff, percent: pct });
        }

        if (active) {
          setData(prev => {
            const newPoint = {
              time: timeIndex++,
              spot: currentPrice,
              floor: floorPrice,
              inTheMoney: currentPrice < floorPrice
            };
            const nextData = [...prev, newPoint];
            if (nextData.length > maxPoints) nextData.shift();
            return nextData;
          });
        }
      } catch (err) {
        console.error("DeepBook Fetch Error:", err);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 3000); // Fetch every 3 seconds

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [suiClient]);

  return (
    <div className="w-full flex flex-col relative group bg-[#0d0d10]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-[0_0_30px_rgba(255,139,94,0.02)]">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-[#e8e4df] tracking-wide">Protection Shield</h3>
            {gain && (
              <span className="bg-[#141418] border border-white/5 text-[#8a8690] text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest">
                {gain.amount >= 0 ? '+' : ''}{gain.amount.toFixed(4)} USDC
              </span>
            )}
          </div>
          <p className="text-[#8a8690] text-xs tracking-wider uppercase mt-2">DeepBook V3 Live Order Book</p>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono shrink-0 bg-[#060608] px-4 py-2 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-white shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
            <span className="text-white/80 whitespace-nowrap">SUI Spot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#FD8566] shrink-0 shadow-[0_0_8px_rgba(253,133,102,0.8)]"></div>
            <span className="text-[#FD8566] whitespace-nowrap">Floor (95%)</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[320px] relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSpot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.03}/>
                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorFloor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FD8566" stopOpacity={0.03}/>
                <stop offset="95%" stopColor="#FD8566" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={['dataMin - 0.05', 'dataMax + 0.05']} hide />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(10, 10, 12, 0.9)', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: '12px' }}
              itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: '500', fontFamily: 'monospace' }}
              labelStyle={{ display: 'none' }}
              formatter={(value: any, name: any) => {
                const val = typeof value === 'number' ? value : Number(value) || 0;
                return [
                  `$${val.toFixed(3)}`, 
                  name === 'spot' ? 'SUI Spot Price' : 'Guaranteed Floor'
                ];
              }}
            />
            
            <Area 
              type="monotone" 
              dataKey="floor" 
              stroke="#FD8566" 
              fillOpacity={1} 
              fill="url(#colorFloor)" 
              strokeWidth={2} 
              strokeDasharray="4 4"
              isAnimationActive={true}
              animationDuration={500}
            />
            
            <Area 
              type="monotone" 
              dataKey="spot" 
              stroke="#ffffff" 
              fillOpacity={1} 
              fill="url(#colorSpot)" 
              strokeWidth={2} 
              isAnimationActive={true}
              animationDuration={500}
              activeDot={{ r: 6, fill: "#000", stroke: "#fff", strokeWidth: 2, className: "shadow-[0_0_12px_rgba(255,255,255,0.8)]" }}
            />
            
            {data.map((entry, index) => {
              if (entry.inTheMoney) {
                return (
                  <ReferenceLine 
                    key={`ref-${index}`}
                    x={entry.time} 
                    stroke="rgba(253,133,102,0.15)" 
                    strokeWidth={15} 
                  />
                );
              }
              return null;
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
