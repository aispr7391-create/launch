"use client";

import { useQuery } from "@tanstack/react-query";
import type { IndexedPool } from "@/features/pools/types";

export interface MarketResponse {
  configured: boolean;
  error?: string;
  indexedThroughBlock?: string | null;
  headBlock?: string | null;
  blocksBehind?: number | null;
  synced?: boolean;
  totals?: { pools: number; swaps24h: number; volumeEth24h: number; wethLocked: number };
  trending?: IndexedPool[];
  newest?: IndexedPool[];
}

export function useMarket() {
  return useQuery({
    queryKey: ["market"],
    queryFn: async (): Promise<MarketResponse> => (await (await fetch("/api/market")).json()) as MarketResponse,
    refetchInterval: 30_000,
  });
}

export const fmtEth = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n === 0 ? "0 ETH" : `${n < 0.0001 ? "<0.0001" : n.toLocaleString("en-US", { maximumSignificantDigits: 4 })} ETH`;
