/**
 * Product modules. Drives navigation, the overview roadmap and the "not yet available"
 * screens, so the UI never presents an unfinished module as working.
 * `stage` refers to docs/ASSESSMENT_AND_ROADMAP.md.
 */

export type ModuleStatus = "live" | "partial" | "planned";
export type ModuleKey =
  | "overview"
  | "launch"
  | "trade"
  | "pools"
  | "explore"
  | "portfolio"
  | "creator"
  | "analytics"
  | "network";

export interface ModuleDef {
  key: ModuleKey;
  href: string;
  label: string;
  stage: number;
  status: ModuleStatus;
  group: "main" | "more" | "system";
  summary: string;
  features: string[];
  /** What must exist before this module can work for real. */
  dependencies: string[];
}

export const MODULES: ModuleDef[] = [
  {
    key: "overview",
    href: "/",
    label: "Overview",
    stage: 1,
    status: "partial",
    group: "main",
    summary: "Your wallet, live network status, quick actions and market activity.",
    features: [],
    dependencies: [],
  },
  {
    key: "launch",
    href: "/launch",
    label: "Launch",
    stage: 7,
    status: "partial",
    group: "main",
    summary: "Create a token on a bonding curve. It graduates into Uniswap v3 automatically when the curve completes.",
    features: [
      "Name, symbol, description, logo, total supply",
      "Bonding-curve buy and sell with live on-chain quotes",
      "Trading fee (≤2 %, split protocol / creator)",
      "Graduation progress and automatic graduation",
      "Permanent full-range Uniswap v3 liquidity at graduation",
    ],
    dependencies: [
      "BondingCurveLaunchpad + UniswapV3Graduator — written and tested, awaiting audit and deployment",
      "Metadata/logo storage (services/api)",
    ],
  },
  {
    key: "trade",
    href: "/trade",
    label: "Trade",
    stage: 5,
    status: "partial",
    group: "main",
    summary: "Swap ETH and tokens through verified Uniswap v3 contracts on Robinhood Chain.",
    features: [
      "ETH→token, token→ETH, token→token (direct or via WETH)",
      "Token search and selection",
      "Live QuoterV2 quotes, slippage, price impact, minimum received",
      "Simulation and gas estimate before signing",
      "Exact-amount approvals, receipt tracking, history",
    ],
    dependencies: ["Uniswap v3 QuoterV2 + SwapRouter02 verified ✓", "v4 pools and UniswapX not routed yet"],
  },
  {
    key: "pools",
    href: "/pools",
    label: "Pools",
    stage: 5,
    status: "partial",
    group: "main",
    summary: "Add and remove Uniswap v3 liquidity, manage position NFTs and collect fees.",
    features: ["Pool discovery (indexer) and on-chain pair lookup", "Add / increase / remove liquidity", "Your position NFTs and fees", "Pool details, swaps and price history"],
    dependencies: ["Uniswap v3 Factory + PositionManager verified ✓", "Full pool list, volume and charts need the market-data indexer"],
  },
  {
    key: "explore",
    href: "/explore",
    label: "Explore",
    stage: 7,
    status: "planned",
    group: "main",
    summary: "Trending tokens, new launches, top movers, volume and liquidity rankings.",
    features: ["Trending / new launches / new pairs", "Top gainers and losers", "Highest volume and liquidity", "Recently graduated", "Search, filters, token pages"],
    dependencies: ["Indexer (Stage 6)"],
  },
  {
    key: "portfolio",
    href: "/portfolio",
    label: "Portfolio",
    stage: 7,
    status: "partial",
    group: "main",
    summary: "Your balances, positions and activity on Robinhood Chain.",
    features: ["ETH balance (live)", "ERC-20 holdings", "Liquidity positions", "Transaction history"],
    dependencies: ["Indexer for holdings and prices"],
  },
  {
    key: "creator",
    href: "/creator",
    label: "Creator",
    stage: 7,
    status: "planned",
    group: "more",
    summary: "Your launched tokens: curve progress, graduation, holders, trading and creator fees.",
    features: ["My tokens and launch history", "Curve progress and graduation status", "Holders and trading activity", "Claim creator fees (supported by the contract)"],
    dependencies: ["Launchpad deployment", "Indexer for holders and history"],
  },
  {
    key: "analytics",
    href: "/analytics",
    label: "Analytics",
    stage: 7,
    status: "partial",
    group: "more",
    summary: "Protocol-wide statistics, every number traceable to on-chain events.",
    features: ["Tokens launched / graduated", "Volume and liquidity", "Protocol fees", "Daily and launch activity"],
    dependencies: ["Indexer (Stage 6)", "PROJECT X contracts deployed"],
  },
  {
    key: "network",
    href: "/network",
    label: "Status",
    stage: 1,
    status: "live",
    group: "system",
    summary: "Chain, RPC health and on-chain verification of every integrated contract.",
    features: [],
    dependencies: [],
  },
];

export function getModule(key: ModuleKey): ModuleDef {
  const m = MODULES.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown module ${key}`);
  return m;
}
