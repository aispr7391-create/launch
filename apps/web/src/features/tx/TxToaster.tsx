"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Dot } from "@/components/ui/primitives";
import { explorer } from "@/lib/explorer";
import { shortAddress } from "@/lib/format";
import { useTxTracker } from "./TxProvider";

const VISIBLE_MS = 90_000;

export function TxToaster() {
  const { txs } = useTxTracker();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  const recent = txs.filter((t) => t.status === "pending" || now - t.createdAt < VISIBLE_MS).slice(0, 3);
  if (!recent.length) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] space-y-2 lg:bottom-6" aria-live="polite">
      {recent.map((t) => (
        <a
          key={t.hash}
          href={explorer.tx(t.hash)}
          target="_blank"
          rel="noreferrer"
          className="animate-rise flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-xl shadow-black/40 hover:border-line-strong"
        >
          <Dot tone={t.status === "success" ? "up" : t.status === "reverted" ? "down" : "accent"} pulse={t.status === "pending"} />
          <div className="min-w-0 flex-1">
            <p className="truncate">{t.label}</p>
            <p className="num text-[12px] text-faint">
              {t.status === "pending" ? "Waiting for confirmation" : t.status === "success" ? "Confirmed" : "Reverted"} ·{" "}
              {shortAddress(t.hash, 6)}
            </p>
          </div>
          <Icon name="external" className="text-faint" />
        </a>
      ))}
    </div>
  );
}
