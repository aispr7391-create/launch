"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, isAddressEqual, parseEventLogs, parseUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { Badge, Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { cn } from "@/lib/cn";
import { erc20Abi, positionManagerAbi } from "../abi";
import { estimateGasCost, positionManager, useAllowance, useClient, usePairPools, usePool, usePosition, useTokenBalance, useTxAction } from "../hooks";
import { formatPrice, priceToTick, sqrtPriceToPrice, tickToPrice } from "../math/price";
import { fullRangeTicks, nearestUsableTick } from "../math/tickMath";
import type { PoolState } from "../onchain";
import { activeShareBps, planIncrease, planMint, quoteDeposit, rangeStatus, withSlippage } from "../plan";
import { choiceSymbol, isNative, NATIVE, type TokenChoice } from "../tokens";
import { TokenSelectModal } from "./TokenSelectModal";
import { AddressLink, feeLabel, fmtAmount, Notice, TokenLogo, TxStatusBox } from "./ui";

const WETH = CONTRACTS.weth.address as Address;
const SLIPPAGE = [10, 50, 100] as const;

const addrOf = (t: TokenChoice | null): Address | undefined => (!t ? undefined : isNative(t) ? WETH : t.address);
const decOf = (t: TokenChoice | null) => (!t || isNative(t) ? 18 : t.decimals);
const safeParse = (v: string, d: number) => {
  try {
    return v && /^\d*\.?\d*$/.test(v) && v !== "." ? parseUnits(v, d) : 0n;
  } catch {
    return 0n;
  }
};
const toInput = (raw: bigint, d: number) => {
  const s = formatUnits(raw, d);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

export function AddLiquidity() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const client = useClient();
  const { address, isConnected } = useAccount();

  const positionId = sp.get("position");
  const increase = usePosition(positionId && /^\d+$/.test(positionId) ? BigInt(positionId) : undefined);
  const poolParam = usePool(sp.get("pool") ?? undefined);
  const pos = increase.data;

  const [tokenA, setTokenA] = useState<TokenChoice | null>(null);
  const [tokenB, setTokenB] = useState<TokenChoice | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [rangeMode, setRangeMode] = useState<"full" | "custom">("full");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [amtA, setAmtA] = useState("");
  const [amtB, setAmtB] = useState("");
  const [edited, setEdited] = useState<"A" | "B">("A");
  const [slip, setSlip] = useState<number>(50);
  const [picker, setPicker] = useState<"A" | "B" | null>(null);
  const approveTx = useTxAction();
  const addTx = useTxAction();
  const [newTokenId, setNewTokenId] = useState<bigint | null>(null);

  // Prefill from ?pool= or ?position=
  const seed: PoolState | undefined = pos?.pool ?? poolParam.data;
  useEffect(() => {
    if (!seed || tokenA) return;
    setTokenA({ ...seed.token0, source: "official" });
    setTokenB({ ...seed.token1, source: "official" });
    setFee(seed.fee);
  }, [seed, tokenA]);

  const addrA = addrOf(tokenA);
  const addrB = addrOf(tokenB);
  const pair = usePairPools(pos ? undefined : addrA, pos ? undefined : addrB);
  const pool: PoolState | null = pos?.pool ?? pair.data?.find((p) => p.fee === fee)?.state ?? null;

  const aIs0 = pool && addrA ? isAddressEqual(addrA, pool.token0.address) : true;
  const d0 = pool?.token0.decimals ?? 18;
  const d1 = pool?.token1.decimals ?? 18;
  const decA = decOf(tokenA);
  const decB = decOf(tokenB);
  const symA = choiceSymbol(tokenA);
  const symB = choiceSymbol(tokenB);

  /** Price of A in B ("B per A") from a tick. */
  const priceBA = (tick: number) => (aIs0 ? tickToPrice(tick, d0, d1) : 1 / tickToPrice(tick, d0, d1));
  const current = pool ? (aIs0 ? sqrtPriceToPrice(pool.sqrtPriceX96, d0, d1) : 1 / sqrtPriceToPrice(pool.sqrtPriceX96, d0, d1)) : null;

  const ticks = useMemo<[number, number] | null>(() => {
    if (!pool) return null;
    if (pos) return [pos.tickLower, pos.tickUpper];
    if (rangeMode === "full") return fullRangeTicks(pool.tickSpacing);
    const lo = Number(minP);
    const hi = Number(maxP);
    if (!(lo > 0 && hi > lo)) return null;
    const [p01lo, p01hi] = aIs0 ? [lo, hi] : [1 / hi, 1 / lo];
    const tl = priceToTick(p01lo, d0, d1);
    const tu = priceToTick(p01hi, d0, d1);
    if (tl === null || tu === null) return null;
    const l = nearestUsableTick(tl, pool.tickSpacing);
    const u = nearestUsableTick(tu, pool.tickSpacing);
    return l < u ? [l, u] : null;
  }, [pool, pos, rangeMode, minP, maxP, aIs0, d0, d1]);

  // Prefill a ±20 % custom range around the current price.
  const toCustom = () => {
    setRangeMode("custom");
    if (current && !minP && !maxP) {
      setMinP(formatPrice(current * 0.8).replace(/,/g, ""));
      setMaxP(formatPrice(current * 1.2).replace(/,/g, ""));
    }
  };

  const rawA = safeParse(amtA, decA);
  const rawB = safeParse(amtB, decB);
  const quote = useMemo(() => {
    if (!pool || !ticks) return null;
    const sideOfA: 0 | 1 = aIs0 ? 0 : 1;
    const side = edited === "A" ? sideOfA : ((1 - sideOfA) as 0 | 1);
    return quoteDeposit(pool.sqrtPriceX96, ticks[0], ticks[1], side, edited === "A" ? rawA : rawB);
  }, [pool, ticks, aIs0, edited, rawA, rawB]);

  const needA = quote ? (aIs0 ? quote.needs0 : quote.needs1) : true;
  const needB = quote ? (aIs0 ? quote.needs1 : quote.needs0) : true;
  const depA = quote ? (aIs0 ? quote.amount0 : quote.amount1) : 0n;
  const depB = quote ? (aIs0 ? quote.amount1 : quote.amount0) : 0n;

  // Keep the non-edited field in sync with the exact amount the pool will take.
  useEffect(() => {
    if (!quote) return;
    if (edited === "A") setAmtB(depB > 0n ? toInput(depB, decB) : "");
    else setAmtA(depA > 0n ? toInput(depA, decA) : "");
  }, [quote, edited, depA, depB, decA, decB]);

  const balA = useTokenBalance(tokenA ? (isNative(tokenA) ? "ETH" : addrA) : undefined);
  const balB = useTokenBalance(tokenB ? (isNative(tokenB) ? "ETH" : addrB) : undefined);
  const npm = positionManager();
  const allowA = useAllowance(tokenA && !isNative(tokenA) ? addrA : undefined, npm);
  const allowB = useAllowance(tokenB && !isNative(tokenB) ? addrB : undefined, npm);
  const needsApproveA = Boolean(tokenA && !isNative(tokenA) && depA > 0n && (allowA.data ?? 0n) < depA);
  const needsApproveB = Boolean(tokenB && !isNative(tokenB) && depB > 0n && (allowB.data ?? 0n) < depB);
  const insufficientA = balA.data !== undefined && depA > balA.data;
  const insufficientB = balB.data !== undefined && depB > balB.data;

  const nativeSide: 0 | 1 | null = isNative(tokenA) ? (aIs0 ? 0 : 1) : isNative(tokenB) ? (aIs0 ? 1 : 0) : null;
  const buildRequest = () => {
    if (!pool || !ticks || !quote || !address) return null;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    const plan = pos
      ? planIncrease({ tokenId: pos.tokenId, amount0: quote.amount0, amount1: quote.amount1, slippageBps: slip, deadline, nativeSide })
      : planMint({
          token0: pool.token0.address,
          token1: pool.token1.address,
          fee: pool.fee,
          tickLower: ticks[0],
          tickUpper: ticks[1],
          amount0: quote.amount0,
          amount1: quote.amount1,
          slippageBps: slip,
          recipient: address,
          deadline,
          nativeSide,
        });
    return { address: npm, abi: positionManagerAbi, functionName: "multicall", args: plan.args, value: plan.value } as const;
  };

  // increaseLiquidity has no owner check on-chain: funds would go to whoever owns the NFT. Only allow the owner.
  const notOwner = Boolean(pos && address && !isAddressEqual(pos.owner, address));
  const ready = Boolean(isConnected && pool && ticks && quote && quote.liquidity > 0n && !insufficientA && !insufficientB && !notOwner);
  const gas = useQuery({
    queryKey: ["add-gas", pool?.address, ticks?.join(","), quote?.liquidity.toString(), slip, address, pos?.tokenId.toString()],
    enabled: ready && !needsApproveA && !needsApproveB && Boolean(client && address),
    retry: false,
    queryFn: () => estimateGasCost(client!, address!, buildRequest()!),
  });

  const approve = async (token: Address, amount: bigint, sym: string) => {
    const r = await approveTx.run(`Approve ${sym}`, { address: token, abi: erc20Abi, functionName: "approve", args: [npm, amount] });
    if (r) qc.invalidateQueries({ queryKey: ["allowance"] });
  };

  const submit = async () => {
    const req = buildRequest();
    if (!req) return;
    const receipt = await addTx.run(pos ? `Add to position #${pos.tokenId}` : `Add liquidity ${symA}/${symB}`, req);
    if (!receipt) return;
    const ev = parseEventLogs({ abi: positionManagerAbi, eventName: "IncreaseLiquidity", logs: receipt.logs }).find((l) => isAddressEqual(l.address, npm));
    if (ev) setNewTokenId(ev.args.tokenId);
    qc.invalidateQueries({ queryKey: ["v3-positions"] });
    qc.invalidateQueries({ queryKey: ["v3-position"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
    setAmtA("");
    setAmtB("");
  };

  const status = pool && ticks ? rangeStatus(pool.tick, ticks[0], ticks[1]) : null;
  const share = quote && pool && status ? activeShareBps(quote.liquidity, pool.liquidity, status === "in-range") : null;
  const busy = approveTx.busy || addTx.busy;

  if (positionId && increase.isError) return <Notice tone="down">Position #{positionId} could not be loaded.</Notice>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader eyebrow={pos ? `Position #${pos.tokenId}` : "Step 1"} title={pos ? "Increase liquidity" : "Select pair and pool"} />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((k) => {
                const t = k === "A" ? tokenA : tokenB;
                return (
                  <button key={k} type="button" disabled={Boolean(pos) || busy} onClick={() => setPicker(k)}
                    className="flex h-12 items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 text-left text-sm hover:border-faint disabled:opacity-70">
                    {t ? <TokenLogo symbol={choiceSymbol(t)} logo={!isNative(t) ? t.logo : undefined} /> : null}
                    <span className={t ? "font-medium" : "text-muted"}>{t ? choiceSymbol(t) : `Select token ${k}`}</span>
                  </button>
                );
              })}
            </div>

            {!pos && addrA && addrB && (
              <div>
                <p className="mb-2 text-[13px] font-medium">Fee tier / pool</p>
                {pair.isLoading ? (
                  <Skeleton className="w-full" />
                ) : pair.isError ? (
                  <Notice tone="down">Could not read pools from the Uniswap v3 factory.</Notice>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {pair.data?.map((p) => (
                      <button key={p.fee} type="button" disabled={!p.state || busy} onClick={() => setFee(p.fee)}
                        className={cn("rounded-xl border px-3 py-2.5 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50",
                          fee === p.fee ? "border-accent bg-accent-soft" : "border-line-strong hover:border-faint")}>
                        <span className="num block font-medium">{feeLabel(p.fee)}</span>
                        <span className="block text-[11px] text-faint">{p.state ? (p.state.liquidity > 0n ? "Pool active" : "Pool, no active liquidity") : p.address ? "Not initialised" : "No pool"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {pair.data && !pair.data.some((p) => p.state) && (
                  <p className="mt-2 text-[12px] text-faint">No initialised Uniswap v3 pool exists for this pair. Creating new pools is not supported in PROJECT X yet.</p>
                )}
              </div>
            )}

            {pool && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
                <span className="text-muted">Pool <AddressLink address={pool.address} /> · {feeLabel(pool.fee)}</span>
                <span className="num">1 {symA} = {current !== null ? formatPrice(current) : "—"} {symB}</span>
              </div>
            )}
          </div>
        </Card>

        {notOwner && <Notice tone="down">Position #{pos!.tokenId.toString()} is not owned by the connected wallet. Adding to it would gift your tokens to its owner, so this is disabled.</Notice>}

        {pool && (
          <Card>
            <CardHeader eyebrow="Step 2" title="Price range" action={pos ? <Badge>Fixed by position</Badge> : null} />
            <div className="space-y-4 p-5">
              {!pos && (
                <div className="flex gap-2">
                  {(["full", "custom"] as const).map((m) => (
                    <Button key={m} size="sm" variant={rangeMode === m ? "primary" : "secondary"} onClick={() => (m === "full" ? setRangeMode("full") : toCustom())} disabled={busy}>
                      {m === "full" ? "Full range" : "Custom range"}
                    </Button>
                  ))}
                </div>
              )}
              {rangeMode === "custom" && !pos ? (
                <div className="grid grid-cols-2 gap-3">
                  {([["Min price", minP, setMinP], ["Max price", maxP, setMaxP]] as const).map(([label, v, set]) => (
                    <label key={label} className="rounded-xl border border-line-strong p-3">
                      <span className="text-[12px] text-muted">{label}</span>
                      <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value.replace(",", "."))} disabled={busy}
                        className="num mt-1 w-full bg-transparent text-lg outline-none" placeholder="0.0" />
                      <span className="text-[11px] text-faint">{symB} per {symA}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {ticks ? (
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-lg bg-raised px-3 py-2"><p className="text-faint">Min (snapped to tick)</p><p className="num">{rangeMode === "full" && !pos ? "0" : formatPrice(aIs0 ? priceBA(ticks[0]) : priceBA(ticks[1]))}</p></div>
                  <div className="rounded-lg bg-raised px-3 py-2"><p className="text-faint">Max (snapped to tick)</p><p className="num">{rangeMode === "full" && !pos ? "∞" : formatPrice(aIs0 ? priceBA(ticks[1]) : priceBA(ticks[0]))}</p></div>
                </div>
              ) : (
                <p className="text-[12px] text-down">Enter a min price lower than the max price.</p>
              )}
              {status && status !== "in-range" && (
                <Notice tone="warn">The current price is outside this range: the position earns no fees until the price moves into it, and only {status === "below" ? pool.token0.symbol : pool.token1.symbol} is deposited.</Notice>
              )}
            </div>
          </Card>
        )}

        {pool && ticks && (
          <Card>
            <CardHeader eyebrow="Step 3" title="Deposit amounts" />
            <div className="space-y-3 p-5">
              {([
                ["A", tokenA, amtA, setAmtA, needA, balA.data, decA, insufficientA],
                ["B", tokenB, amtB, setAmtB, needB, balB.data, decB, insufficientB],
              ] as const).map(([k, t, v, set, needed, bal, dec, insufficient]) => (
                <div key={k} className={cn("rounded-xl border p-3", insufficient ? "border-down/60" : "border-line-strong", !needed && "opacity-50")}>
                  <div className="flex items-center gap-3">
                    <input inputMode="decimal" placeholder="0.0" value={needed ? v : ""} disabled={!needed || busy}
                      onChange={(e) => { set(e.target.value.replace(",", ".")); setEdited(k); }}
                      className="num min-w-0 flex-1 bg-transparent text-xl outline-none" aria-label={`Amount of ${choiceSymbol(t)}`} />
                    <span className="flex items-center gap-2 text-sm font-medium"><TokenLogo symbol={choiceSymbol(t)} size={22} />{choiceSymbol(t)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between text-[12px] text-faint">
                    <span>{!needed ? "Not needed for this range" : insufficient ? <span className="text-down">Insufficient balance</span> : ""}</span>
                    {bal !== undefined && (
                      <button type="button" className="hover:text-fg" disabled={!needed || busy}
                        onClick={() => { set(toInput(t && isNative(t) && bal > 2n * 10n ** 15n ? bal - 2n * 10n ** 15n : bal, dec)); setEdited(k); }}>
                        Balance: <span className="num">{fmtAmount(bal, dec)}</span> · Max
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {nativeSide !== null && <p className="text-[12px] text-faint">ETH is wrapped to WETH by the Uniswap position manager in the same transaction; unused ETH is refunded.</p>}
            </div>
          </Card>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader eyebrow="Review" title="Transaction details" />
          <div className="divide-y divide-line px-5 text-[13px]">
            <Row k="Pool" v={pool ? <AddressLink address={pool.address} /> : "—"} />
            <Row k="Fee tier" v={pool ? feeLabel(pool.fee) : "—"} />
            <Row k="Range" v={ticks && pool ? (rangeMode === "full" && !pos ? "Full range" : `${formatPrice(aIs0 ? priceBA(ticks[0]) : priceBA(ticks[1]))} – ${formatPrice(aIs0 ? priceBA(ticks[1]) : priceBA(ticks[0]))}`) : "—"} />
            <Row k={`Deposit ${symA || "A"}`} v={tokenA ? `${fmtAmount(depA, decA)} ${symA}` : "—"} />
            <Row k={`Deposit ${symB || "B"}`} v={tokenB ? `${fmtAmount(depB, decB)} ${symB}` : "—"} />
            <Row k="Minimums" v={tokenA && tokenB ? `${fmtAmount(withSlippage(depA, slip), decA)} / ${fmtAmount(withSlippage(depB, slip), decB)}` : "—"} hint="Reverts if the pool would take less" />
            <Row k="Share of active liquidity" v={share === null ? (status && status !== "in-range" ? "0% (out of range)" : "—") : `${(share / 100).toFixed(share < 1 ? 4 : 2)}%`} hint="Estimate at the current price" />
            <Row k="Estimated gas" v={gas.data ? `${Number(formatUnits(gas.data.wei, 18)).toPrecision(3)} ETH` : needsApproveA || needsApproveB ? "After approval" : gas.isFetching ? "Estimating…" : "—"} />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted">Slippage</span>
              <span className="flex gap-1.5">
                {SLIPPAGE.map((s) => (
                  <button key={s} type="button" onClick={() => setSlip(s)} className={cn("num rounded-md border px-1.5 py-0.5 text-[12px]", slip === s ? "border-accent text-accent" : "border-line-strong text-muted")}>
                    {s / 100}%
                  </button>
                ))}
              </span>
            </div>
          </div>
          <div className="space-y-2 p-5 pt-3">
            {!isConnected ? (
              <ConnectWalletButton block />
            ) : (
              <>
                {needsApproveA && addrA && (
                  <Button variant="primary" className="w-full" disabled={busy} onClick={() => approve(addrA, depA, symA)}>Approve {symA} (exact amount)</Button>
                )}
                {needsApproveB && addrB && (
                  <Button variant="primary" className="w-full" disabled={busy} onClick={() => approve(addrB, depB, symB)}>Approve {symB} (exact amount)</Button>
                )}
                <Button variant="primary" className="h-11 w-full" disabled={!ready || needsApproveA || needsApproveB || busy} onClick={submit}>
                  {addTx.busy ? "Adding…" : pos ? "Add to position" : "Add liquidity"}
                </Button>
              </>
            )}
            <TxStatusBox state={approveTx.state} onReset={approveTx.reset} />
            <TxStatusBox
              state={addTx.state}
              onReset={() => { addTx.reset(); setNewTokenId(null); }}
              success={newTokenId !== null && (
                <Link href={`/pools/positions/${newTokenId}`} className="mt-2 block text-accent hover:underline">View position #{newTokenId.toString()} →</Link>
              )}
            />
          </div>
        </Card>
        <p className="px-1 text-[12px] leading-5 text-faint">
          Positions are Uniswap v3 NFTs held by your wallet, managed through the official NonfungiblePositionManager (<AddressLink address={npm} />).
        </p>
      </aside>

      {picker && (
        <TokenSelectModal
          exclude={picker === "A" ? (tokenB ? (isNative(tokenB) ? NATIVE : tokenB.address) : undefined) : tokenA ? (isNative(tokenA) ? NATIVE : tokenA.address) : undefined}
          onClose={() => setPicker(null)}
          onSelect={(t) => {
            if (picker === "A") setTokenA(t);
            else setTokenB(t);
            setFee(null);
            setAmtA("");
            setAmtB("");
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="text-muted">{k}{hint && <span className="block text-[11px] text-faint">{hint}</span>}</span>
      <span className="num text-right">{v}</span>
    </div>
  );
}
