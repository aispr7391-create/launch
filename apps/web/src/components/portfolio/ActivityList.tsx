"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardHeader, Dot } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useTxTracker } from "@/features/tx/TxProvider";
import { explorer } from "@/lib/explorer";
import { shortAddress, timeAgo } from "@/lib/format";

/** Transactions sent from this app (receipt-confirmed), plus a link to full history on the explorer. */
export function ActivityList() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { txs } = useTxTracker();
  const { address } = useAccount();

  return (
    <Card className="flex flex-col">
      <CardHeader
        eyebrow="Activity"
        title="Transactions from this app"
        action={
          mounted && address ? (
            <a href={explorer.address(address)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-muted hover:text-fg">
              Full history <Icon name="external" size={14} />
            </a>
          ) : null
        }
      />
      {!mounted || txs.length === 0 ? (
        <p className="flex-1 px-5 py-6 text-[13px] text-muted">
          No transactions yet. Launches, swaps and liquidity actions will appear here with their on-chain status.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {txs.slice(0, 10).map((t) => (
            <li key={t.hash}>
              <a href={explorer.tx(t.hash)} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-raised">
                <Dot tone={t.status === "success" ? "up" : t.status === "reverted" ? "down" : "accent"} pulse={t.status === "pending"} />
                <span className="flex-1 truncate">{t.label}</span>
                <span className="num text-[12px] text-faint">{shortAddress(t.hash, 4)}</span>
                <span className="w-14 text-right text-[12px] text-faint">{timeAgo(t.createdAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
