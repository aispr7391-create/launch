import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { robinhoodChain } from "@/config/chains";
import { FAQS } from "@/content/site";
import { InfoBlock, InfoPage, Prose } from "@/components/info/InfoPage";
import { FaqList } from "@/components/info/FaqList";
import { NetworkCard } from "@/components/info/Blocks";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Documentation", description: `User guides, FAQ and integration details for ${BRAND.name}.` };

const GUIDES = [
  { id: "wallet", title: "Connect a wallet", body: "Tap Connect wallet and choose a detected browser wallet. On mobile, open SYNORA inside your wallet app's browser (MetaMask, Coinbase Wallet or Trust Wallet links are offered). If your wallet is on another network, a banner lets you switch to Robinhood Chain." },
  { id: "swap", title: "Make a swap", body: "Go to Trade, select both tokens, enter an amount and review rate, price impact, minimum received, route and estimated gas. Token inputs need an exact-amount approval first. Sign, then follow the status until it is confirmed." },
  { id: "liquidity", title: "Add and manage liquidity", body: "Go to Pools → Add, choose a pair and fee tier, then full range or a custom range. After signing, the position appears under Pools → Positions, where you can add, remove or collect fees." },
  { id: "launch", title: "Launch a token (coming)", body: "The Launch page walks through details, socials, configuration, preview and launch. Launching stays disabled until the audited launchpad is deployed; the form lists exactly what is missing." },
  { id: "status", title: "Read the status labels", body: "Live means it works end to end. Partial works for what its page describes. Not built is planned and does nothing yet. The Status page re-checks every contract address on-chain." },
];

const API = [
  { path: "GET /api/market", body: "Indexed Uniswap v3 totals (pools, 24h swaps, 24h volume in ETH, WETH locked), trending and newest pools, and sync status." },
  { path: "GET /api/pools", body: "Indexed Uniswap v3 pools. Query: q (symbol or address), token, fee, sort = weth_reserve | volume_eth_24h | created." },
  { path: "GET /api/tokens", body: "Recently launched tokens with a verified launch record (empty until the launchpad is deployed)." },
];

export default function DocsPage() {
  const contracts = Object.values(CONTRACTS);
  return (
    <InfoPage
      current="/docs"
      eyebrow="Documentation"
      title="Everything you need to use and integrate SYNORA."
      lead="Step-by-step guides for users, network details for wallets, and the contract addresses and endpoints for builders."
    >
      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {[["guides", "User guide"], ["network", "Network"], ["contracts", "Contracts"], ["api", "API"], ["faq", "FAQ"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-muted transition hover:border-accent/50 hover:text-fg">
            {l}
          </a>
        ))}
      </nav>

      <InfoBlock id="guides" title="User guide">
        <div className="grid gap-3 md:grid-cols-2">
          {GUIDES.map((g, i) => (
            <div key={g.id} id={g.id} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-5">
              <p className="num mb-2 text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="font-semibold tracking-tight">{g.title}</h3>
              <p className="mt-1.5 text-[13px] leading-6 text-muted">{g.body}</p>
            </div>
          ))}
        </div>
      </InfoBlock>

      <InfoBlock id="network" title="Network details">
        <NetworkCard />
        <p className="mt-3 text-[12px] text-faint">
          Source: Robinhood Chain documentation. {BRAND.name} supports chain ID <span className="num">{robinhoodChain.id}</span> only.
        </p>
      </InfoBlock>

      <InfoBlock id="contracts" title="Contract addresses">
        <Prose>
          <p>Every address below comes from an official source and is re-checked on-chain on the <Link href="/network" className="text-accent hover:text-accent-hover">Status page</Link>. {BRAND.name}&apos;s own contracts are listed as not deployed.</p>
        </Prose>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Contract</th>
                <th className="px-5 py-3 font-medium">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {contracts.map((c) => (
                <tr key={c.label}>
                  <td className="px-5 py-3 text-fg">{c.label}</td>
                  <td className="px-5 py-3">
                    {c.address ? (
                      <a href={`${robinhoodChain.blockExplorers?.default.url}/address/${c.address}`} target="_blank" rel="noreferrer" className="num inline-flex items-center gap-1 break-all text-muted hover:text-accent">
                        {c.address} <Icon name="external" size={11} />
                      </a>
                    ) : (
                      <span className="text-faint">Not deployed — audit required first</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoBlock>

      <InfoBlock id="api" title="Public API">
        <div className="space-y-2.5">
          {API.map((a) => (
            <div key={a.path} className="rounded-xl border border-line bg-surface px-5 py-4">
              <p className="num text-[13px] text-accent">{a.path}</p>
              <p className="mt-1 text-[13px] leading-6 text-muted">{a.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-faint">These endpoints serve the app itself and may change without notice. All data originates from Robinhood Chain.</p>
      </InfoBlock>

      <InfoBlock id="faq" title="FAQ">
        <FaqList items={FAQS.slice(0, 6)} />
        <Link href="/faq" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover">
          All questions <Icon name="arrow" size={13} />
        </Link>
      </InfoBlock>
    </InfoPage>
  );
}
