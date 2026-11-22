"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { BRAND } from "@/config/brand";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { readableError } from "@/lib/errors";

/**
 * Network detection + switching. Shown whenever the connected wallet is on any
 * chain other than the active Robinhood Chain network. wagmi's injected connector
 * calls wallet_addEthereumChain automatically if the wallet does not know the chain.
 */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!isConnected || chainId === ACTIVE_CHAIN.id) return null;

  return (
    <div className="border-b border-accent/30 bg-accent-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3 text-sm">
          <Icon name="alert" className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p>
              Your wallet is on chain <span className="num">{chainId ?? "unknown"}</span>. {BRAND.name} runs only on{" "}
              <span className="font-medium">{ACTIVE_CHAIN.name}</span>.
            </p>
            {error && <p className="mt-1 text-[13px] text-down">{readableError(error)}</p>}
          </div>
        </div>
        <Button variant="primary" size="sm" disabled={isPending} onClick={() => switchChain({ chainId: ACTIVE_CHAIN.id })}>
          {isPending ? "Confirm in wallet…" : `Switch to ${ACTIVE_CHAIN.name}`}
        </Button>
      </div>
    </div>
  );
}
