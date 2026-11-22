"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { getContract } from "@/config/contracts";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Badge, Card, CardHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { explorer } from "@/lib/explorer";
import { shortAddress } from "@/lib/format";
import { erc20MetaAbi, launchpadAbi, LAUNCH_STATUS } from "../abi";
import type { TokenRow } from "../types";

/**
 * Token page. Every number comes from the chain (token contract + launchpad);
 * descriptive fields come from the verified launch record in the database.
 */
export function TokenDetail({ address }: { address: Address }) {
  const launchpad = getContract("pxLaunchpad");
  const chainId = ACTIVE_CHAIN.id;

  const erc20 = useReadContracts({
    contracts: [
      { address, abi: erc20MetaAbi, functionName: "name", chainId },
      { address, abi: erc20MetaAbi, functionName: "symbol", chainId },
      { address, abi: erc20MetaAbi, functionName: "totalSupply", chainId },
      { address, abi: erc20MetaAbi, functionName: "decimals", chainId },
    ],
  });
  const curve = useReadContracts({
    contracts: launchpad
      ? [
          { address: launchpad, abi: launchpadAbi, functionName: "getLaunch", args: [address], chainId },
          { address: launchpad, abi: launchpadAbi, functionName: "progressBps", args: [address], chainId },
          { address: launchpad, abi: launchpadAbi, functionName: "spotPrice", args: [address], chainId },
        ]
      : [],
    query: { enabled: Boolean(launchpad), refetchInterval: 15_000 },
  });
  const meta = useQuery({
    queryKey: ["token-meta", address],
    queryFn: async (): Promise<TokenRow | null> => {
      const res = await fetch(`/api/tokens/${address}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    retry: 1,
  });

  const [name, symbol, totalSupply, decimals] = erc20.data?.map((r) => r.result) ?? [];
  const isToken = erc20.isSuccess && erc20.data?.[1]?.status === "success";
  const launch = curve.data?.[0]?.result as
    | { creator: Address; status: number; curveSupply: bigint; curveLeft: bigint; realEth: bigint; pool: Address }
    | undefined;
  const progress = curve.data?.[1]?.result as bigint | undefined;
  const price = curve.data?.[2]?.result as bigint | undefined;
  const fromLaunchpad = Boolean(launch && launch.status !== 0);
  const m = meta.data;

  if (erc20.isLoading) {
    return <Card className="p-6"><Skeleton className="w-48" /></Card>;
  }
  if (!isToken) {
    return (
      <Card className="p-6 text-sm text-muted">
        No ERC-20 token found at <span className="num">{address}</span> on {ACTIVE_CHAIN.name}.
      </Card>
    );
  }

  const links = m ? ([["Website", m.website], ["X", m.x_url], ["Telegram", m.telegram], ["Discord", m.discord]] as const).filter(([, v]) => v) : [];

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-raised">
          {m?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-lg font-semibold text-faint">{String(symbol ?? "").slice(0, 2)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{String(name ?? "")}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="num text-sm text-accent">${String(symbol ?? "")}</span>
            {fromLaunchpad && <Badge tone={launch!.status === 3 ? "up" : "accent"}>{LAUNCH_STATUS[launch!.status]}</Badge>}
            <Badge>{ACTIVE_CHAIN.name} · {ACTIVE_CHAIN.id}</Badge>
          </div>
        </div>
        <a href={explorer.token(address)} target="_blank" rel="noreferrer" className="num inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          {shortAddress(address, 6)} <Icon name="external" size={14} />
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="On-chain" title="Token" />
          <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
            <Stat label="Total supply" value={typeof totalSupply === "bigint" ? Number(formatEther(totalSupply)).toLocaleString("en-US") : "—"} />
            <Stat label="Decimals" value={String(decimals ?? "—")} />
            <Stat label="Curve progress" value={progress !== undefined && fromLaunchpad ? `${(Number(progress) / 100).toFixed(2)}%` : "—"} />
            <Stat label="Curve price" value={price && fromLaunchpad && launch!.status !== 3 ? `${formatEther(price)} ETH` : "—"} hint="Per token" />
          </div>
          {fromLaunchpad && progress !== undefined && (
            <div className="px-5 pb-5">
              <div className="h-2 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, Number(progress) / 100)}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-faint">
                {launch!.status === 3
                  ? <>Graduated to Uniswap v3 · <a className="hover:text-accent" href={explorer.address(launch!.pool)} target="_blank" rel="noreferrer">pool {shortAddress(launch!.pool)}</a></>
                  : `${formatEther(launch!.realEth)} ETH raised on the curve`}
              </p>
            </div>
          )}
          {!launchpad && <p className="px-5 pb-5 text-[12px] text-faint">Curve data appears once the PROJECT X launchpad is deployed.</p>}
        </Card>

        <Card>
          <CardHeader eyebrow="About" title={m ? "Description & links" : "Metadata"} />
          <div className="space-y-4 p-5 text-[13px]">
            {meta.isLoading ? (
              <Skeleton className="w-40" />
            ) : m ? (
              <>
                <p className="whitespace-pre-line break-words leading-5 text-muted">{m.description || "No description."}</p>
                {links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {links.map(([label, url]) => (
                      <a key={label} href={url!} target="_blank" rel="noreferrer nofollow" className="rounded-md border border-line-strong px-2 py-0.5 text-muted hover:text-fg">{label}</a>
                    ))}
                  </div>
                )}
                <dl className="space-y-1.5 border-t border-line pt-3 text-[12px]">
                  <div className="flex justify-between"><dt className="text-faint">Creator</dt><dd><a className="num hover:text-accent" href={explorer.address(m.creator)} target="_blank" rel="noreferrer">{shortAddress(m.creator)}</a></dd></div>
                  <div className="flex justify-between"><dt className="text-faint">Launch tx</dt><dd><a className="num hover:text-accent" href={explorer.tx(m.tx_hash)} target="_blank" rel="noreferrer">{shortAddress(m.tx_hash)}</a></dd></div>
                  <div className="flex justify-between"><dt className="text-faint">Metadata</dt><dd><a className="hover:text-accent" href={m.metadata_uri} target="_blank" rel="noreferrer">JSON</a></dd></div>
                </dl>
              </>
            ) : (
              <p className="text-muted">No PROJECT X launch record for this token.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Trade" title="Buy and sell" action={<Badge>Not built yet</Badge>} />
        <p className="px-5 py-5 text-[13px] text-muted">Curve buy/sell and post-graduation Uniswap trading are the next module to be wired.</p>
      </Card>
    </div>
  );
}
