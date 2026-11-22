import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, zeroAddress, type Address } from "viem";
import { positionManagerAbi } from "../abi";
import { planCollect, planMint, planRemove, quoteRemove } from "../plan";
import { getAmountsForLiquidity } from "../math/liquidityAmounts";
import { getSqrtRatioAtTick } from "../math/tickMath";

const T0 = "0x1111111111111111111111111111111111111111" as Address;
const T1 = "0x2222222222222222222222222222222222222222" as Address;
const ME = "0x3333333333333333333333333333333333333333" as Address;
const decode = (data: `0x${string}`) => decodeFunctionData({ abi: positionManagerAbi, data });

test("planMint with native ETH: value + refundETH, mins applied", () => {
  const plan = planMint({ token0: T0, token1: T1, fee: 3000, tickLower: -60, tickUpper: 60, amount0: 1000n, amount1: 2000n, slippageBps: 100, recipient: ME, deadline: 9n, nativeSide: 1 });
  assert.equal(plan.value, 2000n);
  const [mint, refund] = plan.args[0].map(decode);
  assert.equal(mint.functionName, "mint");
  const p = (mint.args as any)[0];
  assert.equal(p.amount0Min, 990n);
  assert.equal(p.amount1Min, 1980n);
  assert.equal(p.recipient, ME);
  assert.equal(refund.functionName, "refundETH");
});

test("planMint without ETH has no value and no refund", () => {
  const plan = planMint({ token0: T0, token1: T1, fee: 500, tickLower: -10, tickUpper: 10, amount0: 1n, amount1: 1n, slippageBps: 0, recipient: ME, deadline: 1n, nativeSide: null });
  assert.equal(plan.value, 0n);
  assert.equal(plan.args[0].length, 1);
});

test("quoteRemove 25/50/75/100% and planRemove decodes to decrease + collect", () => {
  const sqrtP = getSqrtRatioAtTick(0);
  const L = 10n ** 20n;
  const full = getAmountsForLiquidity(sqrtP, getSqrtRatioAtTick(-600), getSqrtRatioAtTick(600), L);
  for (const pct of [25, 50, 75, 100]) {
    const q = quoteRemove(sqrtP, -600, 600, L, pct, 50);
    assert.equal(q.liquidity, (L * BigInt(pct)) / 100n);
    assert.ok(q.amount0Min <= q.amount0 && q.amount1Min <= q.amount1);
    if (pct === 100) assert.deepEqual([q.amount0, q.amount1], full);
  }
  const q = quoteRemove(sqrtP, -600, 600, L, 50, 50);
  const calls = planRemove({ tokenId: 7n, quote: q, recipient: ME, deadline: 1n, unwrap: null }).args[0].map(decode);
  assert.deepEqual(calls.map((c) => c.functionName), ["decreaseLiquidity", "collect"]);
  assert.equal((calls[1].args as any)[0].recipient, ME);
});

test("collect as ETH: collect to position manager, then unwrap + sweep", () => {
  const calls = planCollect({ tokenId: 7n, recipient: ME, unwrap: { weth: T1, other: T0 } }).args[0].map(decode);
  assert.deepEqual(calls.map((c) => c.functionName), ["collect", "unwrapWETH9", "sweepToken"]);
  assert.equal((calls[0].args as any)[0].recipient, zeroAddress);
  assert.equal((calls[1].args as any)[1], ME);
  assert.equal((calls[2].args as any)[0], T0);
});
