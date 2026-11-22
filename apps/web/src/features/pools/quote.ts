/**
 * Pure Uniswap v3 liquidity quoting: amounts, minimums, range status, pool share.
 * No dependencies beyond the math ports, so it is unit-tested without a chain.
 */
import { getAmountsForLiquidity, getAmountsForMint, getLiquidityForAmount0, getLiquidityForAmount1 } from "./math/liquidityAmounts";
import { getSqrtRatioAtTick } from "./math/tickMath";

export const BPS = 10_000n;

export type RangeStatus = "in-range" | "below" | "above";

/** Where the current price sits relative to [tickLower, tickUpper). "below" = price under range → token0 only. */
export function rangeStatus(tick: number, tickLower: number, tickUpper: number): RangeStatus {
  if (tick < tickLower) return "below";
  if (tick >= tickUpper) return "above";
  return "in-range";
}

export interface DepositQuote {
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  /** Which token(s) the range actually needs at the current price. */
  needs0: boolean;
  needs1: boolean;
}

/**
 * Given the amount of ONE token, compute the liquidity and the matching amount of the other,
 * exactly as the pool will charge it (rounded up).
 */
export function quoteDeposit(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  side: 0 | 1,
  amount: bigint,
): DepositQuote {
  const sA = getSqrtRatioAtTick(tickLower);
  const sB = getSqrtRatioAtTick(tickUpper);
  const needs0 = sqrtPriceX96 < sB;
  const needs1 = sqrtPriceX96 > sA;
  if (amount <= 0n || (side === 0 && !needs0) || (side === 1 && !needs1)) {
    return { liquidity: 0n, amount0: 0n, amount1: 0n, needs0, needs1 };
  }
  let liquidity: bigint;
  if (side === 0) liquidity = getLiquidityForAmount0(sqrtPriceX96 > sA ? sqrtPriceX96 : sA, sB, amount);
  else liquidity = getLiquidityForAmount1(sA, sqrtPriceX96 < sB ? sqrtPriceX96 : sB, amount);
  const [amount0, amount1] = getAmountsForMint(sqrtPriceX96, sA, sB, liquidity);
  return { liquidity, amount0, amount1, needs0, needs1 };
}

export const withSlippage = (amount: bigint, slippageBps: number) => (amount * (BPS - BigInt(slippageBps))) / BPS;

/** Share of the pool's active (in-range) liquidity the new position would hold at the current price. */
export function activeShareBps(positionLiquidity: bigint, poolLiquidity: bigint, inRange: boolean): number | null {
  if (!inRange || positionLiquidity === 0n) return inRange ? 0 : null;
  return Number((positionLiquidity * BPS) / (poolLiquidity + positionLiquidity));
}

export interface RemoveQuote {
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
}

export function quoteRemove(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  positionLiquidity: bigint,
  percent: number,
  slippageBps: number,
): RemoveQuote {
  const pct = BigInt(Math.max(0, Math.min(100, Math.round(percent))));
  const liquidity = (positionLiquidity * pct) / 100n;
  const [amount0, amount1] = getAmountsForLiquidity(
    sqrtPriceX96,
    getSqrtRatioAtTick(tickLower),
    getSqrtRatioAtTick(tickUpper),
    liquidity,
  );
  return { liquidity, amount0, amount1, amount0Min: withSlippage(amount0, slippageBps), amount1Min: withSlippage(amount1, slippageBps) };
}

