import { cookieStorage, createConfig, createStorage, fallback, http, type Transport } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import type { Chain } from "viem";
import { alchemyRpcUrl, robinhoodChain } from "./chains";
import { ALCHEMY_API_KEY, APP_URL, WALLETCONNECT_PROJECT_ID } from "./env";
import { BRAND } from "./brand";

/** PROJECT X runs on Robinhood Chain Mainnet (4663) only. There is no network selector. */
export const ACTIVE_CHAIN: Chain = robinhoodChain;

function transportFor(chain: Chain): Transport {
  const urls = [alchemyRpcUrl(ALCHEMY_API_KEY), ...chain.rpcUrls.default.http].filter(
    (u): u is string => Boolean(u),
  );
  // Provider RPC first, public RPC as fallback.
  return fallback(urls.map((url) => http(url, { batch: true })));
}

const connectors = [
  // Covers MetaMask, Rabby, Coinbase Wallet extension, etc. EIP-6963 discovery
  // (on by default in wagmi) lists every installed wallet individually.
  injected({ shimDisconnect: true }),
  ...(WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: WALLETCONNECT_PROJECT_ID,
          showQrModal: true,
          metadata: {
            name: BRAND.name,
            description: BRAND.description,
            url: APP_URL,
            icons: [`${APP_URL}/icon.svg`],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  connectors,
  transports: { [ACTIVE_CHAIN.id]: transportFor(ACTIVE_CHAIN) },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
