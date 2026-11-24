"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { Badge, Button, Skeleton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { Portal } from "@/components/ui/Portal";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { useClient } from "../hooks";
import { fetchTokenMeta, type TokenMeta } from "../onchain";
import { NATIVE, saveImported, useTokenList, type ListedToken, type TokenChoice } from "../tokens";
import { TokenLogo } from "./ui";

const SOURCE_LABEL: Record<ListedToken["source"], string> = {
  native: "Native",
  official: "Robinhood docs",
  projectx: "SYNORA launch",
  imported: "Imported",
};

export function TokenSelectModal({ onSelect, onClose, exclude }: { onSelect: (t: TokenChoice) => void; onClose: () => void; exclude?: string }) {
  const list = useTokenList();
  const client = useClient();
  const [q, setQ] = useState("");
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" | "found" | "error"; token?: TokenMeta; error?: string }>({ state: "idle" });
  const [ack, setAck] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data ?? []).filter(
      (t) => t.address.toLowerCase() !== exclude?.toLowerCase() && (!s || t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) || t.address.toLowerCase() === s),
    );
  }, [list.data, q, exclude]);

  // Paste-an-address: verify it on-chain before it can be selected.
  useEffect(() => {
    const s = q.trim();
    setAck(false);
    if (!isAddress(s) || !client || filtered.length) return setLookup({ state: "idle" });
    let cancelled = false;
    setLookup({ state: "loading" });
    fetchTokenMeta(client, s)
      .then((token) => !cancelled && setLookup({ state: "found", token }))
      .catch((err: Error) => !cancelled && setLookup({ state: "error", error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [q, client, filtered.length]);

  const showEth = !q.trim() || "eth ether".includes(q.trim().toLowerCase());

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="tok-title">
      <button className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="animate-rise relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border border-line bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 id="tok-title" className="text-base font-semibold">Select a token</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-fg" aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="px-5 pb-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or paste address"
            className="h-11 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm outline-none focus:border-accent" />
        </div>
        <ul className="flex-1 overflow-y-auto border-t border-line px-2 py-2">
          {showEth && exclude !== NATIVE && (
            <Row onClick={() => onSelect(NATIVE)} symbol="ETH" name="Ether (native, wrapped via WETH9)" badge="Native" />
          )}
          {list.isLoading && <li className="px-3 py-3"><Skeleton className="w-40" /></li>}
          {filtered.map((t) => (
            <Row key={t.address} onClick={() => onSelect(t)} symbol={t.symbol} name={t.name} logo={t.logo} address={t.address} badge={SOURCE_LABEL[t.source]} warn={t.source === "imported"} />
          ))}
          {!list.isLoading && !filtered.length && lookup.state === "idle" && !showEth && (
            <li className="px-3 py-6 text-center text-[13px] text-muted">No match. Paste a token contract address to import it.</li>
          )}
          {lookup.state === "loading" && <li className="px-3 py-3 text-[13px] text-muted">Checking contract on Robinhood Chain…</li>}
          {lookup.state === "error" && <li className="px-3 py-3 text-[13px] text-down">{lookup.error}</li>}
          {lookup.state === "found" && lookup.token && (
            <li className="m-1 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[13px]">
              <p className="font-medium">{lookup.token.symbol} · {lookup.token.name}</p>
              <p className="num text-faint">{lookup.token.address}</p>
              <p className="mt-2 leading-5 text-muted">
                This token is not on any list SYNORA trusts. Anyone can create a token with any name — check the contract on the explorer before adding liquidity.
              </p>
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand</label>
              <Button size="sm" variant="primary" className="mt-2" disabled={!ack} onClick={() => {
                saveImported(lookup.token!.address);
                onSelect({ ...lookup.token!, source: "imported" });
              }}>Import {lookup.token.symbol}</Button>
            </li>
          )}
        </ul>
      </div>
    </div>
    </Portal>
  );
}

function Row({ onClick, symbol, name, logo, address, badge, warn }: { onClick: () => void; symbol: string; name: string; logo?: string; address?: string; badge: string; warn?: boolean }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-raised">
        <TokenLogo symbol={symbol} logo={logo} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{symbol}</span>
          <span className="block truncate text-[12px] text-faint">{name}{address ? ` · ${shortAddress(address)}` : ""}</span>
        </span>
        <Badge tone={warn ? "warn" : "neutral"} className={cn(warn && "shrink-0")}>{badge}</Badge>
      </button>
    </li>
  );
}
