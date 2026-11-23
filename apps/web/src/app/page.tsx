import Link from "next/link";
import { BRAND } from "@/config/brand";
import { MODULES, type ModuleKey } from "@/config/modules";
import { Card, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { WalletSummary } from "@/components/portfolio/WalletSummary";
import { ActivityList } from "@/components/portfolio/ActivityList";
import { MarketActivity } from "@/features/market/MarketActivity";

const QUICK_ACTIONS: { label: string; href: string; icon: ModuleKey }[] = [
  { label: "Launch token", href: "/launch", icon: "launch" },
  { label: "Swap", href: "/trade", icon: "trade" },
  { label: "Add liquidity", href: "/pools", icon: "pools" },
];

export default function OverviewPage() {
  const modules = MODULES.filter((m) => m.group !== "system" && m.key !== "overview");

  return (
    <div className="animate-rise space-y-8">
      <PageHeader title="Overview" description={BRAND.tagline} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Quick actions">
        {QUICK_ACTIONS.map((a) => {
          const status = MODULES.find((m) => m.href === a.href)?.status;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/50"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={a.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{a.label}</span>
                <span className="block text-[11px] text-faint">{status === "planned" ? "Not available yet" : "Open"}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MarketActivity />
        <WalletSummary />
      </section>

      <ActivityList />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Modules</h2>
          <Link href="/network" className="text-[12px] text-faint hover:text-fg">Integration status →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <Link key={m.key} href={m.href} className="group">
              <Card className="flex h-full flex-col p-5 transition group-hover:border-line-strong">
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-lg border border-line bg-raised text-muted group-hover:text-accent">
                    <Icon name={m.key} size={18} />
                  </span>
                  <StatusBadge status={m.status} />
                </div>
                <h3 className="font-medium">{m.label}</h3>
                <p className="mt-1 flex-1 text-[13px] leading-5 text-muted">{m.summary}</p>
                <p className="num mt-4 text-[11px] text-faint">STAGE {m.stage}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
