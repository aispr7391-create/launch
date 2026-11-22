/**
 * Uniswap v3 routing and quoting on Robinhood Chain Mainnet.
 *
 * Candidate routes: every initialised, liquid official pool for A→B (all fee tiers), plus
 * two-hop routes through WETH when neither side is WETH. Each candidate is quoted with the
 * official QuoterV2 (eth_call); the route with the highest output wins. Nothing is estimated
 * locally except the mid-price reference used for price impact.
 */
import { encodeFunctionData, encodePacked, isAddressEqual, type Address, type Hex, type PublicClient } from "viem";
import { requireContract } from "@/config/contracts";
import { findPairPools, type PoolState } from "@/features/pools/onchain";
import { quoterV2Abi, ROUTER_ADDRESS_THIS, swapRouter02Abi } from "./abi";
import { midAmountOut, type Hop } from "./math";

export interface RouteHop extends Hop {
  pool: PoolState;
  tokenIn: Address;
  tokenOut: Address;
}

export interface Quote {
  hops: RouteHop[];
  amountIn: bigint;
  amountOut: bigint;
  midOut: bigint;
  gasEstimate: bigint;
  quotedAt: number;
}

const toHop = (pool: PoolState, tokenIn: Address): RouteHop => {
  const zeroForOne = isAddressEqual(pool.token0.address, tokenIn);
  return {
    pool,
    tokenIn,
    tokenOut: zeroForOne ? pool.token1.address : pool.token0.address,
    zeroForOne,
    fee: pool.fee,
    sqrtPriceX96: pool.sqrtPriceX96,
  };
};

const liquid = (p: { state: PoolState | null }) => p.state !== null && p.state.liquidity > 0n;

export async function findRoutes(client: PublicClient, tokenIn: Address, tokenOut: Address): Promise<RouteHop[][]> {
  if (isAddressEqual(tokenIn, tokenOut)) return [];
  const weth = requireContract("weth");
  const direct = (await findPairPools(client, tokenIn, tokenOut)).filter(liquid).map((p) => [toHop(p.state!, tokenIn)]);
  if (isAddressEqual(tokenIn, weth) || isAddressEqual(tokenOut, weth)) return direct;

  const [first, second] = await Promise.all([findPairPools(client, tokenIn, weth), findPairPools(client, weth, tokenOut)]);
  const viaWeth: RouteHop[][] = [];
  for (const a of first.filter(liquid)) {
    for (const b of second.filter(liquid)) viaWeth.push([toHop(a.state!, tokenIn), toHop(b.state!, weth)]);
  }
  return [...direct, ...viaWeth];
}

export function encodePath(hops: RouteHop[]): Hex {
  const types: ("address" | "uint24")[] = ["address"];
  const values: (Address | number)[] = [hops[0].tokenIn];
  for (const h of hops) {
    types.push("uint24", "address");
    values.push(h.fee, h.tokenOut);
  }
  // Dynamic-length path: erase the tuple generics of encodePacked.
  return encodePacked(types as never, values as never);
}

async function quoteRoute(client: PublicClient, hops: RouteHop[], amountIn: bigint): Promise<Quote> {
  const quoter = requireContract("uniswapV3QuoterV2");
  let amountOut: bigint;
  let gasEstimate: bigint;
  if (hops.length === 1) {
    const h = hops[0];
    const { result } = await client.simulateContract({
      address: quoter,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: h.tokenIn, tokenOut: h.tokenOut, amountIn, fee: h.fee, sqrtPriceLimitX96: 0n }],
    });
    [amountOut, , , gasEstimate] = result;
  } else {
    const { result } = await client.simulateContract({
      address: quoter,
      abi: quoterV2Abi,
      functionName: "quoteExactInput",
      args: [encodePath(hops), amountIn],
    });
    [amountOut, , , gasEstimate] = result;
  }
  return { hops, amountIn, amountOut, midOut: midAmountOut(amountIn, hops), gasEstimate, quotedAt: Date.now() };
}

export class NoRouteError extends Error {}

/** Best exact-input quote across all candidate routes. */
export async function bestQuote(client: PublicClient, tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<Quote> {
  const routes = await findRoutes(client, tokenIn, tokenOut);
  if (!routes.length) throw new NoRouteError("No Uniswap v3 pool with liquidity connects these tokens on Robinhood Chain.");
  const settled = await Promise.allSettled(routes.map((r) => quoteRoute(client, r, amountIn)));
  const ok = settled.filter((s): s is PromiseFulfilledResult<Quote> => s.status === "fulfilled").map((s) => s.value);
  if (!ok.length) throw new NoRouteError("Every route failed to quote: the amount is likely larger than available liquidity.");
  return ok.reduce((best, q) => (q.amountOut > best.amountOut ? q : best));
}

export interface SwapCall {
  functionName: "multicall";
  args: readonly [bigint, readonly Hex[]];
  value: bigint;
}

/**
 * SwapRouter02 calls for an exact-input swap.
 * - ETH in: msg.value = amountIn; the router wraps it (tokenIn of the route is WETH).
 * - ETH out: output goes to the router (ADDRESS_THIS), then unwrapWETH9(minOut, user).
 * - Deadline enforced by multicall(deadline, …).
 */
export function planSwap(p: {
  hops: RouteHop[];
  amountIn: bigint;
  minOut: bigint;
  recipient: Address;
  deadline: bigint;
  nativeIn: boolean;
  nativeOut: boolean;
}): SwapCall {
  const to = p.nativeOut ? ROUTER_ADDRESS_THIS : p.recipient;
  const swap =
    p.hops.length === 1
      ? encodeFunctionData({
          abi: swapRouter02Abi,
          functionName: "exactInputSingle",
          args: [{ tokenIn: p.hops[0].tokenIn, tokenOut: p.hops[0].tokenOut, fee: p.hops[0].fee, recipient: to, amountIn: p.amountIn, amountOutMinimum: p.minOut, sqrtPriceLimitX96: 0n }],
        })
      : encodeFunctionData({
          abi: swapRouter02Abi,
          functionName: "exactInput",
          args: [{ path: encodePath(p.hops), recipient: to, amountIn: p.amountIn, amountOutMinimum: p.minOut }],
        });
  const calls: Hex[] = [swap];
  if (p.nativeOut) calls.push(encodeFunctionData({ abi: swapRouter02Abi, functionName: "unwrapWETH9", args: [p.minOut, p.recipient] }));
  return { functionName: "multicall", args: [p.deadline, calls], value: p.nativeIn ? p.amountIn : 0n };
}
