"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { isAddressEqual } from "viem";
import { useAccount } from "wagmi";
import { Badge, Button, Card, CardHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { explorer } from "@/lib/explorer";
import { shortAddress, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { usePool, usePositions } from "../hooks";
import { formatPrice, sqrtPriceToPrice } from "../math/price";
import { rangeStatus } from "../plan";
import { usePoolIndex } from "./Explore";
import { rangeText } from "./Positions";
import { AddressLink, EmptyState, feeLabel, fmtAmount, Notice, PairLogos, RangeBadge } from "./ui";

type EventRow = { kind: string; blockNumber: string; txHash: string; timestamp?: number; sender?: string; owner?: string; amount0: string; amount1: string; liquidity?: string; sqrtPriceX96?: string };

export function PoolDetail({ address }: { address: string }) {
  const pool = usePool(address);
  const [invert, setInvert] = useState(false);
  const [tab, setTab] = useState<"swap" | "liquidity">("swap");
  const stats = usePoolIndex({ q: address.toLowerCase() });
  const events = useQuery({
    queryKey: ["pool-events", address, tab],
    queryFn: async () => {
      const res = await fetch(`/api/pools/${address}/events?kind=${tab}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      return body as { events: EventRow[]; scannedFromBlock: string; headBlock: string };
    },
    refetchInterval: 30_000,
  });
  const history = useQuery({
    queryKey: ["pool-history", address],
    queryFn: async () => (await (await fetch(`/api/pools/${address}/history`)).json()) as { configured: boolean; swaps: { block_time: string; sqrt_price_x96: string }[]; liquidity: { block_time: string; kind: string; liquidity: string }[] },
  });
  const { address: me } = useAccount();
  const mine = usePositions();

  if (pool.isLoading) return <Card className="p-5"><Skeleton className="w-60" /></Card>;
  if (pool.isError || !pool.data) return <Notice tone="down">{(pool.error as Error)?.message ?? "Pool not found."}</Notice>;
  const p = pool.data;
  const { token0, token1 } = p;
  const price01 = sqrtPriceToPrice(p.sqrtPriceX96, token0.decimals, token1.decimals);
  const [base, quote, price] = invert ? [token1, token0, 1 / price01] : [token0, token1, price01];
  const indexed = stats.data?.pools?.find((x) => x.address === p.address.toLowerCase());
  const myPositions = (mine.data ?? []).filter((x) => isAddressEqual(x.pool.address, p.address));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <PairLogos a={token0.symbol} b={token1.symbol} size={36} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{token0.symbol}/{token1.symbol} <Badge className="ml-1">{feeLabel(p.fee)}</Badge> <Badge tone="up">Official Uniswap v3 pool</Badge></h1>
            <p className="mt-0.5 text-[12px]"><AddressLink address={p.address} chars={6} /></p>
          </div>
          <Link href={`/pools/add?pool=${p.address}`}><Button variant="primary">Add liquidity</Button></Link>
        </div>
        <div className="grid grid-cols-2 gap-5 border-t border-line p-5 sm:grid-cols-4">
          <Stat label="Current price" value={<button onClick={() => setInvert((v) => !v)} className="hover:text-accent" title="Invert">{formatPrice(price)}</button>} hint={`${quote.symbol} per ${base.symbol} · tap to invert`} />
          <Stat label={`${token0.symbol} in pool`} value={fmtAmount(p.reserve0, token0.decimals)} hint="Token balance of pool" />
          <Stat label={`${token1.symbol} in pool`} value={fmtAmount(p.reserve1, token1.decimals)} hint="Token balance of pool" />
          <Stat label="Active liquidity (L)" value={p.liquidity.toLocaleString("en-US", { notation: "compact" } as Intl.NumberFormatOptions)} hint={`Tick ${p.tick}`} />
          <Stat label="24h volume" value={indexed ? (indexed.volume_eth_24h !== null ? `${indexed.volume_eth_24h.toPrecision(4)} ETH` : `${fmtAmount(BigInt(indexed.volume0_24h), token0.decimals)} ${token0.symbol}`) : "—"} hint={indexed ? `${indexed.swaps_24h} swaps (indexed)` : "Needs indexer"} />
          <Stat label="Fee tier" value={feeLabel(p.fee)} hint={`Tick spacing ${p.tickSpacing}`} />
          <Stat label="Created" value={indexed?.created_at ? new Date(indexed.created_at).toLocaleDateString() : "—"} hint={indexed ? `Block ${indexed.created_block}` : "Needs indexer"} />
        </div>
        <div className="grid gap-2 border-t border-line px-5 py-3 text-[12px] sm:grid-cols-2">
          <p><span className="text-faint">{token0.symbol}: </span><AddressLink address={token0.address} chars={6} /></p>
          <p><span className="text-faint">{token1.symbol}: </span><AddressLink address={token1.address} chars={6} /></p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="History" title="Price from indexed swaps" />
          {history.data?.configured && history.data.swaps.length > 1 ? (
            <PriceChart points={history.data.swaps.map((s) => ({ t: Date.parse(s.block_time), p: sqrtPriceToPrice(BigInt(s.sqrt_price_x96), token0.decimals, token1.decimals) }))} invert={invert} label={`${quote.symbol}/${base.symbol}`} />
          ) : (
            <EmptyState title="No reliable price history">The chart is drawn only from Swap events recorded by the indexer. {history.data?.configured === false ? "The indexer is not configured." : "This pool has no indexed swaps yet."}</EmptyState>
          )}
        </Card>
        <Card>
          <CardHeader eyebrow="Your positions" title="In this pool" />
          {!me ? <EmptyState title="Connect a wallet to see your positions here" /> : mine.isLoading ? <div className="p-5"><Skeleton /></div> : myPositions.length === 0 ? (
            <EmptyState title="You have no position in this pool"><Link className="text-accent hover:underline" href={`/pools/add?pool=${p.address}`}>Add liquidity</Link></EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {myPositions.map((x) => (
                <li key={x.tokenId.toString()}>
                  <Link href={`/pools/positions/${x.tokenId}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] hover:bg-raised">
                    <span><span className="num">#{x.tokenId.toString()}</span> <span className="text-faint">· {rangeText(x)}</span></span>
                    <RangeBadge status={rangeStatus(p.tick, x.tickLower, x.tickUpper)} closed={x.liquidity === 0n} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line px-5 py-3 text-[12px] text-faint">Other providers' positions appear in the Mint/Burn activity tab.</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          eyebrow="Activity"
          title={tab === "swap" ? "Recent swaps" : "Liquidity added / removed"}
          action={
            <div className="flex gap-1">
              {(["swap", "liquidity"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-2.5 py-1 text-[12px]", tab === t ? "bg-raised text-fg" : "text-muted")}>{t === "swap" ? "Swaps" : "Mint / Burn"}</button>
              ))}
            </div>
          }
        />
        {events.isLoading ? <div className="p-5"><Skeleton className="w-48" /></div> : events.isError ? <Notice tone="down">{(events.error as Error).message}</Notice> : events.data!.events.length === 0 ? (
          <EmptyState title="No events found">Scanned blocks {events.data!.scannedFromBlock}–{events.data!.headBlock}.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line"><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 text-right font-medium">{token0.symbol}</th><th className="px-4 py-2 text-right font-medium">{token1.symbol}</th><th className="px-4 py-2 font-medium">Account</th><th className="px-4 py-2 font-medium">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.data!.events.map((e) => {
                  const a0 = BigInt(e.amount0);
                  const a1 = BigInt(e.amount1);
                  const label = e.kind === "Swap" ? (a0 > 0n ? `Sell ${token0.symbol}` : `Buy ${token0.symbol}`) : e.kind === "Mint" ? "Add" : "Remove";
                  return (
                    <tr key={`${e.txHash}-${e.blockNumber}-${e.amount0}`}>
                      <td className="px-4 py-2.5"><a href={explorer.tx(e.txHash)} target="_blank" rel="noreferrer" className="hover:text-accent">{label}</a></td>
                      <td className={cn("num px-4 py-2.5 text-right", e.kind === "Swap" && (a0 > 0n ? "text-up" : "text-down"))}>{fmtAmount(a0 < 0n ? -a0 : a0, token0.decimals, 5)}</td>
                      <td className={cn("num px-4 py-2.5 text-right", e.kind === "Swap" && (a1 > 0n ? "text-up" : "text-down"))}>{fmtAmount(a1 < 0n ? -a1 : a1, token1.decimals, 5)}</td>
                      <td className="num px-4 py-2.5 text-faint">{shortAddress(e.sender ?? e.owner ?? "")}</td>
                      <td className="px-4 py-2.5 text-faint">{e.timestamp ? timeAgo(e.timestamp * 1000) : `#${e.blockNumber}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">Read directly from chain logs, blocks {events.data!.scannedFromBlock}–{events.data!.headBlock}. Amounts are pool-side (+ into pool).</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function PriceChart({ points, invert, label }: { points: { t: number; p: number }[]; invert: boolean; label: string }) {
  const pts = points.map((x) => ({ t: x.t, p: invert ? 1 / x.p : x.p })).filter((x) => Number.isFinite(x.p));
  const w = 600;
  const h = 180;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t || t0 + 1;
  const ps = pts.map((x) => x.p);
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * w;
  const y = (p: number) => h - ((p - lo) / Math.max(hi - lo, hi * 1e-9)) * (h - 16) - 8;
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${x(pt.t).toFixed(1)},${y(pt.p).toFixed(1)}`).join(" ");
  return (
    <div className="p-5">
      <div className="mb-2 flex justify-between text-[12px] text-faint"><span>{label}</span><span className="num">{formatPrice(lo)} – {formatPrice(hi)}</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label={`Price history, ${pts.length} swaps`}>
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-faint"><span>{new Date(t0).toLocaleString()}</span><span>{pts.length} swaps</span><span>{new Date(t1).toLocaleString()}</span></div>
    </div>
  );
}
