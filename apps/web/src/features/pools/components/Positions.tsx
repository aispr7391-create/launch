"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, isAddressEqual, type Address } from "viem";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { Badge, Button, Card, CardHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { cn } from "@/lib/cn";
import { positionManagerAbi } from "../abi";
import { estimateGasCost, positionManager, useClient, usePosition, usePositions, useTxAction } from "../hooks";
import { formatPrice, sqrtPriceToPrice, tickToPrice } from "../math/price";
import { fullRangeTicks } from "../math/tickMath";
import type { Position } from "../onchain";
import { planCollect, planRemove, quoteRemove, rangeStatus } from "../plan";
import { AddressLink, EmptyState, feeLabel, fmtAmount, Notice, PairLogos, RangeBadge, TxStatusBox } from "./ui";

const WETH = CONTRACTS.weth.address as Address;

function isFullRange(p: Position) {
  const [lo, hi] = fullRangeTicks(p.pool.tickSpacing);
  return p.tickLower === lo && p.tickUpper === hi;
}

export function rangeText(p: Position) {
  if (isFullRange(p)) return "Full range";
  const { token0, token1 } = p.pool;
  return `${formatPrice(tickToPrice(p.tickLower, token0.decimals, token1.decimals))} – ${formatPrice(tickToPrice(p.tickUpper, token0.decimals, token1.decimals))} ${token1.symbol}/${token0.symbol}`;
}

/** ETH value estimate for WETH pairs only, at the pool's current spot price. */
export function ethValueEstimate(p: Position, a0: bigint, a1: bigint): number | null {
  const { token0, token1, sqrtPriceX96 } = p.pool;
  const price01 = sqrtPriceToPrice(sqrtPriceX96, token0.decimals, token1.decimals);
  const n0 = Number(formatUnits(a0, token0.decimals));
  const n1 = Number(formatUnits(a1, token1.decimals));
  if (isAddressEqual(token0.address, WETH)) return n0 + n1 / price01;
  if (isAddressEqual(token1.address, WETH)) return n1 + n0 * price01;
  return null;
}

export function PositionsList() {
  const { isConnected } = useAccount();
  const q = usePositions();
  const [showClosed, setShowClosed] = useState(false);

  if (!isConnected) {
    return (
      <Card>
        <EmptyState title="Connect a wallet to see your positions">
          <div className="mx-auto mt-4 max-w-xs"><ConnectWalletButton block /></div>
        </EmptyState>
      </Card>
    );
  }
  if (q.isLoading) return <Card className="p-5"><Skeleton className="w-60" /></Card>;
  if (q.isError) return <Notice tone="down">Could not read your positions from the Uniswap v3 position manager. {String((q.error as Error)?.message ?? "")}</Notice>;

  const open = (q.data ?? []).filter((p) => p.liquidity > 0n || (p.fees && (p.fees.amount0 > 0n || p.fees.amount1 > 0n)));
  const closed = (q.data ?? []).filter((p) => !open.includes(p));
  const shown = showClosed ? [...open, ...closed] : open;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{open.length} open · {closed.length} closed · Uniswap v3 NFTs in your wallet</p>
        <div className="flex gap-2">
          {closed.length > 0 && <Button size="sm" variant="ghost" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "Hide closed" : "Show closed"}</Button>}
          <Link href="/pools/add"><Button size="sm" variant="primary">New position</Button></Link>
        </div>
      </div>
      {shown.length === 0 ? (
        <Card><EmptyState title="No liquidity positions">Positions you create on Uniswap v3 (here or anywhere else) appear automatically.</EmptyState></Card>
      ) : (
        shown.map((p) => <PositionRow key={p.tokenId.toString()} p={p} />)
      )}
    </div>
  );
}

