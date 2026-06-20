import React, { useMemo } from "react";
import { AreaChart, Area, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import { ShieldAlert, Activity, ArrowRightLeft } from "lucide-react";

interface StreamConfig {
  id: string;
  strikePrice?: number;
  hedgeDirection?: number; // 0=FLOOR, 1=CEILING, 2=NONE
}

export default function StreamActivityGraph({ config, currentPrice }: { config: StreamConfig, currentPrice: number }) {
  // Generate historical data with volatility bands
  const data = useMemo(() => {
    if (!currentPrice) return [];
    
    const points = 40;
    let price = currentPrice;
    const generated = [];
    
    // Reverse random walk
    for(let i=0; i<points; i++) {
      if (i !== 0) {
        const change = currentPrice * 0.006 * (Math.random() - 0.5); // 0.6% max jump
        price = price - change;
      }
      
      // Calculate dynamic volatility bands based on simulated "implied volatility"
      const iv = 0.015 + (Math.random() * 0.01); // 1.5% to 2.5% implied vol
      const p = i === 0 ? currentPrice : price;
      
      generated.push({
        time: i,
        price: p,
        volBand: [p * (1 - iv), p * (1 + iv)],
        upperBand: p * (1 + iv), // Kept for tooltip
        lowerBand: p * (1 - iv), // Kept for tooltip
      });
    }
    return generated.reverse();
  }, [currentPrice]);

  const strikeDistance = config.strikePrice && currentPrice 
    ? Math.abs((currentPrice - config.strikePrice) / currentPrice * 100) 
    : 0;

  const isTriggered = config.strikePrice && config.hedgeDirection !== 2 && currentPrice
    ? (config.hedgeDirection === 0 && currentPrice <= config.strikePrice) || 
      (config.hedgeDirection === 1 && currentPrice >= config.strikePrice)
    : false;

  return (
    <div className="w-full h-full flex flex-col bg-[#141418]/60 rounded-2xl border border-white/5 p-5 relative overflow-hidden min-h-0">
      
      {/* Premium Header Metrics */}
      <div className="flex flex-col gap-4 mb-4 shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-[#8a8690] font-medium text-xs font-mono tracking-widest uppercase mb-1 flex items-center gap-2">
              <Activity size={12} className="text-[#FF8B5E]" /> Pyth Oracle Spot
            </h3>
            <p className="text-3xl font-mono text-white flex items-center gap-3">
              ${currentPrice?.toFixed(4) || "0.0000"}
              {isTriggered && (
                <span className="text-xs bg-[#FF8B5E]/20 text-[#FF8B5E] px-2 py-1 rounded flex items-center gap-1 border border-[#FF8B5E]/30 animate-pulse">
                  <ShieldAlert size={12} /> HEDGING ACTIVE
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            {config.strikePrice ? (
              <>
                <p className="text-[#8a8690] text-xs font-mono tracking-widest uppercase mb-1">Dist. to Strike</p>
                <p className={`text-xl font-mono ${strikeDistance < 2 ? "text-[#FF8B5E]" : strikeDistance < 5 ? "text-yellow-400" : "text-green-400"}`}>
                  {strikeDistance.toFixed(2)}%
                </p>
              </>
            ) : (
              <span className="text-[#8a8690] text-xs font-mono tracking-wider uppercase border border-white/10 px-2 py-1 rounded">Unhedged</span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-mono tracking-wider bg-white/5 px-3 py-2 rounded-xl w-fit">
          <span className="flex items-center gap-1.5 text-white">
            <span className="w-3 h-0.5 bg-white rounded-full"></span> SPOT
          </span>
          <span className="flex items-center gap-1.5 text-[#8a8690]">
            <span className="w-3 h-3 bg-white/5 border border-white/10 rounded-sm"></span> VOLATILITY BANDS
          </span>
          {config.strikePrice && (
            <span className="flex items-center gap-1.5 text-[#FF8B5E]">
              <span className="w-3 h-0.5 border-t border-dashed border-[#FF8B5E]"></span> STRIKE ({config.hedgeDirection === 0 ? "FLOOR" : "CEILING"})
            </span>
          )}
        </div>
      </div>
      
      {/* Chart Area */}
      <div className="flex-1 w-full min-h-0">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.03}/>
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0.03}/>
                </linearGradient>
              </defs>
              
              <Tooltip 
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const spot = payload.find(p => p.dataKey === 'price')?.value as number;
                    const strike = config.strikePrice;
                    
                    return (
                      <div className="bg-[#0a0a0c]/95 border border-white/10 rounded-xl p-3 backdrop-blur-xl shadow-2xl min-w-[160px]">
                        <div className="text-[10px] text-[#8a8690] uppercase tracking-widest font-mono border-b border-white/5 pb-2 mb-2 flex justify-between">
                          <span>Real-time</span>
                          <Activity size={10} className="text-[#FF8B5E]" />
                        </div>
                        
                        <div className="space-y-1.5 font-mono text-[11px]">
                          <div className="flex justify-between items-center text-white text-[12px] font-bold py-0.5">
                            <span>Spot:</span>
                            <span>${spot?.toFixed(4)}</span>
                          </div>
                          
                          {strike && (
                            <div className="flex justify-between items-center text-[#8a8690]">
                              <span>Gap:</span>
                              <span>{Math.abs(((spot - strike) / spot) * 100).toFixed(2)}%</span>
                            </div>
                          )}
                          
                          {strike && (
                            <div className="flex justify-between items-center text-[#FF8B5E] border-t border-white/5 pt-1.5 mt-1.5">
                              <span>Strike:</span>
                              <span>${strike.toFixed(4)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {config.strikePrice && (
                <ReferenceLine 
                  y={config.strikePrice} 
                  stroke="#FF8B5E" 
                  strokeDasharray="4 4" 
                  strokeWidth={1}
                />
              )}
              
              <Area 
                type="monotone" 
                dataKey="volBand" 
                stroke="none"
                fill="#ffffff" 
                fillOpacity={0.03}
                isAnimationActive={false}
              />
              
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#ffffff" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[#5a5660] text-xs font-mono">
            Waiting for oracle connection...
          </div>
        )}
      </div>
    </div>
  );
}
