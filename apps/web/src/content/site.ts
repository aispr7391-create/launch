import type { IconName } from "@/components/ui/Icon";
import type { ModuleKey, ModuleStatus } from "@/config/modules";

/**
 * Copy for the information pages and the homepage sections.
 *
 * Rule: nothing here may describe a feature as working unless the app actually ships it.
 * Feature status is taken from config/modules.ts wherever a module exists, so the copy and
 * the product cannot drift apart.
 */

export interface LearnPage {
  href: string;
  label: string;
  icon: IconName;
  summary: string;
}

export const LEARN_PAGES: LearnPage[] = [
  { href: "/about", label: "About", icon: "info", summary: "What SYNORA is, and why it exists." },
  { href: "/how-it-works", label: "How it works", icon: "steps", summary: "From connecting a wallet to your first swap." },
  { href: "/ecosystem", label: "Ecosystem", icon: "layers", summary: "Every product and where it stands today." },
  { href: "/docs", label: "Documentation", icon: "book", summary: "User guides, network details and integration info." },
  { href: "/security", label: "Security", icon: "shield", summary: "Contracts, audit status and how we handle risk." },
  { href: "/roadmap", label: "Roadmap", icon: "map", summary: "What is done, in progress and planned." },
  { href: "/faq", label: "FAQ", icon: "help", summary: "Answers to common questions." },
  { href: "/contact", label: "Contact", icon: "mail", summary: "Community and official channels." },
];

export interface EcosystemItem {
  title: string;
  icon: IconName;
  /** Linked module; its status in config/modules.ts is the one shown. */
  module: ModuleKey | null;
  /** Only for items without a module (e.g. Staking). */
  status?: ModuleStatus;
  href: string | null;
  summary: string;
  details: string[];
  availability: string;
}

export const ECOSYSTEM: EcosystemItem[] = [
  {
    title: "Launchpad",
    icon: "launch",
    module: "launch",
    href: "/launch",
    summary: "Create a token on a bonding curve that graduates to Uniswap v3 automatically.",
    details: [
      "Five-step launch form with a live preview of your token page",
      "Price follows a constant-product bonding curve until the target raise",
      "On graduation, liquidity moves to a Uniswap v3 pool and is locked permanently",
      "Creator fees are tracked on-chain and claimable by the creator",
    ],
    availability:
      "The launch form is built, but the launchpad contracts are not deployed yet. They will only go live after an external audit, so launching is disabled until then.",
  },
  {
    title: "Trading",
    icon: "trade",
    module: "trade",
    href: "/trade",
    summary: "Swap ETH and tokens through the official Uniswap v3 contracts on Robinhood Chain.",
    details: [
      "Live quotes from Uniswap's QuoterV2, with price impact and minimum received",
      "Every swap is simulated and gas-estimated before you sign",
      "Exact-amount token approvals by default",
      "Slippage control and transaction tracking until confirmation",
    ],
    availability: "Swaps through Uniswap v3 are available. Uniswap v4 routing is not supported yet.",
  },
  {
    title: "Liquidity",
    icon: "pools",
    module: "pools",
    href: "/pools",
    summary: "Provide liquidity to Uniswap v3 pools and manage your positions.",
    details: [
      "Create positions with full-range or custom price ranges",
      "Increase, decrease and collect fees from existing positions",
      "Positions are read directly from your Uniswap v3 NFTs",
      "Pool lookup reads straight from the Uniswap v3 factory",
    ],
    availability: "Adding and managing Uniswap v3 positions is available. Pool-wide listings depend on the market-data indexer.",
  },
  {
    title: "Staking",
    icon: "stake",
    module: null,
    status: "planned",
    href: null,
    summary: "Stake tokens in reward pools with flexible or fixed-term locks.",
    details: [
      "One contract hosting many reward pools",
      "Rewards stream linearly and are calculated by the contract",
      "APR shown only when it can be computed from verified prices",
    ],
    availability: "Staking is not part of the current release. It will return only after its contract has been audited and deployed.",
  },
  {
    title: "Portfolio",
    icon: "portfolio",
    module: "portfolio",
    href: "/portfolio",
    summary: "Your balances, liquidity positions and transaction history in one place.",
    details: [
      "Live ETH balance from Robinhood Chain",
      "Uniswap v3 liquidity positions held by your wallet",
      "History of transactions made through SYNORA in this browser",
    ],
    availability: "ETH balance and positions are available. Full token holdings need the indexer to cover token transfers.",
  },
  {
    title: "Analytics",
    icon: "analytics",
    module: "analytics",
    href: "/analytics",
    summary: "Market statistics where every number can be traced back to on-chain events.",
    details: [
      "Pools, 24h swaps, 24h volume and WETH locked across Uniswap v3",
      "Top pools by 24-hour volume",
      "Figures in ETH; no USD price is shown until a verified oracle is integrated",
    ],
    availability: "Uniswap v3 market statistics are available once the indexer has synced. Launchpad statistics arrive with the launchpad.",
  },
];

export const HOW_IT_WORKS = [
  {
    title: "Connect your wallet",
    icon: "wallet" as IconName,
    body: "Use any EVM browser wallet. SYNORA detects installed wallets automatically and asks to switch to Robinhood Chain Mainnet if needed. We never ask for a seed phrase or private key.",
  },
  {
    title: "Fund it with ETH",
    icon: "bolt" as IconName,
    body: "Gas on Robinhood Chain is paid in ETH. Bridge or transfer ETH to your wallet on Robinhood Chain before you trade.",
  },
  {
    title: "Swap or provide liquidity",
    icon: "trade" as IconName,
    body: "Pick a token pair, review the live quote, price impact and minimum received, then sign. Or open a Uniswap v3 position and earn a share of trading fees.",
  },
  {
    title: "Track everything on-chain",
    icon: "eye" as IconName,
    body: "Each transaction is followed until it is confirmed and links to the Blockscout explorer. Your positions and history live in Portfolio.",
  },
];

