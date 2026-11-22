"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Hash } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";

/**
 * On-chain transaction tracking. Any module that sends a transaction calls
 * `track(hash, label)`; this provider waits for the real receipt from the RPC
 * and updates status. Nothing is marked successful without a receipt.
 *
 * History is cached per browser (localStorage) for convenience only; the
 * explorer is the source of truth for full history.
 */

export type TxStatus = "pending" | "success" | "reverted";
export interface TrackedTx {
  hash: Hash;
  label: string;
  chainId: number;
  status: TxStatus;
  createdAt: number;
  blockNumber?: string;
}

interface TxContextValue {
  txs: TrackedTx[];
  track: (hash: Hash, label: string) => void;
  clear: () => void;
}

const TxContext = createContext<TxContextValue | null>(null);
const STORAGE_KEY = "px:txs:v1";
const MAX_STORED = 50;

export function TxProvider({ children }: { children: React.ReactNode }) {
  const [txs, setTxs] = useState<TrackedTx[]>([]);
  // State (not a ref) so the first save runs in the same render as the loaded data.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTxs((JSON.parse(raw) as TrackedTx[]).filter((t) => t.chainId === ACTIVE_CHAIN.id));
    } catch {
      /* storage unavailable or corrupt */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(txs.slice(0, MAX_STORED)));
    } catch {
      /* ignore */
    }
  }, [txs, hydrated]);

  const track = useCallback((hash: Hash, label: string) => {
    setTxs((prev) => [
      { hash, label, chainId: ACTIVE_CHAIN.id, status: "pending", createdAt: Date.now() },
      ...prev.filter((t) => t.hash !== hash),
    ]);
  }, []);

  const settle = useCallback((hash: Hash, status: TxStatus, blockNumber?: bigint) => {
    setTxs((prev) =>
      prev.map((t) => (t.hash === hash ? { ...t, status, blockNumber: blockNumber?.toString() } : t)),
    );
  }, []);

  const clear = useCallback(() => setTxs([]), []);

  return (
    <TxContext.Provider value={{ txs, track, clear }}>
      {children}
      {txs
        .filter((t) => t.status === "pending")
        .map((t) => (
          <TxWatcher key={t.hash} tx={t} onSettled={settle} />
        ))}
    </TxContext.Provider>
  );
}

function TxWatcher({ tx, onSettled }: { tx: TrackedTx; onSettled: (h: Hash, s: TxStatus, b?: bigint) => void }) {
  const { data: receipt } = useWaitForTransactionReceipt({ hash: tx.hash, chainId: tx.chainId });
  useEffect(() => {
    if (receipt) onSettled(tx.hash, receipt.status === "success" ? "success" : "reverted", receipt.blockNumber);
  }, [receipt, tx.hash, onSettled]);
  return null;
}

export function useTxTracker(): TxContextValue {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error("useTxTracker must be used inside <TxProvider>");
  return ctx;
}
