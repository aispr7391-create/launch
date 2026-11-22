/**
 * Pure swap maths (BigInt, no dependencies): mid-price output, price impact, minimum received.
 * Unit-tested in __tests__/math.test.ts.
 */
const Q192 = 1n << 192n;
const FEE_DENOM = 1_000_000n;

export interface Hop {
  sqrtPriceX96: bigint;
  /** true when tokenIn of this hop is the pool's token0 */
  zeroForOne: boolean;
  /** fee in hundredths of a bip (e.g. 3000 = 0.3 %) */
  fee: number;
}

/** Output at the current mid price minus LP fees, i.e. what an infinitely small trade would get. */
export function midAmountOut(amountIn: bigint, hops: Hop[]): bigint {
  let amount = amountIn;
  for (const h of hops) {
    if (h.sqrtPriceX96 === 0n) return 0n;
    const p = h.sqrtPriceX96 * h.sqrtPriceX96;
    const gross = h.zeroForOne ? (amount * p) / Q192 : (amount * Q192) / p;
    amount = (gross * (FEE_DENOM - BigInt(h.fee))) / FEE_DENOM;
  }
  return amount;
}

/** Price impact in basis points: how much worse the quoted output is than the mid-price output. */
export function priceImpactBps(midOut: bigint, quotedOut: bigint): number {
  if (midOut <= 0n || quotedOut >= midOut) return 0;
  return Number(((midOut - quotedOut) * 10_000n) / midOut);
}

export function minimumReceived(quotedOut: bigint, slippageBps: number): bigint {
  return (quotedOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export type ImpactLevel = "low" | "medium" | "high" | "blocked";
/** UI thresholds: >1 % warn, >5 % strong warning, >15 % requires explicit confirmation. */
export function impactLevel(bps: number): ImpactLevel {
  if (bps > 1_500) return "blocked";
  if (bps > 500) return "high";
  if (bps > 100) return "medium";
  return "low";
}
