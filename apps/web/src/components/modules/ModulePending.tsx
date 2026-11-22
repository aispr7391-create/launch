import Link from "next/link";
import { getModule, type ModuleKey } from "@/config/modules";
import { Badge, Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui/primitives";

/**
 * Screen for a module that has not been built yet. States plainly what is
 * missing instead of showing mock data.
 */
export function ModulePending({ moduleKey }: { moduleKey: ModuleKey }) {
  const m = getModule(moduleKey);

  return (
    <div className="animate-rise">
      <PageHeader title={m.label} description={m.summary} action={<StatusBadge status={m.status} />} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader eyebrow={`Stage ${m.stage}`} title="What this module will do" />
          <ul className="divide-y divide-line">
            {m.features.map((f) => (
              <li key={f} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="size-1.5 rounded-full bg-line-strong" />
                {f}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Blocked on" title="Required integrations" />
          <ul className="space-y-3 p-5">
            {m.dependencies.map((d) => (
              <li key={d} className="text-[13px] leading-5 text-muted">{d}</li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <Link href="/network" className="text-[13px] text-accent hover:underline">
              Full integration status →
            </Link>
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-2 text-[13px] text-faint">
        <Badge>No simulated data</Badge>
        This screen will show live on-chain data once the module ships. Nothing here is mocked.
      </p>
    </div>
  );
}
