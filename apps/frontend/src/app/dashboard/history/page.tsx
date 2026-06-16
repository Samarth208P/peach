"use client";

import React from "react";
import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';
import { ShieldCheck, History, ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";

const PACKAGE_ID = "0x49c002ce2aadfa23c699394e44be190188a9ec6ea0d2b8b3c23dce7779904d22";

export default function HistoryPage() {
  const currentAccount = useCurrentAccount();

  // Pull all cancellation/termination receipts emitted by the package
  const { data: cancellationEvents, isPending } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::peach_stream::StreamCanceled` },
      order: 'descending',
    },
    {
      enabled: !!currentAccount,
      refetchInterval: 5000,
    }
  );

  // Filter events locally where the user was a participant (sender or receiver)
  const userHistory = cancellationEvents?.data.filter((event) => {
    const payload = event.parsedJson as any;
    return (
      payload &&
      (payload.sender === currentAccount?.address ||
        payload.receiver === currentAccount?.address)
    );
  }) || [];

  return (
    <div className="flex flex-col gap-8 font-sans w-full max-w-[1200px] mx-auto px-4 py-6">
      <div>
        <h1 className="text-4xl font-medium font-display tracking-tight text-white flex items-center gap-3">
          <History className="text-[#FD8566]" /> Terminated Stream Receipts
        </h1>
        <p className="text-[#8a8690] text-lg font-light mt-2">
          Review immutable on-chain records of settled, canceled, and fully processed payment streams.
        </p>
      </div>

      <div className="border border-white/[0.08] bg-white/[0.02] backdrop-blur-md rounded-3xl p-8 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]">
        <h3 className="text-white font-display text-xl font-medium mb-6">Historical Ledger</h3>
        
        {isPending ? (
          <div className="text-center text-[#8a8690] py-10 font-mono">Scanning Event Ledgers...</div>
        ) : userHistory.length === 0 ? (
          <div className="text-center text-[#8a8690] py-10 font-mono">No historical receipts found.</div>
        ) : (
          <div className="space-y-4">
            {userHistory.map((tx) => {
              const data = tx.parsedJson as any;
              const isSender = data.sender === currentAccount?.address;
              const formattedTime = tx.timestampMs 
                ? new Date(Number(tx.timestampMs)).toLocaleString() 
                : "Recent block";
              
              return (
                <div 
                  key={tx.id.txDigest} 
                  className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 border border-white/[0.04] bg-white/[0.01] rounded-2xl gap-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${
                      !isSender ? 'bg-green-500/10 text-green-400' : 'bg-[#FD8566]/10 text-[#FD8566]'
                    }`}>
                      {!isSender ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">
                          {isSender ? 'Outbound Settle' : 'Inbound Payout'}
                        </span>
                        <span className="bg-white/10 text-white/60 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wide">
                          <ShieldCheck size={10} /> Archived
                        </span>
                      </div>
                      <div className="text-xs text-[#8a8690] font-mono mt-1 flex flex-col gap-0.5">
                        <span>Stream ID: {data.stream_id.substring(0, 14)}...</span>
                        <span className="flex items-center gap-1 text-[10px] text-[#8a8690]/75">
                          <Clock size={10} /> {formattedTime}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left md:text-right font-mono flex flex-col gap-1 w-full md:w-auto">
                    <p className="text-white text-sm">
                      Settled to Recipient: <span className="text-green-400 font-bold">{(Number(data.receiver_settled_amount) / 1e9).toFixed(4)} SUI</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      Refunded to Sender: <span className="text-white">{(Number(data.sender_refunded_amount) / 1e9).toFixed(4)} SUI</span>
                    </p>
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
