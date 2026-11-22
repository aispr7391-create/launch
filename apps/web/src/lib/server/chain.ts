import "server-only";
import { createPublicClient, fallback, http } from "viem";
import { alchemyRpcUrl, robinhoodChain } from "@/config/chains";

/** Server-side Robinhood Chain Mainnet client, used to verify launches independently of the browser. */
const urls = [
  alchemyRpcUrl(process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? ""),
  ...robinhoodChain.rpcUrls.default.http,
].filter((u): u is string => Boolean(u));

export const serverClient = createPublicClient({
  chain: robinhoodChain,
  transport: fallback(urls.map((u) => http(u))),
});
