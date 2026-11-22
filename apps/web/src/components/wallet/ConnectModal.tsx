"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnect, type Connector } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Icon } from "@/components/ui/Icon";
import { Portal } from "@/components/ui/Portal";
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

  useEffect(() => {
    return () => reset();
  }, [reset]);

  // Phones have no wallet extensions: offer each wallet's official "open this dapp" deep link.
  const [isMobile, setIsMobile] = useState(false);
  const [links, setLinks] = useState<{ name: string; href: string }[]>([]);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const { host, pathname, search, href } = window.location;
    const url = encodeURIComponent(href);
    setLinks([
      { name: "MetaMask", href: `https://metamask.app.link/dapp/${host}${pathname}${search}` },
      { name: "Coinbase Wallet", href: `https://go.cb-w.com/dapp?cb_url=${url}` },
      { name: "Trust Wallet", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${url}` },
    ]);
  }, []);

  const pendingId = isPending ? (variables?.connector as Connector | undefined)?.uid : undefined;

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="connect-title">
      <button className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />

      <div className="animate-rise relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
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
              {isMobile
                ? "No wallet in this browser. Open this site inside your wallet app:"
                : "No browser wallet detected. Install an EVM wallet extension such as MetaMask, Rabby or Coinbase Wallet, then reload."}
            </li>
          )}
          {list.length === 0 && isMobile && links.map((l) => (
            <li key={l.name}>
              <a href={l.href}
                className="flex h-12 w-full items-center gap-3 rounded-xl border border-line bg-raised px-3 text-sm transition hover:border-line-strong">
                <span className="grid size-7 place-items-center rounded-md bg-line text-muted"><Icon name="wallet" /></span>
                <span className="flex-1 font-medium">Open in {l.name}</span>
                <Icon name="external" className="text-faint" />
              </a>
            </li>
          ))}
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
    </Portal>
  );
}
