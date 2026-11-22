"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress, isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { fetchTokenMeta, type TokenMeta } from "./onchain";

/**
 * Token sources, in order of trust:
 *  - "official": addresses on Robinhood's own contracts page (WETH, USDG); metadata read on-chain.
 *  - "projectx": tokens with a verified PROJECT X launch record.
 *  - "imported": pasted by the user; stored only in this browser and always shown with a warning.
 * There is no curated third-party token list for Robinhood Chain in this app.
 */
export type TokenSource = "native" | "official" | "projectx" | "imported";
export interface ListedToken extends TokenMeta {
  source: TokenSource;
  logo?: string;
}

/** Pseudo-address for native ETH in token pickers. Wrapped via the position manager's WETH9. */
export const NATIVE = "ETH" as const;
export type TokenChoice = ListedToken | typeof NATIVE;

const IMPORT_KEY = "px:imported-tokens:v1";

export function readImported(): Address[] {
  try {
    const raw = JSON.parse(localStorage.getItem(IMPORT_KEY) ?? "[]") as string[];
    return raw.filter((a) => isAddress(a)).map((a) => getAddress(a));
  } catch {
    return [];
  }
}

export function saveImported(address: Address) {
  try {
    const set = new Set(readImported());
    set.add(getAddress(address));
    localStorage.setItem(IMPORT_KEY, JSON.stringify([...set].slice(-50)));
  } catch {
    /* storage unavailable */
  }
}

export function useTokenList() {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  return useQuery({
    queryKey: ["token-list"],
    enabled: Boolean(client),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ListedToken[]> => {
      const c = client!;
      const official = [CONTRACTS.weth.address, CONTRACTS.usdg.address].filter(Boolean) as Address[];
      const launched = await fetch("/api/tokens?limit=50")
        .then((r) => (r.ok ? (r.json() as Promise<{ address: string; image_url: string }[]>) : []))
        .catch(() => []);
      const imported = readImported();

      const out: ListedToken[] = [];
      const seen = new Set<string>();
      const add = async (addr: string, source: TokenSource, logo?: string) => {
        const key = addr.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        try {
          out.push({ ...(await fetchTokenMeta(c, addr)), source, logo });
        } catch {
          /* skip anything that does not verify on-chain */
        }
      };
      await Promise.all(official.map((a) => add(a, "official")));
      await Promise.all(launched.map((t) => add(t.address, "projectx", t.image_url)));
      await Promise.all(imported.map((a) => add(a, "imported")));
      return out;
    },
  });
}

export const isNative = (t: TokenChoice | null | undefined): t is typeof NATIVE => t === NATIVE;
export const choiceSymbol = (t: TokenChoice | null | undefined) => (!t ? "" : isNative(t) ? "ETH" : t.symbol);
