# PROJECT X — Technical assessment & roadmap

Reviewed: 2026-11-22. Target: **Robinhood Chain Mainnet (chain ID 4663) only.**

## 1. What exists today (Stage 1–2 inspection)

| Area | State | Notes |
|---|---|---|
| Next.js 15 / React 19 / TS / Tailwind v4 app shell | ✅ Working | Sidebar, top bar, mobile nav, page headers, design primitives |
| wagmi v2 + viem v2 wallet connection | ✅ Working | EIP-6963 discovery, WalletConnect (optional), cookie SSR restore |
| Network validation | ✅ Working | Wrong-chain banner + `switchChain` (adds chain if missing) |
| Live RPC panel | ✅ Working | Block, gas, latency, RPC chain-ID check |
| Receipt-based tx tracker | ✅ Working | `TxProvider` / `TxToaster`, used by every future write |
| Contract registry | ⚠️ Empty | All `null` — filled in this stage with officially published Uniswap addresses |
| Launch / Trade / Pools / Stake / Explore | ⛔ Placeholders | Honest "not built" screens |
| Creator dashboard, Analytics | ⛔ Missing | Added to nav this stage as placeholders |
| Solidity contracts | ⛔ None | Foundry skeleton only |
| Indexer / backend | ⛔ None | READMEs only |

### Changes required by the new brief
- **Mainnet only.** Testnet config, `NEXT_PUBLIC_NETWORK` and the testnet badge are removed. Development uses local Anvil forks of mainnet and automated tests — never a public deployment of untested code.
- **Design:** amber accent → navy/charcoal surfaces with a blue accent.
- **Nav:** add Creator and Analytics; no network selector (there is none — the Network page is a status page and moves to the footer area).

## 2. Verified Robinhood Chain Mainnet infrastructure

Source of each address is recorded in `apps/web/src/config/contracts.ts`. Each is additionally checked **on-chain at runtime** on the Network page (bytecode present, `WETH9()` matches, etc.).

| Contract | Address | Source |
|---|---|---|
| UniswapV3Factory | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` | Uniswap v3 Robinhood Chain deployments page |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` | same |
| NonfungiblePositionManager | `0x73991a25c818bf1f1128deaab1492d45638de0d3` | same |
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` | same |
| UniversalRouter | `0x8876789976decbfcbbbe364623c63652db8c0904` | same (v3 and v4 pages agree) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same |
| v4 PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` | Uniswap v4 deployments page + deployments.json |
| v4 PositionManager | `0x58daec3116aae6d93017baaea7749052e8a04fa7` | same |
| v4 StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` | same |
| v4 Quoter | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94` | same |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | docs.robinhood.com/chain/contracts (page has no network column → treated as provisional; contracts read WETH from `NonfungiblePositionManager.WETH9()` instead of trusting it) |
| **Uniswap v2 Factory / Router02** | **not found** | Not on any official page I could reach → **v2 is not integrated** |

## 3. Architecture decisions

### 3.1 Launchpad: bonding curve → Uniswap v3
- Constant-product curve with **virtual reserves** (`x·y = k`), per-token parameters snapshotted at launch so later config changes never affect live tokens.
- Supply is split so that the **curve's final price equals the Uniswap opening price**: with virtual ETH `V0`, target raise `R`, ETH sent to LP `R' = R − graduationFee`, total supply `S`:
  - curve tokens `C = S·R(V0+R) / (R(V0+R) + R'·V0)`; LP tokens `L = S − C`; virtual token reserve `X0 = (V0+R)·C / R`.
- **Automatic graduation** in the buy that sells the last curve token. The excess ETH of that buy is refunded.
- Graduation is delegated to an `IGraduator`. The first implementation, `UniswapV3Graduator`, wraps ETH, creates/initialises a 1% fee-tier pool at the curve's final price, mints a **full-range position held permanently** by the graduator (liquidity can never be withdrawn — only trading fees collected to the treasury).
- **Pool-griefing defence:** tokens can't be transferred wallet-to-wallet before graduation, so nobody can add token-side liquidity early. If someone pre-initialises the pool at a bad price, the graduator moves the price back with a swap against (at most) WETH-only liquidity, then checks the final price is within tolerance; otherwise graduation reverts, the token is marked `GraduationPending`, and anyone can call `retryGraduation` later (e.g. after the owner sets another graduator / fee tier).
- Fees: trade fee ≤ 2% (hard cap in code), split protocol / creator. Creator fees are claimable. Pausing blocks new launches and buys, **never sells**.
- Token metadata (description, logo) is off-chain (Supabase Storage), referenced by a URI emitted in `TokenCreated`.

### 3.2 Trading
- Uniswap v3 only in the first release: QuoterV2 for live quotes, SwapRouter02 for execution (`exactInputSingle` / multi-hop `exactInput`), native ETH in/out via the router's WETH handling.
- Every write: `simulateContract` → gas estimate → user signs → receipt tracked.
- Approvals: exact-amount approvals by default (opt-in unlimited), Permit2 later.
- v4 pools: quoting/routing deferred; marked unavailable in UI until implemented.

### 3.3 Liquidity
- v3 positions via NonfungiblePositionManager (create, increase, decrease, collect). Positions read from the user's NFTs; reserves/fees from pool state.

### 3.4 Staking — `StakingHub`
- One contract, many pools. Anyone can create a pool for any ERC-20 pair (stake token, reward token) and fund it; rewards stream linearly (Synthetix model, 1e18-scaled rate to avoid dust loss).
- `lockDuration = 0` → flexible; `> 0` → fixed-term (each deposit pushes the unlock time).
- Rewards accrued while nothing is staked are tracked as `idleRewards` and recoverable by the pool creator — no stuck funds.
- Fee-on-transfer tokens are handled by measuring balance deltas.
- APR shown = `rewardRate × 365d / totalStaked` only when stake and reward token are the same, or when both have verified prices; otherwise "APR unavailable".

### 3.5 Data (Stage 6)
- Indexer (Ponder or viem worker) over: launchpad events, StakingHub events, Uniswap v3 `Swap/Mint/Burn` for pools that involve tracked tokens. PostgreSQL/Supabase.
- Prices: from pool state against WETH; WETH→USD only from a verified oracle — until then values are shown in ETH, and USD is "unavailable".
- Explore, Analytics, Creator dashboard, Portfolio holdings all read from the indexer.

## 4. Roadmap

| Stage | Scope | Exit criteria |
|---|---|---|
| 1–3 | This document; mainnet-only refactor; verified registry; runtime on-chain checks | App builds; Network page shows every registry address passing |
| **4 (started)** | `LaunchToken`, `BondingCurveLaunchpad`, `UniswapV3Graduator`, `StakingHub`, unit tests, fork test, deploy script | `forge test` green incl. fork test against mainnet state; ≥95% line coverage on curve + staking; Slither clean |
| 5 | Trade + Pools on verified Uniswap v3 | Quotes match QuoterV2; swaps succeed on an Anvil mainnet fork |
| 6 | Indexer + API + Supabase schema | Backfill from launchpad deploy block; reorg-safe |
| 7 | Launch, Trade, Pools, Stake, Explore, Portfolio, Creator, Analytics wired | Every number traces to chain or indexer |
| 8 | Internal review, external audit, invariant/fuzz campaigns, monitoring, mainnet deploy with caps | Audit findings resolved; staged launch with low creation limits |

**Mainnet deployment gate:** no PROJECT X contract goes to chain 4663 before Stage 8's audit.
