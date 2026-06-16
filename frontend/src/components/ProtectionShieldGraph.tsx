"use client";

import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function ProtectionShieldGraph() {
  const [data, setData] = React.useState<any[]>([]);

  React.useEffect(() => {
    const pts = [];
    let currentPrice = 1.0;
    const floorPrice = 0.85;

    for (let i = 0; i < 50; i++) {
      // Simulate high volatility crypto spot price
      currentPrice = currentPrice * (1 + (Math.random() - 0.52) * 0.1);
      
      pts.push({
        time: i,
        spot: Math.max(0.4, currentPrice), // Don't go below 0.4 for visualization
        floor: floorPrice,
        inTheMoney: currentPrice < floorPrice
      });
    }
    setData(pts);
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col relative group">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-white font-medium font-display">Protection Shield</h3>
          <p className="text-[#8a8690] text-sm">DeepBook V3 Put Option Coverage</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-white/50"></div>
            <span className="text-white/60">SUI Spot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#FD8566]"></div>
            <span className="text-[#FD8566]">Floor</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        {/* Background glow when in the money */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#FD8566]/10 to-transparent pointer-events-none opacity-50" />
        
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
              labelStyle={{ display: 'none' }}
              formatter={(value: number, name: string) => [
                `$${value.toFixed(2)}`, 
                name === 'spot' ? 'SUI Spot Price' : 'Guaranteed Floor'
              ]}
            />
            {/* The guaranteed floor line */}
            <Line 
              type="monotone" 
              dataKey="floor" 
              stroke="#FD8566" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
              strokeDasharray="4 4"
            />
            {/* The volatile spot price line */}
            <Line 
              type="monotone" 
              dataKey="spot" 
              stroke="rgba(255,255,255,0.6)" 
              strokeWidth={2} 
              dot={false}
              activeDot={{ r: 4, fill: "#fff", stroke: "#000", strokeWidth: 2 }}
            />
            
            {/* Dynamic visual indicator for crash zones */}
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
