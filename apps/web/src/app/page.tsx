import Link from "next/link";
import { BRAND } from "@/config/brand";
import { MODULES, type ModuleKey } from "@/config/modules";
import { Card, StatusBadge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { WalletSummary } from "@/components/portfolio/WalletSummary";
import { ActivityList } from "@/components/portfolio/ActivityList";
import { MarketActivity } from "@/features/market/MarketActivity";
import { LogoMark } from "@/components/ui/Logo";
import { Section, SectionHeading } from "@/components/info/Section";
import { EcosystemGrid, HowItWorksSteps, NetworkCard, RoadmapTimeline, WhyGrid } from "@/components/info/Blocks";
import { FaqList } from "@/components/info/FaqList";
import { FAQS } from "@/content/site";

const QUICK_ACTIONS: { label: string; href: string; icon: ModuleKey }[] = [
  { label: "Launch token", href: "/launch", icon: "launch" },
  { label: "Swap", href: "/trade", icon: "trade" },
  { label: "Add liquidity", href: "/pools", icon: "pools" },
];

export default function OverviewPage() {
  const modules = MODULES.filter((m) => m.group !== "system" && m.key !== "overview");

  return (
    <div className="animate-rise space-y-12">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-9 sm:px-10 sm:py-12" aria-label="Introduction">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-accent/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent-2/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-8">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-canvas/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              <span className="size-1.5 rounded-full bg-up" /> Robinhood Chain · Mainnet
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.08]">
              The DeFi hub for{" "}
              <span style={{ backgroundImage: "linear-gradient(90deg, var(--color-accent-2), var(--color-accent))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Robinhood Chain
              </span>
              .
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted">{BRAND.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/trade" className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white transition hover:bg-accent-hover active:bg-accent-active">
                Start trading <Icon name="arrow" size={15} />
              </Link>
              <Link href="/how-it-works" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-raised px-5 text-sm font-medium transition hover:border-faint">
                How it works
              </Link>
            </div>
          </div>
          <div className="hidden shrink-0 lg:block" aria-hidden>
            <LogoMark size={190} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3" aria-label="Quick actions">
        {QUICK_ACTIONS.map((a) => {
          const status = MODULES.find((m) => m.href === a.href)?.status;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-1.5 py-3.5 text-center transition hover:border-accent/50 sm:flex-row sm:gap-3 sm:px-4 sm:text-left"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={a.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium sm:text-sm">{a.label}</span>
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

      <Section id="about">
        <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SectionHeading eyebrow={`About ${BRAND.name}`} title="Launch, trade and provide liquidity — in one place." />
            <p className="text-[15px] leading-7 text-muted">
              {BRAND.name} brings the tools of a token&apos;s life together on Robinhood Chain: a bonding-curve launchpad that graduates
              to Uniswap v3, swaps through Uniswap&apos;s official contracts, and liquidity management — with every number read from
              the chain.
            </p>
            <Link href="/about" className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover">
              Read more about {BRAND.name} <Icon name="arrow" size={13} />
            </Link>
          </div>
          <ul className="grid gap-2.5 self-center lg:col-span-2">
            {["Built for Robinhood Chain Mainnet only", "Non-custodial — your keys stay in your wallet", "Verified contracts, honest product status"].map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/50 px-4 py-3 text-[13px] text-muted">
                <Icon name="check" size={15} className="shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="ecosystem">
        <SectionHeading
          eyebrow="Ecosystem"
          title="Everything a token needs, connected."
          lead="Each product carries its real status: Live, Partial or Not built."
          link={{ href: "/ecosystem", label: "Explore the ecosystem" }}
        />
        <EcosystemGrid />
      </Section>

      <Section id="how-it-works">
        <SectionHeading eyebrow="How it works" title="Four steps to your first trade." link={{ href: "/how-it-works", label: "Full guide" }} />
        <HowItWorksSteps />
      </Section>

      <Section id="why">
        <SectionHeading eyebrow={`Why ${BRAND.name}`} title="Built to be trusted, not just used." />
        <WhyGrid />
      </Section>

      <Section id="network">
        <SectionHeading eyebrow="Supported network" title="Robinhood Chain Mainnet." link={{ href: "/docs#network", label: "Network details" }} />
        <NetworkCard />
      </Section>

      <Section id="roadmap">
        <SectionHeading eyebrow="Roadmap" title="Where we are, and what comes next." link={{ href: "/roadmap", label: "Full roadmap" }} />
        <RoadmapTimeline compact />
      </Section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Module status</h2>
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

      <Section id="faq">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." link={{ href: "/faq", label: "All questions" }} />
        <FaqList items={FAQS.slice(0, 5)} />
      </Section>
    </div>
  );
}
