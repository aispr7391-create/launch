import Link from "next/link";
import { getModule } from "@/config/modules";
import { robinhoodChain } from "@/config/chains";
import { ECOSYSTEM, HOW_IT_WORKS, ROADMAP, WHY, type EcosystemItem } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { ModuleStatusPill, PhasePill } from "./StatusPill";
import { Reveal } from "./Reveal";

export function ecosystemStatus(item: EcosystemItem) {
  return item.module ? getModule(item.module).status : (item.status ?? "planned");
}

/** Compact cards: icon, status, title, summary. */
export function EcosystemGrid({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className={detailed ? "grid gap-4 md:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
      {ECOSYSTEM.map((item, i) => {
        const status = ecosystemStatus(item);
        const card = (
          <div className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40">
            <div className="mb-4 flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl border border-line bg-raised text-accent transition group-hover:border-accent/40">
                <Icon name={item.icon} size={18} />
              </span>
              <ModuleStatusPill status={status} />
            </div>
            <h3 className="font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-muted">{item.summary}</p>
            {detailed && (
              <>
                <ul className="mt-4 space-y-2 text-[13px] leading-5 text-muted">
                  {item.details.map((d) => (
                    <li key={d} className="flex gap-2.5">
                      <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 rounded-xl border border-line bg-canvas/60 px-3.5 py-3 text-[12px] leading-5 text-faint">{item.availability}</p>
              </>
            )}
            {item.href && (
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[12px] text-faint transition group-hover:text-accent">
                Open {item.title} <Icon name="arrow" size={12} />
              </span>
            )}
          </div>
        );
        return (
          <Reveal key={item.title} delay={i * 60}>
            {item.href ? <Link href={item.href} className="block h-full">{card}</Link> : card}
          </Reveal>
        );
      })}
    </div>
  );
}

export function HowItWorksSteps() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {HOW_IT_WORKS.map((s, i) => (
        <li key={s.title}>
          <Reveal delay={i * 70} className="h-full">
            <div className="relative h-full rounded-2xl border border-line bg-surface p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="num grid size-8 place-items-center rounded-lg bg-accent-soft text-[13px] text-accent">{i + 1}</span>
                <Icon name={s.icon} size={18} className="text-faint" />
              </div>
              <h3 className="font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">{s.body}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

export function WhyGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {WHY.map((w) => (
        <div key={w.title} className="bg-surface p-5 transition hover:bg-raised">
          <Icon name={w.icon} size={20} className="mb-3 text-accent" />
          <h3 className="font-semibold tracking-tight">{w.title}</h3>
          <p className="mt-1.5 text-[13px] leading-5 text-muted">{w.body}</p>
        </div>
      ))}
    </div>
  );
}

export function NetworkCard() {
  const c = robinhoodChain;
  const rows: [string, React.ReactNode][] = [
    ["Network", c.name + " Mainnet"],
    ["Chain ID", <span key="id" className="num">{c.id}</span>],
    ["Gas token", c.nativeCurrency.symbol],
    ["Public RPC", <span key="rpc" className="num break-all">{c.rpcUrls.default.http[0]}</span>],
    [
      "Explorer",
      <a key="ex" href={c.blockExplorers?.default.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:text-accent-hover">
        {c.blockExplorers?.default.name} <Icon name="external" size={12} />
      </a>,
    ],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 lg:col-span-2">
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-accent/10 blur-3xl" />
        <span className="grid size-11 place-items-center rounded-xl border border-line bg-raised text-accent">
          <Icon name="globe" size={20} />
        </span>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">{c.name}</h3>
        <p className="mt-1.5 text-[13px] leading-5 text-muted">
          An Arbitrum Orbit (Nitro) Layer 2 that settles to Ethereum. SYNORA runs on its mainnet only, so there is no network to pick and
          nothing to misconfigure.
        </p>
        <Link href="/network" className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover">
          Live network status <Icon name="arrow" size={13} />
        </Link>
      </div>
      <dl className="divide-y divide-divider rounded-2xl border border-line bg-surface lg:col-span-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5 text-[13px]">
            <dt className="text-faint">{k}</dt>
            <dd className="text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function RoadmapTimeline({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "relative space-y-4 border-l border-line pl-6 sm:pl-8"}>
      {ROADMAP.map((p, i) => (
        <li key={p.phase} className={compact ? undefined : "relative"}>
          {!compact && (
            <span
              aria-hidden
              className={
                "absolute -left-[31px] top-6 size-3 rounded-full border-2 sm:-left-[39px] " +
                (p.state === "done" ? "border-up bg-up" : p.state === "in-progress" ? "border-accent bg-accent" : "border-line-strong bg-canvas")
              }
            />
          )}
          <Reveal delay={compact ? i * 50 : 0} className="h-full">
            <div className="h-full rounded-2xl border border-line bg-surface p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="num text-[11px] uppercase tracking-[0.14em] text-faint">{p.phase}</span>
                <PhasePill state={p.state} />
              </div>
              <h3 className="font-semibold tracking-tight">{p.title}</h3>
              <ul className="mt-3 space-y-1.5 text-[13px] leading-5 text-muted">
                {(compact ? p.items.slice(0, 2) : p.items).map((it) => (
                  <li key={it} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
