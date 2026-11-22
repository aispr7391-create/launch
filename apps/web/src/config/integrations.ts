/**
 * Integration ledger shown on /network and mirrored in docs/INTEGRATION_STATUS.md.
 * Contract addresses themselves are checked live on-chain (see OnchainChecks).
 */

export type IntegrationState = "verified" | "available" | "unconfirmed" | "missing";

export interface Integration {
  name: string;
  state: IntegrationState;
  note: string;
  source?: string;
}

export const INTEGRATIONS: Integration[] = [
  {
    name: "Robinhood Chain Mainnet — chain ID 4663",
    state: "verified",
    note: "ETH gas, public RPC, Blockscout explorer. The only supported network.",
    source: "https://docs.robinhood.com/chain/connecting",
  },
  {
    name: "Uniswap v3 (Factory, QuoterV2, SwapRouter02, PositionManager)",
    state: "available",
    note: "Official addresses imported and checked on-chain. Liquidity module live (mint, increase, decrease, collect); Trade UI not wired yet.",
    source: "https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments",
  },
  {
    name: "Uniswap v4 (PoolManager, PositionManager, StateView, Quoter)",
    state: "available",
    note: "Official addresses imported. v4 routing deferred; v4 pools shown as unavailable.",
    source: "https://developers.uniswap.org/docs/protocols/v4/deployments",
  },
  {
    name: "Uniswap v2",
    state: "unconfirmed",
    note: "Live per Uniswap, but no official address page could be found. Not integrated.",
  },
  {
    name: "PROJECT X Launchpad, Graduator, StakingHub",
    state: "missing",
    note: "Written with unit, fuzz and fork tests. Not deployed: audit required before mainnet.",
  },
  {
    name: "Market data (prices, volume, holders, analytics)",
    state: "missing",
    note: "Needs the indexer (Stage 6). No price, volume or USD value is shown until it exists.",
  },
];
