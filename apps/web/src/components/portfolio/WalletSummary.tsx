"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Badge, Card, CardHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { explorer } from "@/lib/explorer";
import { formatToken, shortAddress } from "@/lib/format";

export function WalletSummary() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address, isConnected, chainId, connector } = useAccount();
  const balance = useBalance({ address, chainId: ACTIVE_CHAIN.id, query: { refetchInterval: 15_000 } });

  if (!mounted || !isConnected || !address) {
    return (
      <Card className="flex flex-col">
        <CardHeader eyebrow="Wallet" title="Not connected" />
        <div className="flex flex-1 flex-col justify-between gap-5 p-5">
          <p className="text-sm text-muted">
            Connect an EVM wallet to see your balance on {ACTIVE_CHAIN.name}. Signing happens in your wallet only.
          </p>
          <ConnectWalletButton block />
        </div>
      </Card>
    );
  }

  const onRightChain = chainId === ACTIVE_CHAIN.id;

  return (
    <Card>
      <CardHeader
        eyebrow="Wallet"
        title={<a href={explorer.address(address)} target="_blank" rel="noreferrer" className="num hover:text-accent">{shortAddress(address, 6)}</a>}
        action={onRightChain ? <Badge tone="up">On network</Badge> : <Badge tone="down">Wrong network</Badge>}
      />
      <div className="grid grid-cols-2 gap-5 p-5">
        <Stat
          label={`${ACTIVE_CHAIN.nativeCurrency.symbol} balance`}
          value={
            balance.data ? formatToken(balance.data.value, balance.data.decimals, 6) : balance.isError ? "—" : <Skeleton />
          }
          hint="Read from chain"
        />
        <Stat label="Wallet" value={<span className="font-sans text-base">{connector?.name ?? "—"}</span>} hint={`Chain ${chainId}`} />
      </div>
    </Card>
  );
}
