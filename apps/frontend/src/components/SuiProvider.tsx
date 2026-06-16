"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';

import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient();
const networks = {
  testnet: { url: 'https://fullnode.testnet.sui.io:443', network: 'testnet' as const },
  mainnet: { url: 'https://fullnode.mainnet.sui.io:443', network: 'mainnet' as const },
};

export function SuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
