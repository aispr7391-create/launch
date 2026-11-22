import { test } from "node:test";
import assert from "node:assert/strict";
import { activeShareBps, quoteDeposit, quoteRemove, rangeStatus, withSlippage } from "../quote";
import { getAmountsForLiquidity } from "../math/liquidityAmounts";
import { getSqrtRatioAtTick } from "../math/tickMath";

test("rangeStatus", () => {
  assert.equal(rangeStatus(0, -60, 60), "in-range");
  assert.equal(rangeStatus(-61, -60, 60), "below");
  assert.equal(rangeStatus(60, -60, 60), "above"); // upper tick is exclusive
});

test("quoteDeposit: entering token0 derives token1, both directions agree", () => {
  const sqrtP = getSqrtRatioAtTick(100);
  const q0 = quoteDeposit(sqrtP, -1200, 1200, 0, 10n ** 18n);
  assert.ok(q0.needs0 && q0.needs1 && q0.amount1 > 0n);
  assert.ok(q0.amount0 <= 10n ** 18n + 1n);
  const q1 = quoteDeposit(sqrtP, -1200, 1200, 1, q0.amount1);
  assert.ok(Number(q1.amount0) / Number(q0.amount0) > 0.999999 && Number(q1.amount0) / Number(q0.amount0) < 1.000001);
});

test("quoteDeposit: out-of-range ranges need one token only", () => {
  const sqrtP = getSqrtRatioAtTick(0);
  const above = quoteDeposit(sqrtP, 600, 1200, 0, 10n ** 18n); // price below range → token0 only
  assert.ok(above.needs0 && !above.needs1 && above.amount1 === 0n && above.liquidity > 0n);
  assert.equal(quoteDeposit(sqrtP, 600, 1200, 1, 10n ** 18n).liquidity, 0n, "token1 not accepted");
  const below = quoteDeposit(sqrtP, -1200, -600, 1, 10n ** 18n);
  assert.ok(!below.needs0 && below.needs1 && below.amount0 === 0n);
});

test("slippage and pool share", () => {
  assert.equal(withSlippage(10_000n, 50), 9_950n);
  assert.equal(activeShareBps(100n, 300n, true), 2500);
  assert.equal(activeShareBps(100n, 300n, false), null);
});

test("quoteRemove 25/50/75/100%", () => {
  const sqrtP = getSqrtRatioAtTick(0);
  const L = 10n ** 20n;
  const full = getAmountsForLiquidity(sqrtP, getSqrtRatioAtTick(-600), getSqrtRatioAtTick(600), L);
  for (const pct of [25, 50, 75, 100]) {
    const q = quoteRemove(sqrtP, -600, 600, L, pct, 50);
    assert.equal(q.liquidity, (L * BigInt(pct)) / 100n);
    assert.ok(q.amount0Min <= q.amount0 && q.amount1Min <= q.amount1);
    if (pct === 100) assert.deepEqual([q.amount0, q.amount1], full);
  }
});
