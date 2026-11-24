import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { InfoBlock, InfoPage, Prose } from "@/components/info/InfoPage";
import { WhyGrid } from "@/components/info/Blocks";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "About", description: `What ${BRAND.name} is, its vision, mission and goals.` };

const PILLARS = [
  { title: "Vision", icon: "globe" as const, body: "A complete, trustworthy DeFi home for Robinhood Chain — where anyone can launch, trade and provide liquidity without guessing what is real." },
  { title: "Mission", icon: "bolt" as const, body: "Ship each product only when it works end to end on mainnet, built on verified contracts, with every number traceable to the chain." },
  { title: "Approach", icon: "shield" as const, body: "Non-custodial by default, audit before deployment, and clear labels on anything that is still in progress." },
];

const GOALS = [
  "Make token launches fair and predictable with a transparent bonding curve and automatic graduation to Uniswap v3.",
  "Give traders reliable quotes, clear price impact and safe approvals on Robinhood Chain.",
  "Help liquidity providers manage Uniswap v3 positions with accurate, on-chain data.",
  "Publish statistics only from indexed on-chain events — no estimates presented as facts.",
  "Have SYNORA's own contracts externally audited before any of them reaches mainnet.",
];

export default function AboutPage() {
  return (
    <InfoPage
      current="/about"
      eyebrow={`About ${BRAND.name}`}
      title="One place to launch, trade and provide liquidity on Robinhood Chain."
      lead={`${BRAND.name} is a DeFi platform built exclusively for Robinhood Chain Mainnet. It brings token launches, trading and liquidity together in a single interface — and only shows what actually exists on-chain.`}
    >
      <InfoBlock title="What SYNORA is">
        <Prose>
          <p>
            The name comes from <strong>synergy</strong>: separate tools working as one. Launching a token, trading it and providing
            liquidity for it are usually spread across different apps. {BRAND.name} connects them, so a token can go from its first block
            on a bonding curve to a Uniswap v3 pool without leaving the platform.
          </p>
          <p>
            Trading and liquidity run on Uniswap&apos;s official deployments on Robinhood Chain. {BRAND.name}&apos;s own launchpad
            contracts are written and tested, and will be deployed only after an external audit. Until then, the parts that depend on them
            are clearly marked as not available.
          </p>
        </Prose>
      </InfoBlock>

      <div className="grid gap-3 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-line bg-surface p-6">
            <Icon name={p.icon} size={20} className="mb-3 text-accent" />
            <h3 className="font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-muted">{p.body}</p>
          </div>
        ))}
      </div>

      <InfoBlock title="Goals">
        <ol className="max-w-3xl space-y-3">
          {GOALS.map((g, i) => (
            <li key={g} className="flex gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 text-[14px] leading-6 text-muted">
              <span className="num mt-0.5 text-[12px] text-accent">{String(i + 1).padStart(2, "0")}</span>
              {g}
            </li>
          ))}
        </ol>
      </InfoBlock>

      <InfoBlock title={`Why ${BRAND.name}`}>
        <WhyGrid />
      </InfoBlock>

      <p className="text-[13px] text-faint">
        Want the details? Read <Link href="/how-it-works" className="text-accent hover:text-accent-hover">how it works</Link> or check the{" "}
        <Link href="/roadmap" className="text-accent hover:text-accent-hover">roadmap</Link>.
      </p>
    </InfoPage>
  );
}
