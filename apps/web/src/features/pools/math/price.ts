/**
 * Human price ⇄ sqrtPriceX96 / tick conversions with token decimals.
 * "price of token0 in token1" = (sqrtP/2^96)^2 · 10^(dec0 − dec1)
 */
import { getSqrtRatioAtTick, getTickAtSqrtRatio, MAX_TICK, MIN_TICK, Q192 } from "./tickMath";

/** token1 per 1 token0, as a JS number (display only). */
export function sqrtPriceToPrice(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  // Keep precision: scale by 1e18 in bigint before converting.
  const SCALE = 10n ** 18n;
  const raw = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / Q192; // token1 raw per token0 raw × 1e18
  return (Number(raw) / 1e18) * 10 ** (dec0 - dec1);
}

export function tickToPrice(tick: number, dec0: number, dec1: number): number {
  return sqrtPriceToPrice(getSqrtRatioAtTick(tick), dec0, dec1);
}

/** Tick for a human price (token1 per token0). Returns null for non-positive/invalid input. */
export function priceToTick(price: number, dec0: number, dec1: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const raw = price * 10 ** (dec1 - dec0);
  const t = Math.log(raw) / Math.log(1.0001);
  if (!Number.isFinite(t)) return null;
  const tick = Math.floor(t);
  return Math.max(MIN_TICK, Math.min(MAX_TICK, tick));
}

export function currentTick(sqrtPriceX96: bigint): number {
  return getTickAtSqrtRatio(sqrtPriceX96);
}

/** Format a price with sensible significant digits. */
export function formatPrice(p: number): string {
  if (!Number.isFinite(p)) return "∞";
  if (p === 0) return "0";
  if (p >= 1e15) return p.toExponential(3);
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
  if (p >= 1e-6) return p.toLocaleString("en-US", { maximumSignificantDigits: 6 });
  return p.toExponential(4);
}
