import { test } from "node:test";
import assert from "node:assert/strict";
import { impactLevel, midAmountOut, minimumReceived, priceImpactBps } from "../math";

const Q96 = 1n << 96n;

test("midAmountOut at price 1 applies only the fee", () => {
  assert.equal(midAmountOut(1_000_000n, [{ sqrtPriceX96: Q96, zeroForOne: true, fee: 3000 }]), 997_000n);
  assert.equal(midAmountOut(1_000_000n, [{ sqrtPriceX96: Q96, zeroForOne: false, fee: 500 }]), 999_500n);
});

test("midAmountOut respects direction: price 4 token1 per token0 (sqrt = 2)", () => {
  const s = 2n * Q96;
  assert.equal(midAmountOut(100n, [{ sqrtPriceX96: s, zeroForOne: true, fee: 0 }]), 400n);
  assert.equal(midAmountOut(400n, [{ sqrtPriceX96: s, zeroForOne: false, fee: 0 }]), 100n);
});

test("multi-hop chains prices and fees", () => {
  const out = midAmountOut(1_000_000n, [
    { sqrtPriceX96: 2n * Q96, zeroForOne: true, fee: 3000 }, // ×4, −0.3 %
    { sqrtPriceX96: 2n * Q96, zeroForOne: false, fee: 3000 }, // ÷4, −0.3 %
  ]);
  assert.equal(out, 994_009n);
});

test("zero price yields zero instead of dividing by zero", () => {
  assert.equal(midAmountOut(10n, [{ sqrtPriceX96: 0n, zeroForOne: false, fee: 0 }]), 0n);
});

test("price impact, minimum received, levels", () => {
  assert.equal(priceImpactBps(1_000n, 990n), 100);
  assert.equal(priceImpactBps(1_000n, 1_001n), 0);
  assert.equal(priceImpactBps(0n, 5n), 0);
  assert.equal(minimumReceived(10_000n, 50), 9_950n);
  assert.deepEqual([50, 150, 600, 2000].map(impactLevel), ["low", "medium", "high", "blocked"]);
});
