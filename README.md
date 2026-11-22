# PROJECT X — Robinhood Chain DeFi

An all-in-one DeFi platform built **only** for Robinhood Chain: token launches, trading,
liquidity, staking and portfolio tracking. No other networks are supported.

**Network:** Robinhood Chain Mainnet only — chain ID 4663, gas in ETH,
RPC `https://rpc.mainnet.chain.robinhood.com`, explorer https://robinhoodchain.blockscout.com.
Development happens on local Anvil forks of mainnet and in automated tests.

**Current state (Stage 4 in progress):**
- Frontend: wallet, network validation, live RPC panel, receipt tracking, on-chain verification of
  every integrated Uniswap contract. Trading/launch/staking UIs are not wired yet and say so.
- Contracts (`packages/contracts`): bonding-curve launchpad, Uniswap v3 graduator, staking hub, with
  unit, fuzz and mainnet-fork tests. **Not deployed — audit required.**
- Launch Token page: full 5-step form and real deploy flow; blocked until the launchpad is deployed and Supabase is configured (`docs/LAUNCH_FLOW.md`).
- Liquidity module (`/pools`): Uniswap v3 add/increase/remove/collect, positions, pool pages (`docs/LIQUIDITY.md`).
- Roadmap: `docs/ASSESSMENT_AND_ROADMAP.md`. Integration ledger: `docs/INTEGRATION_STATUS.md`.

## Quick start

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev                                    # http://localhost:3000

cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-git
forge test                                     # unit + fuzz
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path "test/fork/*"
npx tsx sim/curve-sim.ts                       # BigInt check of the curve maths
```

## Layout

```
apps/web/            Next.js 15 + React 19 + TypeScript + Tailwind v4 + wagmi v2 / viem v2
packages/contracts/  Foundry + OpenZeppelin (launchpad, staking) — Phase 2/5
services/market-data Indexer for prices, volume, holders — Phase 6
services/api         Token metadata + read API — Phase 2/6
docs/                ARCHITECTURE.md, INTEGRATION_STATUS.md
```

## Rebranding

Edit `apps/web/src/config/brand.ts`, replace `apps/web/public/icon.svg` and
`components/ui/Logo.tsx`, and adjust the accent tokens at the top of `src/app/globals.css`.

## Roadmap

See `docs/ASSESSMENT_AND_ROADMAP.md` (stages 1–8).
