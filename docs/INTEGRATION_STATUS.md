# Integration status — Robinhood Chain Mainnet (4663)

Last reviewed: 2026-11-22. The app re-checks every address on-chain at runtime (Status page).

| Integration | State | Notes |
|---|---|---|
| Robinhood Chain Mainnet | ✅ Verified | docs.robinhood.com/chain/connecting |
| Uniswap v3: Factory, QuoterV2, NonfungiblePositionManager, SwapRouter02, UniversalRouter, Permit2, InterfaceMulticall | ✅ Addresses imported | Uniswap's Robinhood Chain v3 deployments page. Runtime check: code present; PositionManager / SwapRouter02 / QuoterV2 `WETH9()` and `factory()` must match. |
| Uniswap v4: PoolManager, PositionManager, StateView, Quoter | ✅ Addresses imported | Uniswap v4 deployments page + deployments.json. Routing not implemented yet. |
| WETH `0x0Bd7…AD73` | 🟡 Provisional | Robinhood contracts page (no network column). Confirmed at runtime against Uniswap `WETH9()`. Contracts never hard-code it. |
| Uniswap v2 | 🟠 Not integrated | No official address page found. |
| PROJECT X BondingCurveLaunchpad / UniswapV3Graduator / StakingHub | 🔴 Not deployed | Code + tests written. Deployment script refuses to run without audit sign-off. |
| Supabase (logos, metadata, launch index) | 🔴 Not configured | Code + migration ready (`supabase/migrations/0001_tokens.sql`); set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. See docs/LAUNCH_FLOW.md. |
| Pool indexer (services/market-data) | 🟡 Written, not running | PoolCreated/Swap/Mint/Burn → Supabase (`0002_pools.sql`). Needed for the full pool list, volume, charts. Pair lookup works without it. |
| USD prices | 🔴 Missing | No verified price oracle wired; values shown in ETH for WETH pairs only, as estimates. |
