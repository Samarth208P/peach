"use client";

import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { DeepBookClient } from '@mysten/deepbook-v3';
import { useSuiClient } from '@mysten/dapp-kit';

interface DataPoint {
  time: number;
  spot: number;
  floor: number;
  inTheMoney: boolean;
}

export default function ProtectionShieldGraph() {
  const [data, setData] = useState<DataPoint[]>([]);
  const suiClient = useSuiClient();

  useEffect(() => {
    let active = true;
    let timeIndex = 0;
    const maxPoints = 30;
    // Initialize DeepBook Client with the dApp kit suiClient
    const dbClient = new DeepBookClient({ 
      client: suiClient, 
      network: 'testnet',
      address: '0x0000000000000000000000000000000000000000000000000000000000000000'
    });
    
    // Testnet SUI/DBUSDC Pool ID is usually fixed, but we'll try to find it dynamically or fallback
    // We can use the known SUI/USDC testnet pool if getPoolIdByAssets fails
    const fetchPrice = async () => {
      try {
        let poolId;
        try {
          // Native asset mapping provided by the SDK
          poolId = await dbClient.getPoolIdByAssets('SUI', 'DBUSDC');
        } catch (e) {
          // Fallback to known common testnet pool if dynamic fetch fails
          poolId = "0x...SUI_USDC_POOL"; // placeholder
        }

        if (!poolId) return;

        const currentPrice = await dbClient.midPrice(poolId);
        // The Floor is dynamic based on the Option contract, but for demo we set it slightly below spot
        const floorPrice = currentPrice * 0.95; 

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
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col relative group">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
        <div>
          <h3 className="text-white font-medium font-display">Protection Shield</h3>
          <p className="text-[#8a8690] text-sm">DeepBook V3 Live Order Book</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-white/50 shrink-0"></div>
            <span className="text-white/60 whitespace-nowrap">SUI Spot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#FD8566] shrink-0"></div>
            <span className="text-[#FD8566] whitespace-nowrap">Floor (95%)</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#FD8566]/10 to-transparent pointer-events-none opacity-50" />
        
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
              labelStyle={{ display: 'none' }}
              formatter={(value: any, name: any) => {
                const val = typeof value === 'number' ? value : Number(value) || 0;
                return [
                  `$${val.toFixed(3)}`, 
                  name === 'spot' ? 'SUI Spot Price' : 'Guaranteed Floor'
                ];
              }}
            />
            <Line 
              type="monotone" 
              dataKey="floor" 
              stroke="#FD8566" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
              strokeDasharray="4 4"
            />
            <Line 
              type="monotone" 
              dataKey="spot" 
              stroke="rgba(255,255,255,0.6)" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: "#fff", stroke: "#000", strokeWidth: 2 }}
            />
            
            {data.map((entry, index) => {
              if (entry.inTheMoney) {
                return (
                  <ReferenceLine 
                    key={`ref-${index}`}
                    x={entry.time} 
                    stroke="rgba(253,133,102,0.1)" 
                    strokeWidth={10} 
                  />
                );
              }
              return null;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
