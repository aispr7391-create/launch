# Liquidity module — Uniswap v3 on Robinhood Chain Mainnet (4663)

Routes: `/pools` (overview) · `/pools/explore` · `/pools/positions` · `/pools/positions/[id]` · `/pools/add` · `/pools/[address]`
Code: `apps/web/src/features/pools/` · APIs: `app/api/pools/**` · Indexer: `services/market-data` · Schema: `supabase/migrations/0002_pools.sql`

## Scope decisions
| Version | Status | Why |
|---|---|---|
| Uniswap v3 | **Supported** | Factory `0x1f7d…2efa` and NonfungiblePositionManager `0x7399…e0d3` from Uniswap's official Robinhood Chain page, re-checked on-chain (`/network`). |
| Uniswap v4 | Not supported | Official addresses known, but v4 positions/hooks need separate handling. Shown as unavailable. |
| Uniswap v2 | Not supported | No official Robinhood Chain address page found. |
| New pool creation | Not supported | Initialising a pool sets its price; deferred to avoid users mispricing pools. Only initialised pools accept liquidity. |

## Two kinds of liquidity — never mixed
1. **User positions** — Uniswap v3 NFTs owned by the connected wallet (`balanceOf` + `tokenOfOwnerByIndex` on the position manager). Positions created anywhere (not just in PROJECT X) appear.
2. **Protocol-owned graduation liquidity** — full-range NFTs owned by `UniswapV3Graduator` (permanently locked). Listed in a separate "Graduation liquidity" card by enumerating the graduator's NFTs; never in "My positions". Empty until the graduator is deployed.

## Data sources (no fabricated numbers)
| Shown | Source |
|---|---|
| Pool price, tick, active liquidity | `slot0()`, `liquidity()` of the pool |
| Pool reserves | `balanceOf(pool)` of each token |
| Pool authenticity | `factory.getPool(token0, token1, fee) == pool`, else rejected |
| Position amounts | `positions(id)` + exact TickMath/LiquidityAmounts port |
| Unclaimed fees | static call of `collect(max, max)` as the owner (same as Uniswap's UI) |
| Recent swaps / mints / burns | `eth_getLogs` on the pool, bounded backward scan (`/api/pools/[a]/events`) |
| Pool list, 24h volume, price chart, creation info | indexer → Supabase (`pool_stats`, `pool_swaps`) |
| ETH value | **estimate**, WETH pairs only, at pool spot price — labelled as such |
| USD value, IL, PnL | **not shown** — no reliable price or entry data yet |

"Liquidity" sorting uses *WETH locked* (WETH balance of WETH-paired pools); non-WETH pairs sort last.

## Transaction flows (all via `useTxAction`)
wallet check → switch/verify chain 4663 → `simulateContract` → `estimateContractGas` (+20 %) → sign → tracked → `waitForTransactionReceipt` → success only if `status === "success"`. A synchronous lock blocks double submission.

| Action | Calls (position manager `multicall`) |
|---|---|
| Add (new) | `mint` [+ `refundETH` when paying with ETH] |
| Add (existing) | `increaseLiquidity` [+ `refundETH`] — owner only (contract does not check; UI does) |
| Remove 1–100 % | `decreaseLiquidity` + `collect` [→ `unwrapWETH9` + `sweepToken` for ETH] |
| Collect fees | `collect` [→ `unwrapWETH9` + `sweepToken`] |
| Approvals | ERC-20 `approve(positionManager, exactAmount)` — never unlimited |

Minimums: `amountMin = expected × (1 − slippage)` for mint/increase/decrease. Deadline: now + 20 min.

## Security review (Stage 7)
- [x] Only official factory pools: every pool address is verified against `factory.getPool` before use (client and API).
- [x] Token addresses validated: code exists, ERC-20 `symbol`/`decimals` respond; imported tokens need explicit acknowledgement and are flagged.
- [x] Chain 4663 enforced before every write; wagmi config contains only chain 4663.
- [x] Exact approvals; allowance re-read after approval.
- [x] Simulation + gas estimation before signing; reverted receipts surface as failures.
- [x] Duplicate-submission lock; buttons disabled while a transaction is in flight.
- [x] `increaseLiquidity` restricted to the NFT owner in the UI (prevents gifting funds to someone else's position).
- [x] Remove/collect actions only when the connected wallet owns the NFT.
- [x] Native ETH paths use the position manager's own WETH9 (`refundETH`, `unwrapWETH9`, `sweepToken`).
- [x] Server routes never trust client data; event/history endpoints are read-only and bounded.
- [ ] Rate limiting on `/api/pools/*/events` (each call can trigger up to 25 `eth_getLogs`).
- [ ] Fork test of mint/increase/decrease/collect against real mainnet state (see below).
- [ ] Spot-price manipulation: ETH "value" estimates use spot price; consider a TWAP (`observe`) before showing value more prominently.

## Tests
```bash
cd apps/web && npm test          # tick math (exact Uniswap constants), liquidity amounts, quotes, call encoding
cd services/market-data && npm test
```
`plan.test.ts` (call encoding) needs `viem` installed — it was not runnable in the environment where this was written;
`math.test.ts` and `quote.test.ts` (13 tests) were run and pass.

Recommended next: an Anvil fork test — `anvil --fork-url $ROBINHOOD_RPC_URL`, point the app at it, and run add → increase →
remove 25 % → collect → remove 100 % against a live WETH pool.

## Indexer
```bash
cd services/market-data
RPC_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run index
```
Finds the factory deployment block itself (binary search on contract code) unless `START_BLOCK` is set; checkpoints in
`indexer_state`; idempotent writes; stays `CONFIRMATIONS` blocks behind head.
