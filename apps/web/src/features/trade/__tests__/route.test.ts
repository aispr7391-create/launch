// Needs `viem` installed (npm install) — not runnable in environments without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, type Address } from "viem";
import { ROUTER_ADDRESS_THIS, swapRouter02Abi } from "../abi";
import { encodePath, planSwap, type RouteHop } from "../route";

const A = "0x1111111111111111111111111111111111111111" as Address;
const W = "0x2222222222222222222222222222222222222222" as Address;
const B = "0x3333333333333333333333333333333333333333" as Address;
const ME = "0x4444444444444444444444444444444444444444" as Address;
const hop = (tokenIn: Address, tokenOut: Address, fee: number) => ({ tokenIn, tokenOut, fee, zeroForOne: true, sqrtPriceX96: 1n, pool: {} }) as unknown as RouteHop;
const dec = (d: `0x${string}`) => decodeFunctionData({ abi: swapRouter02Abi, data: d });

test("encodePath packs address/fee/address", () => {
  const p = encodePath([hop(A, W, 3000), hop(W, B, 500)]);
  assert.equal(p.length, 2 + 2 * (20 + 3 + 20 + 3 + 20));
  assert.ok(p.toLowerCase().startsWith("0x" + "11".repeat(20) + "000bb8" + "22".repeat(20) + "0001f4"));
});

test("ETH in → token: value set, single exactInputSingle to the user", () => {
  const c = planSwap({ hops: [hop(W, B, 3000)], amountIn: 10n, minOut: 9n, recipient: ME, deadline: 5n, nativeIn: true, nativeOut: false });
  assert.equal(c.value, 10n);
  assert.equal(c.args[0], 5n);
  const [s] = c.args[1].map(dec);
  assert.equal(s.functionName, "exactInputSingle");
  assert.equal((s.args as any)[0].recipient, ME);
  assert.equal((s.args as any)[0].amountOutMinimum, 9n);
});

test("token → ETH: output to router, then unwrapWETH9(minOut, user)", () => {
  const c = planSwap({ hops: [hop(B, W, 3000)], amountIn: 10n, minOut: 9n, recipient: ME, deadline: 5n, nativeIn: false, nativeOut: true });
  assert.equal(c.value, 0n);
  const calls = c.args[1].map(dec);
  assert.deepEqual(calls.map((x) => x.functionName), ["exactInputSingle", "unwrapWETH9"]);
  assert.equal((calls[0].args as any)[0].recipient, ROUTER_ADDRESS_THIS);
  assert.deepEqual(calls[1].args, [9n, ME]);
});

test("token → token via WETH uses exactInput with a path", () => {
  const c = planSwap({ hops: [hop(A, W, 3000), hop(W, B, 500)], amountIn: 10n, minOut: 1n, recipient: ME, deadline: 5n, nativeIn: false, nativeOut: false });
  const [s] = c.args[1].map(dec);
  assert.equal(s.functionName, "exactInput");
});
