import { defineChain } from "viem";

/**
 * Robinhood Chain Mainnet — the only network SYNORA supports.
 *
 * Values from the official documentation: https://docs.robinhood.com/chain/connecting
 * Robinhood Chain is an Arbitrum Orbit (Nitro) L2 that settles to Ethereum; gas is paid in ETH.
 *
 * `contracts.multicall3` is deliberately not set: no official Robinhood source lists it.
 * Uniswap's own UniswapInterfaceMulticall is in config/contracts.ts instead.
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    // Public endpoint: shared and rate-limited. Set an Alchemy key for production traffic.
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

/** Alchemy is the provider Robinhood's docs recommend. */
export function alchemyRpcUrl(apiKey: string): string | null {
  return apiKey ? `https://robinhood-mainnet.g.alchemy.com/v2/${apiKey}` : null;
}