function PositionRow({ p }: { p: Position }) {
  const { token0, token1 } = p.pool;
  const value = ethValueEstimate(p, p.amount0, p.amount1);
  return (
    <Card className="p-4 transition hover:border-line-strong">
      <div className="flex flex-wrap items-center gap-3">
        <PairLogos a={token0.symbol} b={token1.symbol} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{token0.symbol}/{token1.symbol} <Badge className="ml-1">{feeLabel(p.pool.fee)}</Badge></p>
          <p className="num text-[12px] text-faint">#{p.tokenId.toString()} · {rangeText(p)}</p>
        </div>
        <RangeBadge status={rangeStatus(p.pool.tick, p.tickLower, p.tickUpper)} closed={p.liquidity === 0n} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
        <div><p className="text-faint">{token0.symbol}</p><p className="num">{fmtAmount(p.amount0, token0.decimals)}</p></div>
        <div><p className="text-faint">{token1.symbol}</p><p className="num">{fmtAmount(p.amount1, token1.decimals)}</p></div>
        <div>
          <p className="text-faint">Unclaimed fees</p>
          <p className="num">{p.fees ? `${fmtAmount(p.fees.amount0, token0.decimals)} / ${fmtAmount(p.fees.amount1, token1.decimals)}` : "Unavailable"}</p>
        </div>
        <div><p className="text-faint">Value</p><p className="num">{value !== null ? `≈ ${value.toPrecision(5)} ETH` : "No reliable price"}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/pools/positions/${p.tokenId}`}><Button size="sm">View / remove / collect</Button></Link>
        <Link href={`/pools/add?position=${p.tokenId}`}><Button size="sm" variant="ghost">Add liquidity</Button></Link>
      </div>
    </Card>
  );
}

export function PositionDetail({ tokenId }: { tokenId: bigint }) {
  const q = usePosition(tokenId);
  const { address } = useAccount();
  const qc = useQueryClient();
  const client = useClient();
  const removeTx = useTxAction();
  const collectTx = useTxAction();
  const [pct, setPct] = useState(50);
  const [slip, setSlip] = useState(50);
  const [asEth, setAsEth] = useState(true);

  const p = q.data;
  const isOwner = Boolean(p && address && isAddressEqual(p.owner, address));
  const hasWeth = Boolean(p && (isAddressEqual(p.pool.token0.address, WETH) || isAddressEqual(p.pool.token1.address, WETH)));
  const unwrap = p && hasWeth && asEth
    ? { weth: WETH, other: isAddressEqual(p.pool.token0.address, WETH) ? p.pool.token1.address : p.pool.token0.address }
    : null;
  const rq = p ? quoteRemove(p.pool.sqrtPriceX96, p.tickLower, p.tickUpper, p.liquidity, pct, slip) : null;
  const hasFees = Boolean(p?.fees && (p.fees.amount0 > 0n || p.fees.amount1 > 0n));
  const npm = positionManager();

  const removeReq = () => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    const plan = planRemove({ tokenId, quote: rq!, recipient: address!, deadline, unwrap });
    return { address: npm, abi: positionManagerAbi, functionName: "multicall", args: plan.args, value: 0n } as const;
  };
  const collectReq = () => {
    const plan = planCollect({ tokenId, recipient: address!, unwrap });
    return { address: npm, abi: positionManagerAbi, functionName: "multicall", args: plan.args, value: 0n } as const;
  };
  const gas = useQuery({
    queryKey: ["remove-gas", tokenId.toString(), pct, slip, asEth, address],
    enabled: Boolean(isOwner && rq && rq.liquidity > 0n && client),
    retry: false,
    queryFn: () => estimateGasCost(client!, address!, removeReq()),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["v3-position"] });
    qc.invalidateQueries({ queryKey: ["v3-positions"] });
  };

  if (q.isLoading) return <Card className="p-5"><Skeleton className="w-60" /></Card>;
  if (q.isError || !p) return <Notice tone="down">Position #{tokenId.toString()} does not exist or could not be read from the position manager.</Notice>;
  const { token0, token1 } = p.pool;
  const status = rangeStatus(p.pool.tick, p.tickLower, p.tickUpper);
  const value = ethValueEstimate(p, p.amount0, p.amount1);
  const busy = removeTx.busy || collectTx.busy;
  const currentPrice = sqrtPriceToPrice(p.pool.sqrtPriceX96, token0.decimals, token1.decimals);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <PairLogos a={token0.symbol} b={token1.symbol} size={34} />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{token0.symbol}/{token1.symbol} <Badge className="ml-1">{feeLabel(p.pool.fee)}</Badge></h1>
              <p className="num text-[12px] text-faint">Position NFT #{p.tokenId.toString()} · Uniswap v3</p>
            </div>
            <RangeBadge status={status} closed={p.liquidity === 0n} />
          </div>
          <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3">
            <Stat label={token0.symbol} value={fmtAmount(p.amount0, token0.decimals)} hint="Current amount (on-chain)" />
            <Stat label={token1.symbol} value={fmtAmount(p.amount1, token1.decimals)} hint="Current amount (on-chain)" />
            <Stat label="Liquidity" value={p.liquidity.toLocaleString("en-US")} hint="Position L" />
            <Stat label={`Fees ${token0.symbol}`} value={p.fees ? fmtAmount(p.fees.amount0, token0.decimals) : "—"} hint="Uncollected" />
            <Stat label={`Fees ${token1.symbol}`} value={p.fees ? fmtAmount(p.fees.amount1, token1.decimals) : "—"} hint="Uncollected" />
            <Stat label="Value" value={value !== null ? `≈ ${value.toPrecision(5)} ETH` : "—"} hint={value !== null ? "Estimate at pool spot price" : "No reliable price"} />
          </div>
          <div className="space-y-1.5 border-t border-line px-5 py-4 text-[13px]">
            <p><span className="text-muted">Range: </span><span className="num">{rangeText(p)}</span></p>
            <p><span className="text-muted">Current price: </span><span className="num">{formatPrice(currentPrice)} {token1.symbol}/{token0.symbol}</span></p>
            <p className="flex flex-wrap gap-x-4"><span className="text-muted">Pool:</span> <Link className="text-accent hover:underline" href={`/pools/${p.pool.address}`}>details</Link> <AddressLink address={p.pool.address} /></p>
            <p><span className="text-muted">Owner: </span><AddressLink address={p.owner} /></p>
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Performance" title="Position performance" />
          <p className="px-5 py-4 text-[13px] leading-5 text-muted">
            Profit/loss and impermanent-loss estimates need the deposit amounts and prices at entry. These come from indexed
            IncreaseLiquidity events plus a reliable price history; they are not shown until both are available. Figures above are
            current on-chain balances.
          </p>
        </Card>
      </div>

      <aside className="space-y-4">
        {!isOwner && <Notice tone="warn">{address ? "This position is not owned by the connected wallet. Actions are disabled." : "Connect the owner wallet to manage this position."}</Notice>}

        <Card>
          <CardHeader eyebrow="Manage" title="Remove liquidity" />
          <div className="space-y-4 p-5">
            <div>
              <p className="num text-3xl font-medium">{pct}%</p>
              <input type="range" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-accent)]" disabled={!isOwner || busy} aria-label="Percent to remove" />
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((v) => (
                  <Button key={v} size="sm" variant={pct === v ? "primary" : "secondary"} onClick={() => setPct(v)} disabled={!isOwner || busy}>{v === 100 ? "Max" : `${v}%`}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 rounded-xl border border-line p-3 text-[13px]">
              <p className="flex justify-between"><span className="text-muted">{token0.symbol} from liquidity</span><span className="num">{rq ? fmtAmount(rq.amount0, token0.decimals) : "—"}</span></p>
              <p className="flex justify-between"><span className="text-muted">{token1.symbol} from liquidity</span><span className="num">{rq ? fmtAmount(rq.amount1, token1.decimals) : "—"}</span></p>
              <p className="flex justify-between"><span className="text-muted">+ uncollected fees</span><span className="num">{p.fees ? `${fmtAmount(p.fees.amount0, token0.decimals)} / ${fmtAmount(p.fees.amount1, token1.decimals)}` : "—"}</span></p>
              <p className="flex justify-between text-faint"><span>Minimum (slippage {slip / 100}%)</span><span className="num">{rq ? `${fmtAmount(rq.amount0Min, token0.decimals)} / ${fmtAmount(rq.amount1Min, token1.decimals)}` : "—"}</span></p>
              <p className="flex justify-between text-faint"><span>Estimated gas</span><span className="num">{gas.data ? `${Number(formatUnits(gas.data.wei, 18)).toPrecision(3)} ETH` : "—"}</span></p>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Slippage</span>
              <span className="flex gap-1.5">
                {[10, 50, 100].map((s) => (
                  <button key={s} onClick={() => setSlip(s)} className={cn("num rounded-md border px-1.5 py-0.5 text-[12px]", slip === s ? "border-accent text-accent" : "border-line-strong text-muted")}>{s / 100}%</button>
                ))}
              </span>
            </div>
            {hasWeth && (
              <label className="flex items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={asEth} onChange={(e) => setAsEth(e.target.checked)} disabled={busy} /> Receive WETH as ETH
              </label>
            )}
            <Button variant="primary" className="w-full" disabled={!isOwner || busy || !rq || rq.liquidity === 0n}
              onClick={async () => { if (await removeTx.run(`Remove ${pct}% of #${tokenId}`, removeReq())) refresh(); }}>
              {p.liquidity === 0n ? "No liquidity to remove" : `Remove ${pct}% and collect`}
            </Button>
            <TxStatusBox state={removeTx.state} onReset={removeTx.reset} />
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Fees" title="Collect fees" />
          <div className="space-y-3 p-5">
            <p className="text-[13px] text-muted">
              {p.fees ? `${fmtAmount(p.fees.amount0, token0.decimals)} ${token0.symbol} and ${fmtAmount(p.fees.amount1, token1.decimals)} ${token1.symbol} uncollected.` : "Uncollected fees could not be read."}
            </p>
            <Button className="w-full" disabled={!isOwner || busy || !hasFees}
              onClick={async () => { if (await collectTx.run(`Collect fees #${tokenId}`, collectReq())) refresh(); }}>
              {hasFees ? "Collect fees" : "No fees to collect"}
            </Button>
            <TxStatusBox state={collectTx.state} onReset={collectTx.reset} />
          </div>
        </Card>
        <Link href={`/pools/add?position=${tokenId}`} className="block"><Button className="w-full" variant="ghost" disabled={!isOwner}>Add liquidity to this position</Button></Link>
      </aside>
    </div>
  );
}
