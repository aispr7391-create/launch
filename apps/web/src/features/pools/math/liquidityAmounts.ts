/** Exact port of Uniswap v3-periphery LiquidityAmounts + SqrtPriceMath amount helpers (BigInt). */
import { Q96 } from "./tickMath";

const sort = (a: bigint, b: bigint): [bigint, bigint] => (a > b ? [b, a] : [a, b]);
const mulDiv = (a: bigint, b: bigint, d: bigint) => (a * b) / d;
const mulDivUp = (a: bigint, b: bigint, d: bigint) => (a * b + d - 1n) / d;
const MAX_UINT128 = (1n << 128n) - 1n;

export function getLiquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  [sqrtA, sqrtB] = sort(sqrtA, sqrtB);
  const intermediate = mulDiv(sqrtA, sqrtB, Q96);
  return mulDiv(amount0, intermediate, sqrtB - sqrtA);
}

export function getLiquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  [sqrtA, sqrtB] = sort(sqrtA, sqrtB);
  return mulDiv(amount1, Q96, sqrtB - sqrtA);
}

export function getLiquidityForAmounts(sqrtP: bigint, sqrtA: bigint, sqrtB: bigint, amount0: bigint, amount1: bigint): bigint {
  [sqrtA, sqrtB] = sort(sqrtA, sqrtB);
  let l: bigint;
  if (sqrtP <= sqrtA) l = getLiquidityForAmount0(sqrtA, sqrtB, amount0);
  else if (sqrtP < sqrtB) {
    const l0 = getLiquidityForAmount0(sqrtP, sqrtB, amount0);
    const l1 = getLiquidityForAmount1(sqrtA, sqrtP, amount1);
    l = l0 < l1 ? l0 : l1;
  } else l = getLiquidityForAmount1(sqrtA, sqrtB, amount1);
  return l > MAX_UINT128 ? MAX_UINT128 : l;
}

/** Amounts a position holds (rounded down, as LiquidityAmounts does). */
export function getAmountsForLiquidity(sqrtP: bigint, sqrtA: bigint, sqrtB: bigint, liquidity: bigint): [bigint, bigint] {
  [sqrtA, sqrtB] = sort(sqrtA, sqrtB);
  const a0 = (s1: bigint, s2: bigint) => mulDiv(liquidity << 96n, s2 - s1, s2) / s1;
  const a1 = (s1: bigint, s2: bigint) => mulDiv(liquidity, s2 - s1, Q96);
  if (sqrtP <= sqrtA) return [a0(sqrtA, sqrtB), 0n];
  if (sqrtP < sqrtB) return [a0(sqrtP, sqrtB), a1(sqrtA, sqrtP)];
  return [0n, a1(sqrtA, sqrtB)];
}

/** Amounts a mint of `liquidity` will pull from the user (rounded up, as the pool does). */
export function getAmountsForMint(sqrtP: bigint, sqrtA: bigint, sqrtB: bigint, liquidity: bigint): [bigint, bigint] {
  [sqrtA, sqrtB] = sort(sqrtA, sqrtB);
  const a0 = (s1: bigint, s2: bigint) => {
    const n = mulDivUp(liquidity << 96n, s2 - s1, s2);
    return (n + s1 - 1n) / s1;
  };
  const a1 = (s1: bigint, s2: bigint) => mulDivUp(liquidity, s2 - s1, Q96);
  if (sqrtP <= sqrtA) return [a0(sqrtA, sqrtB), 0n];
  if (sqrtP < sqrtB) return [a0(sqrtP, sqrtB), a1(sqrtA, sqrtP)];
  return [0n, a1(sqrtA, sqrtB)];
}
