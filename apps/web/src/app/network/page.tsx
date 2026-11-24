import type { Metadata } from "next";
import { INTEGRATIONS, type IntegrationState } from "@/config/integrations";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { OnchainChecks } from "@/components/network/OnchainChecks";

export const metadata: Metadata = { title: "Status" };

const stateBadge: Record<IntegrationState, React.ReactNode> = {
  verified: <Badge tone="up">Verified</Badge>,
  available: <Badge tone="info">Available · not wired</Badge>,
  unconfirmed: <Badge tone="accent">Unconfirmed</Badge>,
  missing: <Badge tone="down">Missing</Badge>,
};

export default function NetworkPage() {
  const rows: [string, React.ReactNode][] = [
    ["Network", ACTIVE_CHAIN.name],
    ["Chain ID", <span key="id" className="num">{ACTIVE_CHAIN.id} (0x{ACTIVE_CHAIN.id.toString(16)})</span>],
    ["Native currency", `${ACTIVE_CHAIN.nativeCurrency.name} (${ACTIVE_CHAIN.nativeCurrency.symbol}, ${ACTIVE_CHAIN.nativeCurrency.decimals} decimals)`],
    ["Public RPC", <span key="rpc" className="num break-all">{ACTIVE_CHAIN.rpcUrls.default.http[0]}</span>],
    ["Explorer", <span key="ex" className="num break-all">{ACTIVE_CHAIN.blockExplorers?.default.url}</span>],
  ];

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="Status"
        description="Robinhood Chain Mainnet configuration, live RPC health, and on-chain verification of every integrated contract."
      />

      <Card>
        <CardHeader eyebrow="Configuration" title="Active network" />
        <dl className="divide-y divide-divider">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-3">
              <dt className="text-muted">{k}</dt>
              <dd className="sm:col-span-2">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <OnchainChecks />

      <Card>
        <CardHeader eyebrow="Integrations" title="What is real today" />
        <ul className="divide-y divide-divider">
          {INTEGRATIONS.map((i) => (
            <li key={i.name} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{i.name}</p>
                <p className="mt-0.5 text-[13px] text-muted">{i.note}</p>
                {i.source && (
                  <a href={i.source} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[12px] text-faint hover:text-accent">
                    {i.source}
                  </a>
                )}
              </div>
              <div className="shrink-0">{stateBadge[i.state]}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
