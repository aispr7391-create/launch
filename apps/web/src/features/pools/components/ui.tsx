"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatUnits, type Address } from "viem";
import { Button, Dot } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { explorer } from "@/lib/explorer";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import type { TxState } from "../hooks";
import type { RangeStatus } from "../quote";

export const POOL_TABS = [
  { href: "/pools", label: "Overview" },
  { href: "/pools/explore", label: "Explore pools" },
  { href: "/pools/positions", label: "My positions" },
  { href: "/pools/add", label: "Add liquidity" },
];

export function PoolsNav() {
  const path = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1" aria-label="Liquidity">
      {POOL_TABS.map((t) => {
        const active = t.href === "/pools" ? path === "/pools" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={cn("flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13px] transition", active ? "bg-raised text-fg" : "text-muted hover:text-fg")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Raw integer → human string with up to `sig` significant digits. */
export function fmtAmount(raw: bigint, decimals: number, sig = 6): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return "0";
  if (Math.abs(n) < 1e-9) return `<0.000000001`;
  if (Math.abs(n) >= 1e12) return n.toExponential(3);
  return n.toLocaleString("en-US", { maximumSignificantDigits: sig });
}

export function feeLabel(fee: number) {
  return `${(fee / 10_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export function TokenLogo({ symbol, logo, size = 28 }: { symbol: string; logo?: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-raised text-[10px] font-semibold text-muted" style={{ width: size, height: size }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-full object-cover" />
      ) : (
        symbol.slice(0, 3).toUpperCase()
      )}
    </span>
  );
}

export function PairLogos({ a, b, size = 28 }: { a: string; b: string; size?: number }) {
  return (
    <span className="flex">
      <TokenLogo symbol={a} size={size} />
      <span className="-ml-2.5 rounded-full ring-2 ring-surface"><TokenLogo symbol={b} size={size} /></span>
    </span>
  );
}

export function AddressLink({ address, chars = 4 }: { address: Address | string; chars?: number }) {
  return (
    <a href={explorer.address(address)} target="_blank" rel="noreferrer" className="num inline-flex items-center gap-1 text-faint hover:text-accent">
      {shortAddress(address, chars)} <Icon name="external" size={11} />
    </a>
  );
}

export function RangeBadge({ status, closed }: { status: RangeStatus; closed?: boolean }) {
  if (closed) return <span className="inline-flex items-center gap-1.5 text-[12px] text-faint"><Dot tone="muted" /> Closed</span>;
  return status === "in-range" ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-up"><Dot /> In range</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-warn"><Dot tone="accent" /> Out of range</span>
  );
}

const PHASE_TEXT: Record<TxState["phase"], string> = {
  idle: "",
  network: "Checking wallet and network…",
  simulating: "Simulating and estimating gas…",
  signing: "Confirm in your wallet…",
  pending: "Waiting for confirmation on Robinhood Chain…",
  success: "Confirmed",
  error: "Failed",
};

export function TxStatusBox({ state, onReset, success }: { state: TxState; onReset?: () => void; success?: React.ReactNode }) {
  if (state.phase === "idle") return null;
  const tone = state.phase === "success" ? "border-up/30 bg-up/10" : state.phase === "error" ? "border-down/30 bg-down/10" : "border-line bg-raised";
  return (
    <div className={cn("rounded-xl border p-4 text-[13px]", tone)} aria-live="polite">
      <div className="flex items-center gap-2">
        {state.phase !== "success" && state.phase !== "error" && <Dot tone="accent" pulse />}
        <p className={cn("font-medium", state.phase === "success" ? "text-up" : state.phase === "error" ? "text-down" : "")}>
          {state.label}: {PHASE_TEXT[state.phase]}
        </p>
      </div>
      {state.error && <p className="mt-1 text-muted">{state.error}</p>}
      {state.hash && (
        <a href={explorer.tx(state.hash)} target="_blank" rel="noreferrer" className="num mt-1 inline-flex items-center gap-1 text-muted hover:text-accent">
          {shortAddress(state.hash, 6)} <Icon name="external" size={12} />
        </a>
      )}
      {state.phase === "success" && success}
      {(state.phase === "success" || state.phase === "error") && onReset && (
        <Button size="sm" className="mt-3" onClick={onReset}>{state.phase === "error" ? "Try again" : "Done"}</Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "down"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "border-warn/30 bg-warn/10" : tone === "down" ? "border-down/30 bg-down/10" : "border-line bg-raised";
  return <div className={cn("rounded-xl border px-4 py-3 text-[13px] leading-5 text-muted", cls)}>{children}</div>;
}
