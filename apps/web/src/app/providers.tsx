"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { TxProvider } from "@/features/tx/TxProvider";
import { TxToaster } from "@/features/tx/TxToaster";

export function Providers({ children, initialState }: { children: React.ReactNode; initialState?: State }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 2 } },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <TxProvider>
          {children}
          <TxToaster />
        </TxProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
