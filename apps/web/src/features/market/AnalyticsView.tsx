"use client";

import Link from "next/link";
import { Card, CardHeader, PageHeader, Skeleton } from "@/components/ui/primitives";
import { feeLabel, PairLogos } from "@/features/pools/components/ui";
import { fmtEth, useMarket } from "./useMarket";
import { SyncBadge } from "./MarketActivity";

export function AnalyticsView() {
  const { data, isLoading } = useMarket();
  const ready = data?.configured && !data.error && data.indexedThroughBlock && data.totals;

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="Analytics" description="Protocol-wide statistics. Every number comes from indexed on-chain events." />

      <Card>
        <CardHeader eyebrow="Uniswap v3 · Robinhood Chain" title="Market totals" action={<SyncBadge data={data} />} />
        {isLoading ? (
          <div className="p-5"><Skeleton className="w-48" /></div>
        ) : !ready ? (
          <p className="px-5 py-6 text-[13px] leading-5 text-muted">
            {data?.error ?? (data?.configured ? "The indexer has not run yet. Statistics appear after its first pass." : "Database not configured.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
            {[
              ["Pools", data.totals!.pools.toLocaleString("en-US")],
              ["Swaps (24h)", data.totals!.swaps24h.toLocaleString("en-US")],
              ["Volume (24h, WETH pairs)", fmtEth(data.totals!.volumeEth24h)],
              ["WETH locked in pools", fmtEth(data.totals!.wethLocked)],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-[12px] text-muted">{l}</p>
                <p className="num mt-1 text-xl font-semibold">{v}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {ready && (
        <Card>
          <CardHeader eyebrow="Top pools" title="By 24h volume" action={<Link href="/pools/explore" className="text-[12px] text-faint hover:text-fg">All pools →</Link>} />
          {data.trending?.length ? (
            <div className="divide-y divide-line">
              {data.trending.map((p, i) => (
                <Link key={p.address} href={`/pools/${p.address}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raised">
                  <span className="num w-4 text-[12px] text-faint">{i + 1}</span>
                  <PairLogos a={p.symbol0} b={p.symbol1} size={24} />
                  <span className="min-w-0 flex-1 text-[13px] font-medium">{p.symbol0}/{p.symbol1} <span className="num text-faint">{feeLabel(p.fee)}</span></span>
                  <span className="num text-right text-[12px]">
                    {p.volume_eth_24h !== null ? fmtEth(p.volume_eth_24h) : "—"}
                    <span className="block text-faint">{p.swaps_24h} swaps</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-5 py-6 text-[13px] text-muted">No swaps in the last 24h{data.synced ? "" : " indexed so far"}.</p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader eyebrow="Not available yet" title="Launchpad statistics" />
        <p className="px-5 py-5 text-[13px] leading-5 text-muted">
          Tokens launched and graduated, bonding-curve volume and protocol fees come from the PROJECT X launchpad contract, which is
          not deployed yet (audit required). They will appear here once it is.
        </p>
      </Card>
    </div>
  );
}
