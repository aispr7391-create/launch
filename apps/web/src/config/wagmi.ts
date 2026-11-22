import { cookieStorage, createConfig, createStorage, fallback, http, type Transport } from "wagmi";
import type { Chain } from "viem";
import { alchemyRpcUrl, robinhoodChain } from "./chains";
import { ALCHEMY_API_KEY } from "./env";

/** PROJECT X runs on Robinhood Chain Mainnet (4663) only. There is no network selector. */
export const ACTIVE_CHAIN: Chain = robinhoodChain;

function transportFor(chain: Chain): Transport {
  const urls = [alchemyRpcUrl(ALCHEMY_API_KEY), ...chain.rpcUrls.default.http].filter(
    (u): u is string => Boolean(u),
  );
  // Provider RPC first, public RPC as fallback.
  return fallback(urls.map((url) => http(url, { batch: true })));
}

/**
 * Wallets: browser wallets announced via EIP-6963 (MetaMask, Rabby, Coinbase Wallet extension,
 * ...). wagmi discovers them automatically (`multiInjectedProviderDiscovery`, on by default), so
 * no connector list is needed.
 *
 * `wagmi/connectors` is deliberately NOT imported: that barrel pulls in every optional
 * connector SDK (Coinbase/Base account -> @coinbase/cdp-sdk -> @x402/*), which breaks the
 * Next.js build ("Module not found: Can't resolve '@x402/...'").
 */

export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  multiInjectedProviderDiscovery: true,
  transports: { [ACTIVE_CHAIN.id]: transportFor(ACTIVE_CHAIN) },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
