"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export default function DashboardOverview() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Soothing, slower animations for a premium feel
      gsap.from(".dash-card", {
        y: 30,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
      });
      gsap.from(".dash-row", {
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power2.out",
        delay: 0.5,
      });
    },
    { scope: container }
  );

  return (
    <div ref={container} className="flex flex-col gap-10">
      <div>
        <h1 className="text-4xl font-medium font-display tracking-tight text-white mb-3">Overview</h1>
        <p className="text-text-muted text-lg font-light">Monitor your active payment streams and volatility protection.</p>
      </div>

      {/* Stats Grid - Deep Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="dash-card p-8 rounded-[2rem] bg-surface-1/50 backdrop-blur-xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-[#FF8B5E]/30 transition-colors duration-500">
          <div className="text-sm text-text-muted mb-3 font-medium">Total Value Streamed</div>
          <div className="text-4xl font-display font-medium text-white tracking-tight">$5,240,000</div>
          <div className="text-sm text-success mt-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Active flowing capital
          </div>
        </div>
        
        <div className="dash-card p-8 rounded-[2rem] bg-surface-1/50 backdrop-blur-xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-[#FF8B5E]/30 transition-colors duration-500">
          <div className="text-sm text-text-muted mb-3 font-medium">Active Protection (Put Options)</div>
          <div className="text-4xl font-display font-medium text-white tracking-tight">$1,150,000</div>
          <div className="text-sm text-success mt-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            +12% downside covered
          </div>
        </div>

        <div className="dash-card p-8 rounded-[2rem] bg-surface-1/50 backdrop-blur-xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-[#FF8B5E]/30 transition-colors duration-500">
          <div className="text-sm text-text-muted mb-3 font-medium">Predict Pool Premium</div>
          <div className="text-4xl font-display font-medium text-[#FF8B5E] tracking-tight">1.00%</div>
          <div className="text-sm text-text-muted mt-4">Fixed micro-margin allocation</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        {/* Soft, glowing Chart Area */}
        <div className="dash-card p-8 rounded-[2rem] bg-surface-1/50 backdrop-blur-xl border border-white/5 shadow-2xl lg:col-span-2 min-h-[350px] flex flex-col relative overflow-hidden">
          <h2 className="text-xl font-display font-medium text-white mb-8">Asset Value vs Protected Floor</h2>
          <div className="flex-1 flex items-end gap-3 pt-10 border-b border-white/5 relative z-10">
            {/* Height represents Asset Value, glowing line represents Floor */}
            {[80, 75, 60, 45, 55, 65, 90].map((h, i) => {
              const floor = 60; // 60% is the protected floor
              return (
                <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 group cursor-pointer relative">
                  {/* The Floor Line (Option Strike) */}
                  <div className="absolute w-full border-t-2 border-[#FF8B5E]/80 border-dashed z-20 transition-all duration-300" style={{ bottom: `${floor}%` }} />
                  
                  {/* Asset Value Bar */}
                  <div 
                    className={`w-full rounded-t-md transition-all duration-300 ${h < floor ? "bg-error/30" : "bg-white/10 group-hover:bg-white/20"}`}
                    style={{ height: `${h}%` }} 
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 rounded-t-md" />
                  </div>
                  
                  {/* Insurance Payout Fill if asset drops below floor */}
                  {h < floor && (
                    <div 
                      className="w-full bg-gradient-to-t from-transparent to-[#FF8B5E]/50 rounded-t-md transition-all duration-300 absolute bottom-0 z-10"
                      style={{ height: `${floor}%`, clipPath: `inset(${100 - ((floor - h) / floor * 100)}% 0 0 0)` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 text-sm text-text-muted px-2 relative z-10">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        {/* Recent Transactions - Clean Web2 Look */}
        <div className="dash-card rounded-[2rem] bg-surface-1/50 backdrop-blur-xl border border-white/5 shadow-2xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-white/5">
            <h2 className="text-xl font-display font-medium text-white">Execution Log</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-white/5">
              {[
                { type: "STREAM_INIT", event: "Development Agency", status: "ACTIVE", time: "2m ago" },
                { type: "PREMIUM_ROUTE", event: "DeepBook Pool", status: "PROCESSED", time: "2m ago" },
                { type: "MINT_PUT", event: "Strike $1.25 SUI", status: "HEDGED", time: "3m ago" },
                { type: "PAYOUT", event: "Monthly Milestone", status: "CLEARED", time: "14m ago" },
                { type: "STREAM_INIT", event: "DAO Payroll", status: "ACTIVE", time: "1hr ago" },
                { type: "PREMIUM_ROUTE", event: "DeepBook Pool", status: "PROCESSED", time: "1hr ago" },
              ].map((tx, i) => (
                <div key={i} className="dash-row p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors duration-300 cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-white tracking-wide">{tx.type}</div>
                    <div className="text-sm text-text-muted mt-0.5">{tx.event}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={`text-xs px-3 py-1 rounded-full font-medium ${
                      tx.status === "ACTIVE" ? "bg-success/10 text-success border border-success/20" :
                      tx.status === "HEDGED" ? "bg-[#FF8B5E]/10 text-[#FF8B5E] border border-[#FF8B5E]/20" :
                      "bg-white/10 text-white border border-white/20"
                    }`}>
                      {tx.status}
                    </div>
                    <div className="text-xs text-text-muted mt-1.5">{tx.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
