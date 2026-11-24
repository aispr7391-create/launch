import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { InfoBlock, InfoPage } from "@/components/info/InfoPage";
import { HowItWorksSteps } from "@/components/info/Blocks";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "How it works", description: `A guide to every ${BRAND.name} feature.` };

const FLOWS = [
  {
    title: "Swapping tokens",
    icon: "trade" as const,
    href: "/trade",
    steps: [
      "Open Trade and choose what you pay and what you receive. ETH, WETH and any ERC-20 on Robinhood Chain can be selected or imported by address.",
      "SYNORA asks Uniswap's QuoterV2 for a live quote across the available fee tiers and shows the rate, price impact, minimum received and route.",
      "Set your slippage. If you pay with a token, approve exactly the amount you are swapping.",
      "The swap is simulated and gas-estimated, then you sign in your wallet. The transaction is tracked until it is confirmed.",
    ],
  },
  {
    title: "Providing liquidity",
    icon: "pools" as const,
    href: "/pools/add",
    steps: [
      "Open Pools → Add liquidity and pick a token pair and fee tier. SYNORA reads the pool directly from the Uniswap v3 factory.",
      "Choose full range or a custom price range, then enter one amount — the other side is calculated from the pool price.",
      "Approve the tokens if needed and sign. You receive a Uniswap v3 position NFT.",
      "Manage the position later: add more, remove liquidity or collect earned fees.",
    ],
  },
  {
    title: "Launching a token",
    icon: "launch" as const,
    href: "/launch",
    steps: [
      "Fill in the five-step form: details and logo, social links, configuration, preview and launch.",
      "Your logo and metadata are stored and linked to the token on-chain at creation.",
      "The token trades on a bonding curve. Its price rises as people buy, following a fixed formula.",
      "When the curve sells out, liquidity graduates automatically to a Uniswap v3 pool and is locked permanently.",
    ],
    note: "Not available yet: the launchpad contracts will be deployed only after an external audit. The form already shows exactly what is missing.",
  },
  {
    title: "Following your activity",
    icon: "portfolio" as const,
    href: "/portfolio",
    steps: [
      "Portfolio shows your live ETH balance and the Uniswap v3 positions held by your wallet.",
      "Transactions sent through SYNORA are listed with their status and a link to the Blockscout explorer.",
      "Market activity and Analytics show pool statistics from the indexer, in ETH.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <InfoPage
      current="/how-it-works"
      eyebrow="How it works"
      title="From your first connection to your first trade."
      lead={`${BRAND.name} is designed so you always know what you are signing. Here is how each part works, step by step.`}
    >
      <InfoBlock title="Getting started">
        <HowItWorksSteps />
      </InfoBlock>

      {FLOWS.map((f) => (
        <InfoBlock key={f.title} title={f.title}>
          <div className="rounded-2xl border border-line bg-surface">
            <ol className="divide-y divide-divider">
              {f.steps.map((s, i) => (
                <li key={s} className="flex gap-4 px-5 py-4 text-[14px] leading-6 text-muted">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-[12px] text-accent">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              {f.note ? <p className="text-[12px] leading-5 text-warn">{f.note}</p> : <span />}
              <Link href={f.href} className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover">
                <Icon name={f.icon} size={14} /> Open <Icon name="arrow" size={13} />
              </Link>
            </div>
          </div>
        </InfoBlock>
      ))}
    </InfoPage>
  );
}
