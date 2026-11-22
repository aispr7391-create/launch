"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { CONTRACTS, requireContract } from "@/config/contracts";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useTxTracker } from "@/features/tx/TxProvider";
import { explorer } from "@/lib/explorer";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { erc20Abi } from "@/features/pools/abi";
import { estimateGasCost, useAllowance, useClient, useTokenBalance, useTxAction } from "@/features/pools/hooks";
import { formatPrice } from "@/features/pools/math/price";
import { choiceSymbol, isNative, NATIVE, type TokenChoice } from "@/features/pools/tokens";
import { TokenSelectModal } from "@/features/pools/components/TokenSelectModal";
import { feeLabel, fmtAmount, Notice, TokenLogo, TxStatusBox } from "@/features/pools/components/ui";
import { swapRouter02Abi } from "../abi";
import { impactLevel, minimumReceived, priceImpactBps } from "../math";
import { bestQuote, NoRouteError, planSwap, type RouteHop } from "../route";

const WETH = CONTRACTS.weth.address as Address;
const SLIPPAGE = [10, 50, 100, 300] as const;
const addrOf = (t: TokenChoice | null): Address | undefined => (!t ? undefined : isNative(t) ? WETH : t.address);
const decOf = (t: TokenChoice | null) => (!t || isNative(t) ? 18 : t.decimals);
const safeParse = (v: string, d: number) => {
  try {
    return v && /^\d*\.?\d*$/.test(v) && v !== "." ? parseUnits(v, d) : 0n;
  } catch {
    return 0n;
  }
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function Swap() {
  const client = useClient();
  const qc = useQueryClient();
  const { address, isConnected } = useAccount();
  const [tokenIn, setTokenIn] = useState<TokenChoice | null>(NATIVE);
  const [tokenOut, setTokenOut] = useState<TokenChoice | null>(null);
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState<number>(50);
  const [picker, setPicker] = useState<"in" | "out" | null>(null);
  const [invertRate, setInvertRate] = useState(false);
  const [ackImpact, setAckImpact] = useState(false);
  const approveTx = useTxAction();
  const swapTx = useTxAction();

  const inAddr = addrOf(tokenIn);
  const outAddr = addrOf(tokenOut);
  const decIn = decOf(tokenIn);
  const decOut = decOf(tokenOut);
  const symIn = choiceSymbol(tokenIn);
  const symOut = choiceSymbol(tokenOut);
  const wrapOnly = Boolean(inAddr && outAddr && inAddr.toLowerCase() === outAddr.toLowerCase());
  const amountIn = safeParse(amount, decIn);
  const debouncedIn = useDebounced(amountIn, 400);

  const quote = useQuery({
    queryKey: ["swap-quote", inAddr, outAddr, debouncedIn.toString()],
    enabled: Boolean(client && inAddr && outAddr && debouncedIn > 0n && !wrapOnly),
    refetchInterval: 15_000,
    retry: false,
    queryFn: () => bestQuote(client!, inAddr!, outAddr!, debouncedIn),
  });
  const q = quote.data && quote.data.amountIn === amountIn ? quote.data : null;
  const stale = Boolean(quote.data && quote.data.amountIn !== amountIn);

  const impact = q ? priceImpactBps(q.midOut, q.amountOut) : 0;
  const level = impactLevel(impact);
  const minOut = q ? minimumReceived(q.amountOut, slip) : 0n;
  useEffect(() => {
    setAckImpact(false);
  }, [q?.amountOut]);

  const balIn = useTokenBalance(tokenIn ? (isNative(tokenIn) ? "ETH" : inAddr) : undefined);
  const balOut = useTokenBalance(tokenOut ? (isNative(tokenOut) ? "ETH" : outAddr) : undefined);
  const router = requireContract("uniswapV3SwapRouter02");
  const allowance = useAllowance(tokenIn && !isNative(tokenIn) ? inAddr : undefined, router);
  const needsApproval = Boolean(tokenIn && !isNative(tokenIn) && amountIn > 0n && (allowance.data ?? 0n) < amountIn);
  const insufficient = balIn.data !== undefined && amountIn > balIn.data;

  const buildRequest = () => {
    if (!q || !address) return null;
    const plan = planSwap({
      hops: q.hops,
      amountIn: q.amountIn,
      minOut,
      recipient: address,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
      nativeIn: isNative(tokenIn),
      nativeOut: isNative(tokenOut),
    });
    return { address: router, abi: swapRouter02Abi, functionName: "multicall", args: plan.args, value: plan.value } as const;
  };

  const gas = useQuery({
    queryKey: ["swap-gas", q?.quotedAt, slip, address],
    enabled: Boolean(q && address && client && !needsApproval && !insufficient),
    retry: false,
    queryFn: () => estimateGasCost(client!, address!, buildRequest()!),
  });

  const busy = approveTx.busy || swapTx.busy;
  const canSwap = Boolean(isConnected && q && !needsApproval && !insufficient && !busy && !stale && (level !== "blocked" || ackImpact));

  const flip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmount(q ? formatUnits(q.amountOut, decOut) : "");
  };

  const approve = async () => {
    if (!inAddr) return;
    const r = await approveTx.run(`Approve ${symIn}`, { address: inAddr, abi: erc20Abi, functionName: "approve", args: [router, amountIn] });
    if (r) qc.invalidateQueries({ queryKey: ["allowance"] });
  };

  const swap = async () => {
    const req = buildRequest();
    if (!req || !q) return;
    const label = `Swap ${fmtAmount(q.amountIn, decIn, 5)} ${symIn} → ${symOut}`;
    const r = await swapTx.run(label, req);
    if (r) {
      setAmount("");
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["allowance"] });
    }
  };

  const rate = q && q.amountIn > 0n
    ? Number(formatUnits(q.amountOut, decOut)) / Number(formatUnits(q.amountIn, decIn))
    : null;
  const hopIn = (h: RouteHop) => (h.zeroForOne ? h.pool.token0.symbol : h.pool.token1.symbol);
  const hopOut = (h: RouteHop) => (h.zeroForOne ? h.pool.token1.symbol : h.pool.token0.symbol);
  const routeText = q
    ? [isNative(tokenIn) ? "ETH" : hopIn(q.hops[0]), ...q.hops.map((h, i) => `${i === q.hops.length - 1 && isNative(tokenOut) ? "ETH" : hopOut(h)} (${feeLabel(h.fee)})`)].join(" → ")
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
      <Card className="overflow-hidden">
        <CardHeader
          eyebrow="Uniswap v3"
          title="Swap"
          action={
            <div className="flex gap-1">
              {SLIPPAGE.map((s) => (
                <button key={s} onClick={() => setSlip(s)} disabled={busy}
                  className={cn("num rounded-md border px-1.5 py-0.5 text-[12px]", slip === s ? "border-accent text-accent" : "border-line-strong text-muted")}
                  aria-label={`Slippage ${s / 100}%`}>
                  {s / 100}%
                </button>
              ))}
            </div>
          }
        />
        <div className="space-y-2 p-4">
          <TokenBox
            label="You pay"
            token={tokenIn}
            onPick={() => setPicker("in")}
            balance={balIn.data}
            decimals={decIn}
            invalid={insufficient}
            disabled={busy}
            input={
              <input inputMode="decimal" placeholder="0.0" value={amount} disabled={busy} aria-label="Amount to pay"
                onChange={(e) => setAmount(e.target.value.replace(",", "."))} className="num w-full min-w-0 bg-transparent text-3xl outline-none" />
            }
            onMax={balIn.data !== undefined ? () => {
              const b = balIn.data!;
              const reserve = isNative(tokenIn) ? 2n * 10n ** 15n : 0n; // keep a little ETH for gas
              setAmount(formatUnits(b > reserve ? b - reserve : 0n, decIn));
            } : undefined}
          />
          <div className="relative z-10 -my-4 flex justify-center">
            <button onClick={flip} disabled={busy} aria-label="Switch tokens" className="grid size-9 place-items-center rounded-lg border border-line-strong bg-raised text-muted hover:text-fg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>
            </button>
          </div>
          <TokenBox
            label="You receive"
            token={tokenOut}
            onPick={() => setPicker("out")}
            balance={balOut.data}
            decimals={decOut}
            disabled={busy}
            input={
              <div className={cn("num truncate text-3xl", !q && "text-faint")} aria-live="polite">
                {quote.isFetching && !q ? "…" : q ? fmtAmount(q.amountOut, decOut, 8) : "0.0"}
              </div>
            }
          />
        </div>

        <div className="space-y-2 px-4 pb-4">
          {wrapOnly && <Notice>ETH ↔ WETH is a wrap, not a swap. Pick a different token.</Notice>}
          {quote.isError && (
            <Notice tone="warn">{quote.error instanceof NoRouteError ? quote.error.message : "Quote failed. The RPC or QuoterV2 did not respond; try again."}</Notice>
          )}
          {q && (
            <div className="space-y-1.5 rounded-xl border border-line p-3 text-[13px]">
              <Row k="Rate" v={rate ? (
                <button onClick={() => setInvertRate((v) => !v)} className="hover:text-accent">
                  {invertRate ? `1 ${symOut} = ${formatPrice(1 / rate)} ${symIn}` : `1 ${symIn} = ${formatPrice(rate)} ${symOut}`}
                </button>
              ) : "—"} />
              <Row k="Price impact" v={<span className={cn(level === "low" ? "text-up" : level === "medium" ? "text-warn" : "text-down")}>{(impact / 100).toFixed(2)}%</span>} />
              <Row k={`Minimum received (${slip / 100}%)`} v={`${fmtAmount(minOut, decOut, 8)} ${symOut}`} />
              <Row k="Route" v={<span className="text-[12px]">{routeText}</span>} />
              <Row k="Estimated gas" v={gas.data ? `${Number(formatUnits(gas.data.wei, 18)).toPrecision(3)} ETH` : needsApproval ? "After approval" : gas.isFetching ? "Estimating…" : `~${q.gasEstimate.toLocaleString("en-US")} gas (quoter)`} />
              <p className="pt-1 text-[11px] text-faint">Quoted by Uniswap QuoterV2 {timeAgo(q.quotedAt)} · refreshes every 15 s. The transaction reverts if you would receive less than the minimum.</p>
            </div>
          )}
          {q && level === "blocked" && (
            <label className="flex items-start gap-2 rounded-xl border border-down/30 bg-down/10 p-3 text-[13px]">
              <input type="checkbox" checked={ackImpact} onChange={(e) => setAckImpact(e.target.checked)} className="mt-0.5" />
              <span>Price impact is {(impact / 100).toFixed(2)}%. You would lose a large part of the value to the pool. I understand and still want to swap.</span>
            </label>
          )}

          {!isConnected ? (
            <ConnectWalletButton block />
          ) : needsApproval && q ? (
            <Button variant="primary" className="h-12 w-full" disabled={busy || insufficient} onClick={approve}>
              {approveTx.busy ? "Approving…" : `Approve ${fmtAmount(amountIn, decIn, 6)} ${symIn} (exact amount)`}
            </Button>
          ) : (
            <Button variant="primary" className="h-12 w-full text-[15px]" disabled={!canSwap} onClick={swap}>
              {swapTx.busy ? "Swapping…" : !tokenOut ? "Select a token" : amountIn === 0n ? "Enter an amount" : insufficient ? `Insufficient ${symIn}` : stale || quote.isFetching ? "Fetching quote…" : !q ? "No quote" : "Swap"}
            </Button>
          )}
          <TxStatusBox state={approveTx.state} onReset={approveTx.reset} />
          <TxStatusBox state={swapTx.state} onReset={swapTx.reset} />
        </div>
      </Card>

      <SwapHistory />

      {picker && (
        <TokenSelectModal
          exclude={picker === "in" ? (tokenOut ? (isNative(tokenOut) ? NATIVE : tokenOut.address) : undefined) : tokenIn ? (isNative(tokenIn) ? NATIVE : tokenIn.address) : undefined}
          onClose={() => setPicker(null)}
          onSelect={(t) => {
            if (picker === "in") setTokenIn(t);
            else setTokenOut(t);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function TokenBox(p: {
  label: string;
  token: TokenChoice | null;
  onPick: () => void;
  balance?: bigint;
  decimals: number;
  input: React.ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  onMax?: () => void;
}) {
  return (
    <div className={cn("rounded-xl border bg-canvas p-4", p.invalid ? "border-down/60" : "border-line-strong")}>
      <p className="text-[12px] text-muted">{p.label}</p>
      <div className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">{p.input}</div>
        <button onClick={p.onPick} disabled={p.disabled}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-line-strong bg-raised pl-1.5 pr-3 text-sm font-medium hover:border-faint">
          {p.token ? <TokenLogo symbol={choiceSymbol(p.token)} logo={!isNative(p.token) ? p.token.logo : undefined} size={26} /> : null}
          {p.token ? choiceSymbol(p.token) : <span className="pl-1.5">Select token</span>}
        </button>
      </div>
      <div className="mt-1.5 flex justify-end text-[12px] text-faint">
        {p.balance !== undefined && (
          <span>
            Balance <span className="num">{fmtAmount(p.balance, p.decimals)}</span>
            {p.onMax && <button onClick={p.onMax} disabled={p.disabled} className="ml-1.5 text-accent hover:underline">Max</button>}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="num text-right">{v}</span>
    </div>
  );
}

/** Swaps sent from this browser, with their on-chain receipt status. */
function SwapHistory() {
  const { txs } = useTxTracker();
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const swaps = useMemo(() => txs.filter((t) => /^(Swap|Approve)/.test(t.label)).slice(0, 15), [txs]);
  return (
    <Card>
      <CardHeader eyebrow="History" title="Your swaps" action={mounted && address ? (
        <a href={explorer.address(address)} target="_blank" rel="noreferrer" className="text-[13px] text-muted hover:text-fg">Full history ↗</a>
      ) : null} />
      {!mounted || swaps.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted">No swaps from this browser yet. Each swap appears here with its confirmed on-chain status.</p>
      ) : (
        <ul className="divide-y divide-line">
          {swaps.map((t) => (
            <li key={t.hash}>
              <a href={explorer.tx(t.hash)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] hover:bg-raised">
                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                <Badge tone={t.status === "success" ? "up" : t.status === "reverted" ? "down" : "accent"}>
                  {t.status === "success" ? "Confirmed" : t.status === "reverted" ? "Reverted" : "Pending"}
                </Badge>
                <span className="w-16 text-right text-faint">{timeAgo(t.createdAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
