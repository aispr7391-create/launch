import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fullRangeTicks,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  MAX_SQRT_RATIO,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MIN_TICK,
  nearestUsableTick,
  Q96,
} from "../math/tickMath";
import { getAmountsForLiquidity, getAmountsForMint, getLiquidityForAmounts } from "../math/liquidityAmounts";
import { priceToTick, sqrtPriceToPrice, tickToPrice } from "../math/price";

test("getSqrtRatioAtTick matches Uniswap boundary constants", () => {
  assert.equal(getSqrtRatioAtTick(MIN_TICK), MIN_SQRT_RATIO);
  assert.equal(getSqrtRatioAtTick(MAX_TICK), MAX_SQRT_RATIO);
  assert.equal(getSqrtRatioAtTick(0), Q96);
});

test("getSqrtRatioAtTick ≈ sqrt(1.0001^tick)·2^96", () => {
  for (const t of [-500000, -100000, -887, -1, 1, 50, 10000, 200000, 600000]) {
    const exact = Math.sqrt(1.0001 ** t) * 2 ** 96;
    const got = Number(getSqrtRatioAtTick(t));
    assert.ok(Math.abs(got / exact - 1) < 1e-10, `tick ${t}`);
  }
});

test("getTickAtSqrtRatio inverts getSqrtRatioAtTick", () => {
  for (const t of [MIN_TICK, -887271, -200000, -1, 0, 1, 12345, 887271]) {
    const s = getSqrtRatioAtTick(t);
    assert.equal(getTickAtSqrtRatio(s), t);
    if (t < MAX_TICK - 1) assert.equal(getTickAtSqrtRatio(s + 1n), t);
    if (t > MIN_TICK) assert.equal(getTickAtSqrtRatio(s - 1n), t - 1);
  }
});

test("usable ticks respect spacing and bounds", () => {
  assert.deepEqual(fullRangeTicks(200), [-887200, 887200]);
  assert.deepEqual(fullRangeTicks(60), [-887220, 887220]);
  assert.equal(nearestUsableTick(1234, 60), 1260);
  assert.equal(nearestUsableTick(-1234, 60), -1260);
  assert.equal(nearestUsableTick(999999, 10), 887270);
});

test("prices: tick ⇄ price with decimals", () => {
  // WETH(18) / USDC-like(6) at ~3000 token1 per token0
  const t = priceToTick(3000, 18, 6)!;
  assert.ok(Math.abs(tickToPrice(t, 18, 6) / 3000 - 1) < 1.0002 - 1 + 1e-9);
  assert.ok(Math.abs(sqrtPriceToPrice(Q96, 18, 18) - 1) < 1e-12);
  assert.equal(priceToTick(0, 18, 18), null);
  assert.equal(priceToTick(-1, 18, 18), null);
});

test("liquidity amounts: in-range mint round-trips", () => {
  const sqrtP = getSqrtRatioAtTick(0);
  const sA = getSqrtRatioAtTick(-6000);
  const sB = getSqrtRatioAtTick(6000);
  const L = getLiquidityForAmounts(sqrtP, sA, sB, 10n ** 18n, 10n ** 30n); // token0-limited
  const [m0, m1] = getAmountsForMint(sqrtP, sA, sB, L);
  assert.ok(m0 <= 10n ** 18n && 10n ** 18n - m0 < 10n, "uses ≈ all of amount0");
  assert.ok(m1 > 0n);
  const [h0, h1] = getAmountsForLiquidity(sqrtP, sA, sB, L);
  assert.ok(h0 <= m0 && m0 - h0 <= 1n && h1 <= m1 && m1 - h1 <= 1n, "hold ≤ deposit by rounding only");
  // symmetric range at price 1 → equal amounts
  assert.ok(Number(m0) / Number(m1) > 0.999999 && Number(m0) / Number(m1) < 1.000001);
});

test("liquidity amounts: out-of-range positions are single-sided", () => {
  const sA = getSqrtRatioAtTick(1000);
  const sB = getSqrtRatioAtTick(2000);
  const below = getSqrtRatioAtTick(0);
  const above = getSqrtRatioAtTick(3000);
  const L = 10n ** 20n;
  const [b0, b1] = getAmountsForLiquidity(below, sA, sB, L);
  assert.ok(b0 > 0n && b1 === 0n, "price below range → all token0");
  const [a0, a1] = getAmountsForLiquidity(above, sA, sB, L);
  assert.ok(a0 === 0n && a1 > 0n, "price above range → all token1");
});

test("known value: L for 1 token0 in [−60, 60] at tick 0", () => {
  // Δx = L·(√pb − √p)/(√p·√pb); √p = 1, √pb = 1.0001^30 → L = 1e18·√pb/(√pb − 1)
  const L = getLiquidityForAmounts(Q96, getSqrtRatioAtTick(-60), getSqrtRatioAtTick(60), 10n ** 18n, 10n ** 40n);
  const spb = Math.sqrt(1.0001 ** 60);
  const expected = 1e18 * spb / (spb - 1);
  assert.ok(Math.abs(Number(L) / expected - 1) < 1e-9);
});
