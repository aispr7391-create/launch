# Architecture

## Principles

1. **One chain.** Robinhood Chain Mainnet (4663) only. No testnet, no network selector.
   Development uses local Anvil forks of mainnet and automated tests.
2. **Nothing invented.** Contract addresses live in one registry
   (`apps/web/src/config/contracts.ts`) and start as `null`. `requireContract()` throws a
   descriptive `IntegrationMissingError` rather than using an unverified address.
3. **No fake data.** Values on screen come from the RPC, from a confirmed receipt, or from
   the indexer. If the source does not exist yet, the UI says so.
4. **Keys never leave the wallet.** All signing goes through wagmi connectors. The app
   never asks for, stores, or transmits seed phrases or private keys.

## Frontend (`apps/web/src`)

```
app/                 Routes (App Router). Pages are server components composing client widgets.
config/
  chains.ts          viem chain definitions (verified values + source link)
  wagmi.ts           wagmi config: active chain, connectors, transports (Alchemy → public fallback)
  contracts.ts       address registry + requireContract()
  modules.ts         module list, phase, status, features, dependencies → nav + roadmap
  integrations.ts    integration ledger shown on /network
  brand.ts           product name and copy (rebrand here)
  env.ts             typed NEXT_PUBLIC_* config
components/
  shell/             Sidebar, TopBar, MobileNav, AppShell
  wallet/            ConnectWalletButton, ConnectModal (EIP-6963), AccountMenu, NetworkBanner
  network/           LiveNetworkPanel (block, gas, latency, chain-ID verification)
  portfolio/         WalletSummary, ActivityList
  modules/           ModulePending (honest "not built" screen)
  ui/                primitives, Icon, Logo
features/
  tx/                TxProvider (receipt-based tracking), TxToaster
lib/                 format, explorer URLs, error messages
```

Planned per phase: `features/launch`, `features/trade`, `features/pools`, `features/stake`,
`features/explore`, each with its own `abi/`, `hooks/`, and `components/`.

### Wallet flow
- `injected()` with EIP-6963 discovery lists each installed wallet; WalletConnect is added
  when a project ID is set.
- `connect({ chainId })` requests the active chain on connect; `NetworkBanner` detects any
  other chain and offers `switchChain`, which adds the network to the wallet if missing.
- Connection state is persisted in a cookie and restored during SSR (`cookieToInitialState`).

### Transaction lifecycle
`writeContract` → `track(hash, label)` → `useWaitForTransactionReceipt` → status set from
`receipt.status`. Toasts and the Portfolio activity list link to the explorer.

## Contracts (`packages/contracts`)
Foundry + OpenZeppelin. Only contracts PROJECT X must own: the launchpad factory and the
staking/rewards system. Swaps and liquidity use the Uniswap deployments already on Robinhood Chain.

## Backend & data (`services/`)
- `api`: token metadata (Supabase), read API.
- `market-data`: event indexer → PostgreSQL. Source for prices, volume, holders, rankings.

## Environments
| Env | Chain | RPC |
|---|---|---|
| local | Anvil fork of 4663 (`anvil --fork-url …`) | localhost |
| production | 4663 | Alchemy key (domain-restricted), public RPC fallback |

Contracts: see `packages/contracts/README.md` and `docs/ASSESSMENT_AND_ROADMAP.md`.
