# services/market-data

Indexer for Uniswap v3 on Robinhood Chain Mainnet (4663). Reads only on-chain data:
PoolCreated (official factory) → `pools`; Swap / Mint / Burn of those pools → `pool_swaps`,
`pool_liquidity_events`; slot0 / liquidity / token balances → pool snapshots. Schema:
`supabase/migrations/0002_pools.sql`. See docs/LIQUIDITY.md.

```bash
npm install
RPC_URL=https://robinhood-mainnet.g.alchemy.com/v2/<KEY> SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run index
npm test
```

Planned: PROJECT X launchpad / staking events, token holders, launch analytics.
