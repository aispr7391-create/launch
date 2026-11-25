"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { feeLabel, PairLogos } from "@/features/pools/components/ui";
import type { IndexedPool } from "@/features/pools/types";
import { fmtEth } from "@/features/market/useMarket";
import type { ExploreRow } from "@/app/api/explore/route";
import { tokenPriceEth } from "./price";
import { cn } from "@/lib/cn";

type ExploreResponse = {
  configured: boolean;
  error?: string;
  indexedThroughBlock?: string | null;
  trending?: ExploreRow[];
  newest?: ExploreRow[];
  volume?: ExploreRow[];
  liquidity?: ExploreRow[];
  gainers?: ExploreRow[];
  losers?: ExploreRow[];
};

const TABS = [
  { key: "trending", label: "Trending", hint: "Most active pools by 24h volume and swaps." },
  { key: "newest", label: "New pairs", hint: "Pools most recently created by the Uniswap v3 factory." },
  { key: "gainers", label: "Gainers", hint: "Largest 24h price increase, WETH pairs with swaps in the last 24h." },
  { key: "losers", label: "Losers", hint: "Largest 24h price decrease, WETH pairs with swaps in the last 24h." },
  { key: "volume", label: "Top volume", hint: "Highest 24h volume in ETH (WETH pairs)." },
  { key: "liquidity", label: "Top liquidity", hint: "Most WETH locked in the pool." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmtPrice(n: number) {
  if (n === 0) return "0";
  if (n < 1e-9) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-faint">—</span>;
  const pct = v * 100;
  return (
    <span className={cn("num", pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-muted")}>
      {pct > 0 ? "+" : ""}
      {Math.abs(pct) >= 1000 ? pct.toExponential(2) : pct.toFixed(2)}%
    </span>
  );
}

function Rows({ rows, empty }: { rows: ExploreRow[]; empty: string }) {
  if (!rows.length) return <p className="px-5 py-8 text-center text-[13px] text-muted">{empty}</p>;
  return (
    <div className="divide-y divide-divider">
      <div className="hidden grid-cols-[2fr_1fr_0.8fr_1fr_1fr] gap-3 px-5 py-2.5 text-[11px] uppercase tracking-wider text-faint md:grid">
        <span>Pair</span>
        <span className="text-right">Price (ETH)</span>
        <span className="text-right">24h</span>
        <span className="text-right">Volume 24h</span>
        <span className="text-right">WETH locked</span>
      </div>
      {rows.map((p, i) => (
        <Link
          key={p.address}
          href={`/pools/${p.address}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 transition hover:bg-raised md:grid-cols-[2fr_1fr_0.8fr_1fr_1fr]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="num w-5 shrink-0 text-[11px] text-faint">{i + 1}</span>
            <PairLogos a={p.symbol0} b={p.symbol1} size={26} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium">{p.token ? p.token.symbol : `${p.symbol0}/${p.symbol1}`}</span>
              <span className="num block text-[11px] text-faint">
                {p.symbol0}/{p.symbol1} · {feeLabel(p.fee)}
              </span>
            </span>
          </span>
          {/* Mobile: price + change stacked on the right */}
          <span className="text-right md:hidden">
            <span className="num block text-[13px]">{p.token ? fmtPrice(p.token.priceEth) : "—"}</span>
            <span className="block text-[12px]"><Change v={p.change24h} /></span>
          </span>
          <span className="num hidden text-right text-[13px] md:block">{p.token ? fmtPrice(p.token.priceEth) : <span className="text-faint">non-WETH</span>}</span>
          <span className="hidden text-right text-[13px] md:block"><Change v={p.change24h} /></span>
          <span className="num hidden text-right text-[13px] text-muted md:block">{p.volume_eth_24h !== null ? fmtEth(p.volume_eth_24h) : "—"}</span>
          <span className="num hidden text-right text-[13px] text-muted md:block">{p.weth_reserve !== null ? fmtEth(p.weth_reserve) : "—"}</span>
        </Link>
      ))}
    </div>
  );
}

export function ExploreView() {
  const [tab, setTab] = useState<TabKey>("trending");
  const [q, setQ] = useState("");
  const query = q.trim();

  const data = useQuery({
    queryKey: ["explore"],
    queryFn: async (): Promise<ExploreResponse> => (await (await fetch("/api/explore")).json()) as ExploreResponse,
    refetchInterval: 60_000,
  });
  const search = useQuery({
    queryKey: ["explore-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/pools?q=${encodeURIComponent(query)}&sort=volume_eth_24h&limit=30`);
      return (await res.json()) as { configured: boolean; pools: IndexedPool[]; error?: string };
    },
  });

  const searchRows = useMemo<ExploreRow[]>(
    () => (search.data?.pools ?? []).map((p) => ({ ...p, token: tokenPriceEth(p, p.sqrt_price_x96), change24h: null })),
    [search.data],
  );
  const d = data.data;
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="Explore"
        description="Discover tokens and pairs on Robinhood Chain — trending, new, movers and rankings, all from indexed Uniswap v3 events."
        action={d?.indexedThroughBlock ? <Badge>Indexed to block <span className="num">{d.indexedThroughBlock}</span></Badge> : null}
      />

      <div className="relative">
        <Icon name="explore" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a token symbol or paste a token / pool address"
          aria-label="Search tokens and pairs"
          className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-4 text-sm outline-none transition placeholder:text-faint focus:border-accent"
        />
      </div>

      {query.length >= 2 ? (
        <Card>
          <div className="border-b border-line px-5 py-3.5 text-[13px] text-muted">
            Results for <span className="text-fg">“{query}”</span>
          </div>
          {search.isLoading ? (
            <div className="p-5"><Skeleton className="w-48" /></div>
          ) : search.data && !search.data.configured ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted">The market-data index is not configured.</p>
          ) : (
            <Rows rows={searchRows} empty="No indexed pairs match this search." />
          )}
        </Card>
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-medium transition",
                    tab === t.key ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted hover:text-fg",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <div className="border-b border-line px-5 py-3.5 text-[12px] text-faint">{active.hint}</div>
            {data.isLoading ? (
              <div className="space-y-2 p-5"><Skeleton className="w-56" /><Skeleton className="w-40" /></div>
            ) : !d?.configured ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted">
                The market-data index is not configured on this deployment, so there is nothing to show yet.
              </p>
            ) : d.error ? (
              <p className="px-5 py-8 text-center text-[13px] text-down">{d.error}</p>
            ) : !d.indexedThroughBlock ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted">
                The indexer has not run yet. Lists appear after its first pass — read straight from on-chain events.
              </p>
            ) : (
              <Rows rows={d[tab] ?? []} empty="Nothing here yet for the indexed period." />
            )}
          </Card>

          <Card className="flex items-start gap-3 p-5">
            <Icon name="launch" size={18} className="mt-0.5 shrink-0 text-faint" />
            <div>
              <p className="text-sm font-medium">Recently graduated</p>
              <p className="mt-1 text-[13px] leading-5 text-muted">
                Tokens that graduate from the SYNORA launchpad to Uniswap v3 will be listed here once the launchpad contracts are audited and
                deployed.
              </p>
            </div>
          </Card>
        </>
      )}

      <p className="text-[12px] leading-5 text-faint">
        Prices are in ETH and exist only for WETH pairs; there is no USD price source. 24h change compares the current pool price with the
        price after the first indexed swap in the last 24 hours. Anyone can create a token with any name — always check the address.
      </p>
    </div>
  );
}
