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
  const fixedFloorRef = React.useRef<number | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentSimPriceRef = React.useRef<number | null>(null);
  const [gain, setGain] = useState<{ amount: number, percent: number } | null>(null);
  const suiClient = useSuiClient();

  useEffect(() => {
    let active = true;
    const maxPoints = 150;
    const stepMs = (30 * 24 * 60 * 60 * 1000) / maxPoints; // 1 month divided by 150 points
    let timeSimRef = { current: Date.now() - (30 * 24 * 60 * 60 * 1000) };
    // Initialize DeepBook Client with the dApp kit suiClient
    const dbClient = new DeepBookClient({ 
      client: suiClient, 
      network: 'testnet',
      address: ZERO_ADDRESS
    });
    
    const fetchPrice = async (isInit = false) => {
      try {
        const poolKey = 'SUI_DBUSDC';
        let basePrice = 0.715; // default fallback
        try { basePrice = await dbClient.midPrice(poolKey); } catch (e) {}
        
        if (initialPriceRef.current === null) {
          initialPriceRef.current = basePrice;
          fixedFloorRef.current = basePrice * 0.95; // Fix the floor!
        }
        
        // Add smooth random walk volatility to previous price
        let currentPrice = currentSimPriceRef.current !== null ? currentSimPriceRef.current : basePrice;
        const noise = (Math.random() - 0.5) * 0.005;
        currentPrice += noise;
        
        // Keep it bounded so it doesn't wander off forever
        if (currentPrice > basePrice * 1.05) currentPrice = basePrice * 1.05;
        if (currentPrice < basePrice * 0.90) currentPrice = basePrice * 0.90;
        
        currentSimPriceRef.current = currentPrice;
        const floorPrice = fixedFloorRef.current as number;

        const diff = currentPrice - (initialPriceRef.current as number);
        const pct = (diff / (initialPriceRef.current as number)) * 100;
        setGain({ amount: diff, percent: pct });

        if (active) {
          setData(prev => {
            timeSimRef.current += stepMs;
            const newPoint = {
              time: timeSimRef.current,
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

    const initializeGraph = async () => {
        let basePrice = 0.715;
        try { basePrice = await dbClient.midPrice('SUI_DBUSDC'); } catch (e) {}
        
        initialPriceRef.current = basePrice;
        fixedFloorRef.current = basePrice * 0.95;
        
        const histData = [];
        let walkingPrice = basePrice * 1.05; // Start slightly higher
        
        for (let i = 0; i < maxPoints; i++) {
            walkingPrice = walkingPrice + (Math.random() - 0.5) * 0.04;
            
            // Force a dip below floor in the middle to demonstrate the "Protection Shield" activating
            if (i > maxPoints * 0.3 && i < maxPoints * 0.6) {
               walkingPrice = (fixedFloorRef.current as number) - (Math.random() * 0.03); 
            }
            // Force recovery
            if (i >= maxPoints * 0.6 && i < maxPoints * 0.8) {
               walkingPrice = (fixedFloorRef.current as number) + (Math.random() * 0.05);
            }
            
            histData.push({
                time: timeSimRef.current,
                spot: walkingPrice,
                floor: fixedFloorRef.current as number,
                inTheMoney: walkingPrice < (fixedFloorRef.current as number)
            });
            timeSimRef.current += stepMs;
        }
        // Force last point to actual current
        histData[maxPoints - 1].spot = basePrice;
        histData[maxPoints - 1].inTheMoney = basePrice < (fixedFloorRef.current as number);
        currentSimPriceRef.current = basePrice;
        
        if (active) setData(histData);
        
        // Start polling
        intervalRef.current = setInterval(() => fetchPrice(false), 1000);
    };

    initializeGraph();

    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
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
              labelStyle={{ color: '#8a8690', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              labelFormatter={(label: any) => {
                const d = new Date(label);
                return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              }}
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
            
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
