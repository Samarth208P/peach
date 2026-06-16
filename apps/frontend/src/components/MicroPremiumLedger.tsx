"use client";

import React, { useEffect, useState } from "react";
import { Terminal, ExternalLink } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  streamId: string;
  premium: string;
  txHash: string;
}

export default function MicroPremiumLedger() {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(Date.now() - i * 60000).toLocaleTimeString([], { hour12: false }),
      streamId: `st_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      premium: (Math.random() * 0.5 + 0.1).toFixed(3),
      txHash: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
    }));
  });

  useEffect(() => {

    // Simulate incoming ledger events
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLog = {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          streamId: `st_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          premium: (Math.random() * 0.5 + 0.1).toFixed(3),
          txHash: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
        };
        return [newLog, ...prev].slice(0, 8); // Keep only 8 logs
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <Terminal size={18} className="text-[#8a8690]" />
        <h3 className="text-white font-medium text-sm font-mono tracking-tight uppercase opacity-80">PTB Execution Ledger</h3>
      </div>
      
      <div className="flex-1 overflow-hidden bg-white/[0.02] backdrop-blur-md border border-white/[0.03] rounded-[20px] p-4">
        <div className="flex flex-col gap-2">
          {logs.map((log, index) => (
            <div 
              key={log.id} 
              className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors group animate-in fade-in slide-in-from-top-2 duration-500"
              style={{ opacity: 1 - (index * 0.15) }}
            >
              <div className="flex items-center gap-4">
                <span className="text-[#8a8690]">{log.timestamp}</span>
                <span className="text-white">{log.streamId}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-[#FD8566]">- {log.premium} SUI</span>
                <a href="#" className="flex items-center gap-1 text-blue-400/80 hover:text-blue-300 transition-colors">
                  {log.txHash} <ExternalLink size={10} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
