"use client";

import Link from "next/link";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { feeLabel, PairLogos } from "@/features/pools/components/ui";
import type { IndexedPool } from "@/features/pools/types";
import { fmtEth, useMarket, type MarketResponse } from "./useMarket";

export function SyncBadge({ data }: { data?: MarketResponse }) {
  if (!data?.configured || data.error || !data.indexedThroughBlock) return <Badge>Not indexed yet</Badge>;
  if (data.synced) return <Badge tone="up">Live</Badge>;
  return <Badge tone="info">Syncing{data.blocksBehind ? ` · ${data.blocksBehind.toLocaleString("en-US")} blocks behind` : ""}</Badge>;
}

function PoolRow({ p, right }: { p: IndexedPool; right: React.ReactNode }) {
  return (
    <Link href={`/pools/${p.address}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-raised">
      <PairLogos a={p.symbol0} b={p.symbol1} size={22} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{p.symbol0}/{p.symbol1}</span>
        <span className="num block text-[11px] text-faint">{feeLabel(p.fee)}</span>
      </span>
      <span className="num text-right text-[12px] text-muted">{right}</span>
    </Link>
  );
}

export function MarketActivity() {
  const { data, isLoading } = useMarket();

  return (
    <Card className="lg:col-span-2">
      <CardHeader eyebrow="Market activity" title="Uniswap v3 on Robinhood Chain" action={<SyncBadge data={data} />} />
      {isLoading ? (
        <div className="space-y-2 p-5"><Skeleton className="w-48" /><Skeleton className="w-32" /></div>
      ) : !data?.configured ? (
        <p className="px-5 py-6 text-[13px] leading-5 text-muted">Database not configured. Market data appears once the indexer has storage.</p>
      ) : data.error ? (
        <p className="px-5 py-6 text-[13px] leading-5 text-down">{data.error}</p>
      ) : !data.indexedThroughBlock ? (
        <p className="px-5 py-6 text-[13px] leading-5 text-muted">
          The indexer has not run yet. Data appears after its first pass — read straight from on-chain events, no placeholder numbers.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4 sm:grid-cols-4">
            <Mini label="Pools" value={data.totals!.pools.toLocaleString("en-US")} />
            <Mini label="Swaps 24h" value={data.totals!.swaps24h.toLocaleString("en-US")} />
            <Mini label="Volume 24h" value={fmtEth(data.totals!.volumeEth24h)} hint="WETH pairs" />
            <Mini label="WETH locked" value={fmtEth(data.totals!.wethLocked)} />
          </div>
          <div className="grid divide-divider sm:grid-cols-2 sm:divide-x">
            <div className="py-2">
              <p className="px-5 py-2 text-[11px] uppercase tracking-wider text-faint">Trending · 24h volume</p>
              {data.trending?.length ? (
                data.trending.map((p) => (
                  <PoolRow key={p.address} p={p} right={p.volume_eth_24h !== null ? fmtEth(p.volume_eth_24h) : `${p.swaps_24h} swaps`} />
                ))
              ) : (
                <p className="px-5 pb-3 text-[12px] text-faint">No swaps in the last 24h{data.synced ? "" : " indexed so far"}.</p>
              )}
            </div>
            <div className="border-t border-line py-2 sm:border-t-0">
              <p className="px-5 py-2 text-[11px] uppercase tracking-wider text-faint">Newest pools</p>
              {data.newest?.length ? (
                data.newest.map((p) => (
                  <PoolRow key={p.address} p={p} right={p.created_at ? new Date(p.created_at).toLocaleDateString() : `#${p.created_block}`} />
                ))
              ) : (
                <p className="px-5 pb-3 text-[12px] text-faint">No pools indexed yet.</p>
              )}
            </div>
          </div>
          <p className="border-t border-line px-5 py-3 text-[11px] leading-4 text-faint">
            From official Uniswap v3 factory and pool events, indexed through block <span className="num">{data.indexedThroughBlock}</span>.
            ETH figures cover WETH pairs only. Token launches from PROJECT X appear once the launchpad is deployed.
          </p>
        </>
      )}
    </Card>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="num truncate text-[15px] font-semibold">{value}</p>
      {hint && <p className="text-[10px] text-faint">{hint}</p>}
    </div>
  );
}
