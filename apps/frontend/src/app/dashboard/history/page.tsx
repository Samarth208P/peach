"use client";

import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';

const PACKAGE_ID = "0x49c002ce2aadfa23c699394e44be190188a9ec6ea0d2b8b3c23dce7779904d22";

export default function HistoricalLedgerTable() {
  const currentAccount = useCurrentAccount();

  // Pull all cancellation receipts emitted by the package
  const { data: cancellationEvents, isLoading } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::peach_stream::StreamCanceled` },
      order: 'descending',
    }
  );

  if (isLoading) return <div className="text-[#8a8690] p-6">Fetching Historical Receipts...</div>;

  // Filter events locally where the user was a participant
  const userHistory = cancellationEvents?.data.filter((event) => {
    const payload = event.parsedJson as any;
    return payload.sender === currentAccount?.address || payload.receiver === currentAccount?.address;
  });

  return (
    <div className="border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] backdrop-blur-md rounded-xl p-6">
      <h3 className="text-white font-medium mb-4">Terminated & Completed Stream Receipts</h3>
      <div className="space-y-3">
        {userHistory?.length === 0 && (
          <div className="text-[#8a8690] py-4 text-sm">No historical receipts found.</div>
        )}
        {userHistory?.map((tx) => {
          const data = tx.parsedJson as any;
          const isSender = data.sender === currentAccount?.address;

          return (
            <div key={tx.id.txDigest} className="flex justify-between items-center text-sm font-mono py-2 border-b border-[rgba(255,255,255,0.05)]">
              <div>
                <span className="text-[#FF7A59]">{isSender ? 'OUTBOUND' : 'INBOUND'}</span>
                <p className="text-gray-400 text-xs">ID: {data.stream_id.substring(0, 10)}...</p>
              </div>
              <div className="text-right">
                <p className="text-white">Settled to Staff: {(data.receiver_settled_amount / 1e9).toFixed(2)} SUI</p>
                <p className="text-gray-500 text-xs">Refunded to Firm: {(data.sender_refunded_amount / 1e9).toFixed(2)} SUI</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
