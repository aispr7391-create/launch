import { ACTIVE_CHAIN } from "@/config/wagmi";

const base = () => ACTIVE_CHAIN.blockExplorers?.default.url.replace(/\/$/, "") ?? "";

export const explorer = {
  home: () => base(),
  tx: (hash: string) => `${base()}/tx/${hash}`,
  address: (addr: string) => `${base()}/address/${addr}`,
  token: (addr: string) => `${base()}/token/${addr}`,
  block: (n: bigint | number) => `${base()}/block/${n.toString()}`,
};
