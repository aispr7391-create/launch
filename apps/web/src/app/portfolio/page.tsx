import type { Metadata } from "next";
import { getModule } from "@/config/modules";
import { Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { WalletSummary } from "@/components/portfolio/WalletSummary";
import { ActivityList } from "@/components/portfolio/ActivityList";

export const metadata: Metadata = { title: "Portfolio" };

const PENDING_SECTIONS = [
  { title: "Token holdings", note: "Needs the market-data indexer or a token-balance API (Phase 6)." },
  { title: "Liquidity positions", note: "Ships with Pools (Phase 4)." },
  { title: "Staking positions & pending rewards", note: "Ships with Stake (Phase 5)." },
  { title: "Total portfolio value", note: "Requires verified price data. No value is shown until prices are real." },
];

export default function PortfolioPage() {
  const m = getModule("portfolio");
  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="Portfolio" description={m.summary} action={<StatusBadge status={m.status} />} />

      <div className="grid gap-4 lg:grid-cols-2">
        <WalletSummary />
        <ActivityList />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PENDING_SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardHeader title={s.title} action={<StatusBadge status="planned" />} />
            <p className="px-5 py-4 text-[13px] text-muted">{s.note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