export const WHY = [
  {
    title: "Native to Robinhood Chain",
    icon: "globe" as IconName,
    body: "Built for Robinhood Chain Mainnet only. No network selector, no wrong-chain mistakes.",
  },
  {
    title: "Non-custodial by design",
    icon: "lock" as IconName,
    body: "Your keys stay in your wallet. SYNORA never holds funds and never asks for a seed phrase.",
  },
  {
    title: "Verified contracts only",
    icon: "shield" as IconName,
    body: "Every address comes from an official source and is re-checked on-chain on the Status page.",
  },
  {
    title: "No placeholder numbers",
    icon: "eye" as IconName,
    body: "Prices, volume and balances come from the chain or our indexer. If data is missing, we say so.",
  },
  {
    title: "Simulate before you sign",
    icon: "check" as IconName,
    body: "Transactions are simulated and gas-estimated first, so failures show up before they cost you gas.",
  },
  {
    title: "Honest product status",
    icon: "info" as IconName,
    body: "Every module is labelled Live, Partial or Not built. Nothing pretends to work before it does.",
  },
];

export type PhaseState = "done" | "in-progress" | "planned";

export const ROADMAP: { phase: string; title: string; state: PhaseState; items: string[] }[] = [
  {
    phase: "Phase 1",
    title: "Foundation",
    state: "done",
    items: [
      "Mainnet-only app for Robinhood Chain (chain ID 4663)",
      "Verified contract registry with runtime on-chain checks",
      "Wallet connection through browser wallets",
    ],
  },
  {
    phase: "Phase 2",
    title: "Trading & liquidity",
    state: "in-progress",
    items: [
      "Swaps through official Uniswap v3 contracts",
      "Create and manage Uniswap v3 liquidity positions",
      "Uniswap v4 routing",
    ],
  },
  {
    phase: "Phase 3",
    title: "Launchpad contracts",
    state: "in-progress",
    items: [
      "Bonding-curve launchpad and Uniswap v3 graduator written and unit-tested",
      "Launch form, metadata storage and token pages",
      "Fork tests against mainnet state",
    ],
  },
  {
    phase: "Phase 4",
    title: "Market data",
    state: "in-progress",
    items: [
      "Indexer for Uniswap v3 pools, swaps and liquidity events",
      "Market activity and Analytics from indexed data",
      "Launchpad events once the launchpad is deployed",
    ],
  },
  {
    phase: "Phase 5",
    title: "Full product",
    state: "planned",
    items: ["Explore and token discovery", "Creator dashboard", "Complete portfolio holdings", "Staking pools"],
  },
  {
    phase: "Phase 6",
    title: "Audit & mainnet launch",
    state: "planned",
    items: [
      "External security audit and fixes",
      "Fuzz and invariant testing, monitoring",
      "Staged mainnet deployment with low initial limits",
    ],
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is SYNORA?",
    a: "SYNORA is a DeFi platform built exclusively for Robinhood Chain. It brings token launches, trading and liquidity together in one interface, using verified on-chain contracts.",
  },
  {
    q: "Which network does SYNORA support?",
    a: "Only Robinhood Chain Mainnet (chain ID 4663). Gas is paid in ETH. There is no testnet mode and no other network.",
  },
  {
    q: "Is SYNORA affiliated with Robinhood?",
    a: "No. SYNORA is an independent project built on Robinhood Chain. It is not operated, endorsed or supported by Robinhood.",
  },
  {
    q: "Does SYNORA have a token?",
    a: "No. SYNORA has not issued a token. Any token presented as an official SYNORA token is not ours — please be careful.",
  },
  {
    q: "Can I launch a token today?",
    a: "Not yet. The launch form is ready, but the launchpad contracts will only be deployed after an external audit. Until then, launching is disabled and the form explains why.",
  },
  {
    q: "Does SYNORA hold my funds?",
    a: "No. SYNORA is non-custodial. Every transaction is signed in your own wallet, and we will never ask for your seed phrase or private key.",
  },
  {
    q: "Which wallets can I use?",
    a: "Any EVM browser wallet that announces itself to websites (EIP-6963), such as MetaMask, Coinbase Wallet or Rabby. On mobile, open SYNORA inside your wallet's built-in browser. WalletConnect is not available yet.",
  },
  {
    q: "Does SYNORA charge fees on swaps?",
    a: "SYNORA adds no fee of its own to swaps or liquidity. You pay the Uniswap pool's fee tier and network gas. Launchpad fees will be set by the audited contract and shown before you sign.",
  },
  {
    q: "Have the contracts been audited?",
    a: "SYNORA's own contracts have not been audited or deployed yet. Trading and liquidity use Uniswap's official deployments on Robinhood Chain.",
  },
  {
    q: "Where does the market data come from?",
    a: "From an indexer that reads Uniswap v3 events directly from Robinhood Chain. Values are shown in ETH; USD prices appear only after a verified price oracle is integrated.",
  },
  {
    q: "What do Live, Partial and Not built mean?",
    a: "Live works end to end. Partial works for the parts described on its page. Not built is planned and does nothing yet. We label every module so nothing appears finished before it is.",
  },
];
