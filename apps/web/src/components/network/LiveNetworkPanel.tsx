"use client";

import { useQuery } from "@tanstack/react-query";
import { useBlockNumber, useGasPrice, usePublicClient } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Badge, Card, CardHeader, Dot, Skeleton, Stat } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { explorer } from "@/lib/explorer";
import { formatGasGwei, formatInt } from "@/lib/format";

/**
 * Reads live data straight from the configured RPC and checks that the RPC
 * reports the chain ID we expect (guards against a misconfigured endpoint).
 */
export function LiveNetworkPanel() {
  const chainId = ACTIVE_CHAIN.id;
  const client = usePublicClient({ chainId });
  const block = useBlockNumber({ chainId, watch: true });
  const gas = useGasPrice({ chainId, query: { refetchInterval: 15_000 } });

  const rpc = useQuery({
    queryKey: ["rpc-health", chainId],
    enabled: Boolean(client),
    refetchInterval: 30_000,
    queryFn: async () => {
      const t0 = performance.now();
      const reported = await client!.getChainId();
      return { reported, latencyMs: Math.round(performance.now() - t0) };
    },
  });

  const verified = rpc.data?.reported === chainId;
  const healthy = rpc.isSuccess && verified;

  return (
    <Card>
      <CardHeader
        eyebrow="Network"
        title={ACTIVE_CHAIN.name}
        action={
          rpc.isError ? (
            <Badge tone="down"><Dot tone="down" /> RPC unreachable</Badge>
          ) : rpc.isSuccess && !verified ? (
            <Badge tone="down"><Dot tone="down" /> Chain ID mismatch</Badge>
          ) : healthy ? (
            <Badge tone="up"><Dot pulse /> Connected</Badge>
          ) : (
            <Badge>Checking…</Badge>
          )
        }
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4">
        <Stat
          label="Chain ID"
          value={chainId}
          hint={
            rpc.data ? (verified ? "Verified by RPC" : `RPC reports ${rpc.data.reported}`) : <Skeleton className="w-16" />
          }
        />
        <Stat
          label="Latest block"
          value={
            block.data !== undefined ? (
              <a href={explorer.block(block.data)} target="_blank" rel="noreferrer" className="hover:text-accent">
                {formatInt(block.data)}
              </a>
            ) : block.isError ? "—" : <Skeleton />
          }
          hint="Live"
        />
        <Stat
          label="Gas price"
          value={gas.data !== undefined ? `${formatGasGwei(gas.data)} gwei` : gas.isError ? "—" : <Skeleton />}
          hint="From RPC"
        />
        <Stat
          label="RPC latency"
          value={rpc.data ? `${rpc.data.latencyMs} ms` : rpc.isError ? "—" : <Skeleton className="w-12" />}
          hint={`Gas token ${ACTIVE_CHAIN.nativeCurrency.symbol}`}
        />
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px]">
        <span className="text-faint">Arbitrum Orbit L2 · settles to Ethereum</span>
        <a href={explorer.home()} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted hover:text-fg">
          Explorer <Icon name="external" size={14} />
        </a>
      </div>
    </Card>
  );
}
