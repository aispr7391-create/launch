"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress, isAddressEqual, parseAbi, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { CONTRACTS, type ContractKey } from "@/config/contracts";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { explorer } from "@/lib/explorer";
import { shortAddress } from "@/lib/format";

const peripheryAbi = parseAbi(["function WETH9() view returns (address)", "function factory() view returns (address)"]);
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

type CheckResult = { ok: boolean; detail: string };
type Row = { key: ContractKey; label: string; address: Address | null; code: CheckResult; cross: CheckResult[] };

/**
 * Re-verifies every registry address against live Robinhood Chain Mainnet state:
 * code exists, and periphery contracts point at the same WETH and factory we use.
 */
export function OnchainChecks() {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });

  const q = useQuery({
    queryKey: ["onchain-checks", ACTIVE_CHAIN.id],
    enabled: Boolean(client),
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const c = client!;
      const weth = CONTRACTS.weth.address!;
      const factory = CONTRACTS.uniswapV3Factory.address!;

      const crossFor = async (key: ContractKey, address: Address): Promise<CheckResult[]> => {
        if (key === "weth" || key === "usdg") {
          const [symbol, decimals] = await Promise.all([
            c.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
            c.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
          ]);
          const ok = key === "weth" ? symbol === "WETH" && decimals === 18 : symbol === "USDG";
          return [{ ok, detail: `symbol ${symbol}, decimals ${decimals}` }];
        }
        if (key === "uniswapV3PositionManager" || key === "uniswapV3SwapRouter02" || key === "uniswapV3QuoterV2") {
          const [w, f] = await Promise.all([
            c.readContract({ address, abi: peripheryAbi, functionName: "WETH9" }),
            c.readContract({ address, abi: peripheryAbi, functionName: "factory" }),
          ]);
          return [
            { ok: isAddressEqual(w, weth), detail: `WETH9() ${isAddressEqual(w, weth) ? "matches" : `= ${shortAddress(w)}`}` },
            { ok: isAddressEqual(f, factory), detail: `factory() ${isAddressEqual(f, factory) ? "matches" : `= ${shortAddress(f)}`}` },
          ];
        }
        return [];
      };

      const entries = Object.entries(CONTRACTS) as [ContractKey, (typeof CONTRACTS)[ContractKey]][];
      return Promise.all(
        entries.map(async ([key, e]) => {
          if (!e.address) {
            return { key, label: e.label, address: null, code: { ok: false, detail: "Not deployed" }, cross: [] };
          }
          const address = getAddress(e.address);
          try {
            const code = await c.getCode({ address });
            const hasCode = Boolean(code && code !== "0x");
            const cross = hasCode ? await crossFor(key, address).catch((err) => [{ ok: false, detail: String(err?.shortMessage ?? err) }]) : [];
            return { key, label: e.label, address, code: { ok: hasCode, detail: hasCode ? "Contract code found" : "No code at address" }, cross };
          } catch {
            return { key, label: e.label, address, code: { ok: false, detail: "RPC error" }, cross: [] };
          }
        }),
      );
    },
  });

  const rows: Array<Omit<Row, "code"> & { code: CheckResult | null }> =
    q.data ??
    (Object.entries(CONTRACTS) as [ContractKey, (typeof CONTRACTS)[ContractKey]][]).map(([key, e]) => ({
      key,
      label: e.label,
      address: e.address,
      code: null,
      cross: [],
    }));
  const deployed = q.data?.filter((r) => r.address) ?? [];
  const passing = deployed.filter((r) => r.code.ok && r.cross.every((x) => x.ok)).length;

  return (
    <Card>
      <CardHeader
        eyebrow="On-chain verification"
        title="Integrated contracts"
        action={
          q.isLoading ? (
            <Badge>Checking…</Badge>
          ) : q.isError ? (
            <Badge tone="down">RPC error</Badge>
          ) : (
            <Badge tone={passing === deployed.length ? "up" : "warn"}>
              {passing}/{deployed.length} passing
            </Badge>
          )
        }
      />
      <ul className="divide-y divide-divider">
        {rows.map(
          (r) => (
            <li key={r.key} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm">{r.label}</p>
                {r.address ? (
                  <a href={explorer.address(r.address)} target="_blank" rel="noreferrer" className="num inline-flex items-center gap-1 text-[12px] text-faint hover:text-accent">
                    {shortAddress(r.address, 6)} <Icon name="external" size={12} />
                  </a>
                ) : (
                  <p className="text-[12px] text-faint">{CONTRACTS[r.key].source}</p>
                )}
                {CONTRACTS[r.key].note && <p className="mt-0.5 text-[12px] text-faint">{CONTRACTS[r.key].note}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {!r.code ? (
                  <Skeleton className="w-24" />
                ) : !r.address ? (
                  <Badge>Not deployed</Badge>
                ) : (
                  <>
                    <Badge tone={r.code.ok ? "up" : "down"}>{r.code.detail}</Badge>
                    {r.cross.map((x) => (
                      <Badge key={x.detail} tone={x.ok ? "up" : "down"}>{x.detail}</Badge>
                    ))}
                  </>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}
