"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Icon } from "@/components/ui/Icon";
import { Dot, Skeleton } from "@/components/ui/primitives";
import { explorer } from "@/lib/explorer";
import { formatToken, shortAddress } from "@/lib/format";

export function AccountMenu() {
  const { address, chainId, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance, isLoading } = useBalance({
    address,
    chainId: ACTIVE_CHAIN.id,
    query: { refetchInterval: 15_000 },
  });
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onRightChain = chainId === ACTIVE_CHAIN.id;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!address) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2.5 rounded-lg border border-line-strong bg-raised pl-3 pr-2 text-sm transition hover:border-faint"
        aria-expanded={open}
      >
        <Dot tone={onRightChain ? "up" : "down"} />
        <span className="num hidden text-muted sm:inline">
          {isLoading ? <Skeleton className="w-12" /> : balance ? `${formatToken(balance.value, balance.decimals)} ETH` : "—"}
        </span>
        <span className="num">{shortAddress(address)}</span>
        <Icon name="chevron" className="text-faint" />
      </button>

      {open && (
        <div className="animate-rise absolute right-0 top-12 z-40 w-72 rounded-xl border border-line bg-surface p-2 shadow-2xl shadow-black/50">
          <div className="rounded-lg bg-raised p-3">
            <p className="text-[11px] text-faint">Connected with {connector?.name ?? "wallet"}</p>
            <p className="num mt-1 break-all text-[13px]">{address}</p>
            <p className="mt-3 text-[11px] text-faint">Balance on {ACTIVE_CHAIN.name}</p>
            <p className="num text-lg">
              {balance ? `${formatToken(balance.value, balance.decimals, 6)} ${balance.symbol}` : "—"}
            </p>
          </div>
          <div className="mt-1 grid gap-0.5">
            <MenuItem onClick={copy} icon={copied ? "check" : "copy"}>{copied ? "Copied" : "Copy address"}</MenuItem>
            <a
              href={explorer.address(address)}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-muted hover:bg-raised hover:text-fg"
            >
              <Icon name="external" /> View on explorer
            </a>
            <MenuItem onClick={() => { disconnect(); setOpen(false); }} icon="power">Disconnect</MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, icon, onClick }: { children: React.ReactNode; icon: "copy" | "check" | "power"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm text-muted hover:bg-raised hover:text-fg">
      <Icon name={icon} /> {children}
    </button>
  );
}
