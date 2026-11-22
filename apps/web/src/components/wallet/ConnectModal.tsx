"use client";

import { useEffect, useMemo } from "react";
import { useConnect, type Connector } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Icon } from "@/components/ui/Icon";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/cn";

/**
 * Custom wallet picker. Lists every EIP-6963 wallet the browser announces, plus
 * The generic "Injected" entry is shown only if
 * no specific wallet was discovered.
 */
export function ConnectModal({ onClose }: { onClose: () => void }) {
  const { connectors, connect, isPending, variables, error, reset } = useConnect();

  const list = useMemo(() => {
    const discovered = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
    const generic = connectors.filter((c) => c.id === "injected");
    const others = connectors.filter((c) => c.type !== "injected");
    return [...discovered, ...(discovered.length ? [] : generic), ...others];
  }, [connectors]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => reset(), [reset]);

  const pendingId = isPending ? (variables?.connector as Connector | undefined)?.uid : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="connect-title">
      <button className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />

      <div className="animate-rise relative w-full max-w-sm rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="connect-title" className="text-base font-semibold">Connect a wallet</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-fg" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.uid}>
              <button
                onClick={() => connect({ connector: c, chainId: ACTIVE_CHAIN.id })}
                disabled={isPending}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-xl border border-line bg-raised px-3 text-left text-sm transition",
                  "hover:border-line-strong disabled:opacity-60",
                  pendingId === c.uid && "border-accent/50",
                )}
              >
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" className="size-7 rounded-md" />
                ) : (
                  <span className="grid size-7 place-items-center rounded-md bg-line text-muted">
                    <Icon name="wallet" />
                  </span>
                )}
                <span className="flex-1 font-medium">{c.id === "injected" ? "Browser wallet" : c.name}</span>
                {pendingId === c.uid && <span className="text-[12px] text-accent">Check wallet…</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="rounded-xl border border-line p-4 text-sm text-muted">
              No wallet detected. Install an EVM browser wallet (MetaMask, Rabby, Coinbase Wallet), or open this site in your mobile wallet&apos;s built-in browser.
            </li>
          )}
        </ul>

        {error && <p className="mt-3 text-[13px] text-down">{readableError(error)}</p>}

        <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[12px] leading-5 text-faint">
          <p>
            Connects to <span className="text-muted">{ACTIVE_CHAIN.name}</span> (chain ID{" "}
            <span className="num">{ACTIVE_CHAIN.id}</span>). Your wallet will offer to add the network if it is missing.
          </p>
          <p>We will never ask for your seed phrase or private key.</p>
        </div>
      </div>
    </div>
  );
}
