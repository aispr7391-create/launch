"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getContract } from "@/config/contracts";
import { Badge, Button, Card, CardHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useTxTracker } from "@/features/tx/TxProvider";
import { explorer } from "@/lib/explorer";
import { timeAgo } from "@/lib/format";
import { useClient, usePositions } from "../hooks";
import { fetchPositions, type Position } from "../onchain";
import { usePoolIndex } from "./Explore";
import { ethValueEstimate, rangeText } from "./Positions";
import { EmptyState, feeLabel, fmtAmount, PairLogos } from "./ui";

/** Sum uncollected fees per token across positions (never across different tokens). */
function feesByToken(positions: Position[]) {
  const m = new Map<string, { symbol: string; decimals: number; amount: bigint }>();
  for (const p of positions) {
    if (!p.fees) continue;
    for (const [t, a] of [[p.pool.token0, p.fees.amount0], [p.pool.token1, p.fees.amount1]] as const) {
      if (a === 0n) continue;
      const cur = m.get(t.address) ?? { symbol: t.symbol, decimals: t.decimals, amount: 0n };
      cur.amount += a;
      m.set(t.address, cur);
    }
  }
  return [...m.values()];
}

export function PoolsOverview() {
  const { isConnected } = useAccount();
  const positions = usePositions();
  const index = usePoolIndex({ limit: "200" });
  const { txs } = useTxTracker();

  const open = (positions.data ?? []).filter((p) => p.liquidity > 0n);
  const fees = feesByToken(positions.data ?? []);
  const ethValues = open.map((p) => ethValueEstimate(p, p.amount0, p.amount1));
  const allPriced = open.length > 0 && ethValues.every((v) => v !== null);
  const wethLocked = index.data?.configured && !index.data.error ? index.data.pools.reduce((s, p) => s + (p.weth_reserve ?? 0), 0) : null;
  const activity = txs.filter((t) => /liquidity|Remove|Collect|position/i.test(t.label)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><Stat label="Indexed pools" value={index.isLoading ? <Skeleton className="w-10" /> : index.data?.configured && !index.data.error && index.data.total != null ? index.data.total.toLocaleString("en-US") : "—"} hint={index.data?.configured ? "Uniswap v3, official factory" : "Indexer not configured"} /></Card>
        <Card className="p-4"><Stat label="WETH locked in pools" value={wethLocked !== null ? `${wethLocked.toPrecision(5)} ETH` : "—"} hint={wethLocked !== null ? `Top ${index.data!.pools.length} WETH pairs · on-chain balances` : "Needs indexer"} /></Card>
        <Card className="p-4"><Stat label="Your open positions" value={!isConnected ? "—" : positions.isLoading ? <Skeleton className="w-8" /> : open.length} hint={isConnected ? `${(positions.data ?? []).length} total NFTs` : "Connect wallet"} /></Card>
        <Card className="p-4"><Stat label="Your liquidity value" value={allPriced ? `≈ ${ethValues.reduce((s, v) => s + (v ?? 0), 0).toPrecision(5)} ETH` : "—"} hint={allPriced ? "Estimate at pool spot prices" : open.length ? "Some positions have no reliable price" : "No open positions"} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Your liquidity" title="Open positions" action={<Link href="/pools/positions" className="text-[13px] text-muted hover:text-fg">All positions →</Link>} />
          {!isConnected ? (
            <EmptyState title="Connect a wallet to see your liquidity"><div className="mx-auto mt-4 max-w-xs"><ConnectWalletButton block /></div></EmptyState>
          ) : positions.isLoading ? <div className="p-5"><Skeleton className="w-60" /></div> : positions.isError ? (
            <EmptyState title="Could not read positions">The Uniswap v3 position manager did not respond. Try again shortly.</EmptyState>
          ) : open.length === 0 ? (
            <EmptyState title="No open positions"><Link href="/pools/add"><Button size="sm" variant="primary" className="mt-3">Add liquidity</Button></Link></EmptyState>
          ) : (
            <ul className="divide-y divide-divider">
              {open.slice(0, 6).map((p) => (
                <li key={p.tokenId.toString()}>
                  <Link href={`/pools/positions/${p.tokenId}`} className="flex items-center gap-3 px-5 py-3 text-[13px] hover:bg-raised">
                    <PairLogos a={p.pool.token0.symbol} b={p.pool.token1.symbol} size={22} />
                    <span className="min-w-0 flex-1"><span className="font-medium">{p.pool.token0.symbol}/{p.pool.token1.symbol}</span> <span className="text-faint">{feeLabel(p.pool.fee)} · {rangeText(p)}</span></span>
                    <span className="num text-faint">#{p.tokenId.toString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader eyebrow="Unclaimed" title="Trading fees" />
          {!isConnected ? <EmptyState title="—" /> : fees.length === 0 ? (
            <EmptyState title="No uncollected fees" />
          ) : (
            <ul className="divide-y divide-divider">
              {fees.map((f) => <li key={f.symbol} className="flex justify-between px-5 py-2.5 text-[13px]"><span className="text-muted">{f.symbol}</span><span className="num">{fmtAmount(f.amount, f.decimals)}</span></li>)}
            </ul>
          )}
          <p className="border-t border-line px-5 py-3 text-[12px] text-faint">Exact amounts from a static call to collect(); summed per token only.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Activity" title="Your recent liquidity transactions" />
          {activity.length === 0 ? <EmptyState title="No liquidity transactions from this browser yet" /> : (
            <ul className="divide-y divide-divider">
              {activity.map((t) => (
                <li key={t.hash}><a href={explorer.tx(t.hash)} target="_blank" rel="noreferrer" className="flex justify-between gap-3 px-5 py-2.5 text-[13px] hover:bg-raised">
                  <span className="truncate">{t.label}</span>
                  <span className={t.status === "success" ? "text-up" : t.status === "reverted" ? "text-down" : "text-accent"}>{t.status}</span>
                  <span className="text-faint">{timeAgo(t.createdAt)}</span>
                </a></li>
              ))}
            </ul>
          )}
        </Card>
        <ProtocolLiquidity />
      </div>
    </div>
  );
}

/**
 * Protocol-owned graduation liquidity: full-range positions held by the UniswapV3Graduator
 * contract. Shown separately — never as anyone's personal LP position.
 */
function ProtocolLiquidity() {
  const graduator = getContract("pxGraduator");
  const client = useClient();
  const q = useQuery({
    queryKey: ["protocol-positions", graduator],
    enabled: Boolean(graduator && client),
    queryFn: () => fetchPositions(client!, graduator!),
  });
  return (
    <Card>
      <CardHeader eyebrow="Protocol-owned" title="Graduation liquidity" action={<Badge>Permanently locked</Badge>} />
      {!graduator ? (
        <EmptyState title="Graduator not deployed yet">
          When a launchpad token graduates, its full-range Uniswap v3 position is minted to the UniswapV3Graduator contract and can never
          be withdrawn. Those positions will be listed here — separately from user positions.
        </EmptyState>
      ) : q.isLoading ? <div className="p-5"><Skeleton /></div> : (q.data ?? []).length === 0 ? (
        <EmptyState title="No graduated tokens yet" />
      ) : (
        <ul className="divide-y divide-divider">
          {q.data!.map((p) => (
            <li key={p.tokenId.toString()}><Link href={`/pools/${p.pool.address}`} className="flex justify-between px-5 py-2.5 text-[13px] hover:bg-raised">
              <span>{p.pool.token0.symbol}/{p.pool.token1.symbol}</span><span className="num text-faint">NFT #{p.tokenId.toString()}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </Card>
  );
}
