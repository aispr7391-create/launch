# packages/contracts

Foundry + OpenZeppelin v5, Solidity 0.8.26. Robinhood Chain Mainnet (4663) only.

| Contract | Purpose |
|---|---|
| `launchpad/LaunchToken.sol` | Fixed-supply ERC-20 + permit. No owner/mint/tax. Wallet-to-wallet transfers locked until graduation. |
| `launchpad/CurveMath.sol` | Virtual-reserve constant-product maths; supply split so curve end price = Uniswap opening price. |
| `launchpad/BondingCurveLaunchpad.sol` | Create, buy, sell, fees (≤2 % hard cap, creator share), automatic graduation, retry path. |
| `launchpad/UniswapV3Graduator.sol` | Creates the 1 % Uniswap v3 pool, corrects a pre-initialised price, mints permanent full-range liquidity. |
| `staking/StakingHub.sol` | Permissionless flexible / fixed-term staking pools, linear rewards, idle-reward recovery. No admin. |

Uniswap addresses used: NonfungiblePositionManager `0x73991a25…de0d3` (official v3 deployments
page). WETH and the v3 factory are read from it on-chain.

## Test

```bash
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-git
forge test -vv                                   # unit + fuzz (fork tests excluded)
ROBINHOOD_RPC_URL=... forge test --match-path "test/fork/*" -vv   # against real mainnet state, nothing broadcast
forge coverage
npx tsx sim/curve-sim.ts                         # exact BigInt replica of the curve maths
```

> These contracts were written in an environment without a Solidity compiler. They have **not yet
> been compiled or run**. The curve maths was verified with `sim/curve-sim.ts`. Run the commands
> above first and fix anything the compiler reports before reviewing further.

## Deploy

`script/Deploy.s.sol` refuses to run unless `PX_AUDIT_SIGNED_OFF=true` and the chain is 4663.
Without `--broadcast` it only simulates. Owner and treasury should be a multisig.

## Known review items for the audit

- Graduation griefing: pool pre-initialised at a wrong price is corrected by a swap bounded to
  WETH-only liquidity; residual risk if large one-sided WETH liquidity sits in the pool.
- `graduationGasReserve` must be tuned on a fork so a final buy cannot be forced down the
  "pending" path with low gas.
- Owner powers: config for future launches, graduator swap, pause buys/creates, withdraw protocol fees.
