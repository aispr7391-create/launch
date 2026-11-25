import type { IndexedPool } from "@/features/pools/types";

const Q96 = 2 ** 96;

/** token1-per-token0 price in human units from a Uniswap v3 sqrtPriceX96. */
export function humanPrice(sqrtPriceX96: string, decimals0: number, decimals1: number): number | null {
  const s = Number(BigInt(sqrtPriceX96)) / Q96;
  const p = s * s * 10 ** (decimals0 - decimals1);
  return Number.isFinite(p) && p > 0 ? p : null;
}

/**
 * For WETH pairs: the non-WETH token, and its price in ETH at the given sqrtPrice.
 * Returns null for non-WETH pairs (no ETH reference without a price oracle).
 */
export function tokenPriceEth(pool: Pick<IndexedPool, "weth_side" | "symbol0" | "symbol1" | "token0" | "token1" | "decimals0" | "decimals1">, sqrtPriceX96: string | null) {
  if (pool.weth_side === null || pool.weth_side === undefined || !sqrtPriceX96) return null;
  const p = humanPrice(sqrtPriceX96, pool.decimals0, pool.decimals1);
  if (p === null) return null;
  // p = token1 per token0. If token1 is WETH, token0 costs p ETH; if token0 is WETH, token1 costs 1/p ETH.
  return pool.weth_side === 1
    ? { symbol: pool.symbol0, address: pool.token0, priceEth: p }
    : { symbol: pool.symbol1, address: pool.token1, priceEth: 1 / p };
}
