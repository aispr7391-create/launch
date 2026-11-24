"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";
import { Badge, Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { usePairPools } from "../hooks";
import { choiceSymbol, isNative, type TokenChoice } from "../tokens";
import { CONTRACTS } from "@/config/contracts";
import type { IndexedPool } from "../types";
import { TokenSelectModal } from "./TokenSelectModal";
import { AddressLink, EmptyState, feeLabel, fmtAmount, Notice, PairLogos, TokenLogo } from "./ui";

type PoolsResponse = { configured: boolean; pools: IndexedPool[]; total?: number | null; indexedThroughBlock?: string | null; error?: string };

export function usePoolIndex(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return useQuery({
    queryKey: ["pool-index", qs],
    queryFn: async (): Promise<PoolsResponse> => {
      const res = await fetch(`/api/pools?${qs}`);
      return (await res.json()) as PoolsResponse;
    },
    refetchInterval: 30_000,
  });
}

export function ExplorePools() {
  const [q, setQ] = useState("");
  const [fee, setFee] = useState("");
  const [sort, setSort] = useState<"weth_reserve" | "volume_eth_24h" | "created">("weth_reserve");
  const index = usePoolIndex({ q: q.trim(), fee, sort });

  return (
    <div className="space-y-6">
      <PairLookup />

      <Card>
        <CardHeader
          eyebrow="Indexed pools"
          title="All Uniswap v3 pools on Robinhood Chain"
          action={index.data?.indexedThroughBlock ? <Badge>Indexed to block <span className="num">{index.data.indexedThroughBlock}</span></Badge> : null}
        />
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or paste token / pool address"
            className="h-10 flex-1 rounded-lg border border-line-strong bg-canvas px-3 text-sm outline-none focus:border-accent" aria-label="Search pools" />
          <select value={fee} onChange={(e) => setFee(e.target.value)} className="h-10 rounded-lg border border-line-strong bg-canvas px-3 text-sm" aria-label="Fee tier">
            <option value="">All fee tiers</option>
            {[100, 500, 3000, 10000].map((f) => <option key={f} value={f}>{feeLabel(f)}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 rounded-lg border border-line-strong bg-canvas px-3 text-sm" aria-label="Sort">
            <option value="weth_reserve">Sort: liquidity (WETH locked)</option>
            <option value="volume_eth_24h">Sort: 24h volume (ETH)</option>
            <option value="created">Sort: newest</option>
          </select>
        </div>
        {index.isLoading ? (
          <div className="p-5"><Skeleton className="w-48" /></div>
        ) : !index.data?.configured ? (
          <EmptyState title="Pool index not configured">
            Listing every pool needs the market-data indexer (services/market-data) and its database. Until it runs, use the pair
            lookup above — it reads pools directly from the Uniswap v3 factory on-chain.
          </EmptyState>
        ) : index.data.error ? (
          <Notice tone="down">{index.data.error}</Notice>
        ) : index.data.pools.length === 0 ? (
          <EmptyState title="No pools match">Try another search or fee tier.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">Pool</th>
                  <th className="px-4 py-2.5 font-medium">Fee</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reserves</th>
                  <th className="px-4 py-2.5 text-right font-medium">WETH locked</th>
                  <th className="px-4 py-2.5 text-right font-medium">24h volume</th>
                  <th className="px-4 py-2.5 text-right font-medium">24h swaps</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {index.data.pools.map((p) => (
                  <tr key={p.address} className="hover:bg-raised">
                    <td className="px-4 py-3">
                      <Link href={`/pools/${p.address}`} className="flex items-center gap-2.5">
                        <PairLogos a={p.symbol0} b={p.symbol1} size={22} />
                        <span><span className="font-medium">{p.symbol0}/{p.symbol1}</span><span className="block"><AddressLink address={p.address} /></span></span>
                      </Link>
                    </td>
                    <td className="num px-4 py-3">{feeLabel(p.fee)}</td>
                    <td className="num px-4 py-3 text-right">
                      {p.reserve0 && p.reserve1 ? <>{fmtAmount(BigInt(p.reserve0), p.decimals0, 4)} {p.symbol0}<br />{fmtAmount(BigInt(p.reserve1), p.decimals1, 4)} {p.symbol1}</> : "—"}
                    </td>
                    <td className="num px-4 py-3 text-right">{p.weth_reserve !== null ? `${p.weth_reserve.toPrecision(4)} ETH` : <span className="text-faint">non-WETH pair</span>}</td>
                    <td className="num px-4 py-3 text-right">{p.volume_eth_24h !== null ? `${p.volume_eth_24h.toPrecision(4)} ETH` : <span className="text-faint">{fmtAmount(BigInt(p.volume0_24h), p.decimals0, 4)} {p.symbol0}</span>}</td>
                    <td className="num px-4 py-3 text-right">{p.swaps_24h}</td>
                    <td className="px-4 py-3 text-faint">{p.created_at ? new Date(p.created_at).toLocaleDateString() : `#${p.created_block}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-4 py-3 text-[12px] leading-5 text-faint">
          Every pool here was created by the official Uniswap v3 factory (PoolCreated events). Reserves are the token balances held by
          the pool contract. ETH figures exist only for WETH pairs; there is no USD price source.
        </p>
      </Card>
    </div>
  );
}

/** On-chain pool lookup for a token pair. Works without the indexer. */
export function PairLookup() {
  const [a, setA] = useState<TokenChoice | null>({ ...({ address: CONTRACTS.weth.address!, symbol: "WETH", name: "Wrapped Ether", decimals: 18 }), source: "official" });
  const [b, setB] = useState<TokenChoice | null>(null);
  const [picker, setPicker] = useState<"a" | "b" | null>(null);
  const addr = (t: TokenChoice | null) => (!t ? undefined : isNative(t) ? CONTRACTS.weth.address! : t.address);
  const pools = usePairPools(addr(a), addr(b));

  return (
    <Card>
      <CardHeader eyebrow="On-chain lookup" title="Find pools for a pair" />
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          {(["a", "b"] as const).map((k) => {
            const t = k === "a" ? a : b;
            return (
              <button key={k} onClick={() => setPicker(k)} className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 text-left text-sm hover:border-faint">
                {t && <TokenLogo symbol={choiceSymbol(t)} size={22} />}
                <span className={t ? "font-medium" : "text-muted"}>{t ? choiceSymbol(t) : "Select token"}</span>
              </button>
            );
          })}
        </div>
        {a && b && (
          pools.isLoading ? <Skeleton className="w-40" /> : pools.isError ? <Notice tone="down">Factory lookup failed.</Notice> : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {pools.data?.map((p) => (
                <div key={p.fee} className={cn("rounded-xl border p-3 text-[13px]", p.state ? "border-line-strong" : "border-line opacity-60")}>
                  <p className="num font-medium">{feeLabel(p.fee)}</p>
                  {p.state ? (
                    <>
                      <p className="text-[12px] text-faint">{p.state.liquidity > 0n ? "Active liquidity" : "No active liquidity"}</p>
                      <div className="mt-2 flex gap-2">
                        <Link href={`/pools/${p.state.address}`}><Button size="sm">Details</Button></Link>
                        <Link href={`/pools/add?pool=${p.state.address}`}><Button size="sm" variant="primary">Add</Button></Link>
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] text-faint">{p.address ? "Created, not initialised" : "No pool"}</p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {picker && (
        <TokenSelectModal onClose={() => setPicker(null)} onSelect={(t) => { if (picker === "a") setA(t); else setB(t); setPicker(null); }} />
      )}
    </Card>
  );
}

export const isPoolAddress = (s: string) => isAddress(s);
