/**
 * Exact NonfungiblePositionManager calls for mint / increase / remove / collect.
 * No I/O — unit-tested in __tests__/plan.test.ts (decodes every call back).
 */
import { encodeFunctionData, zeroAddress, type Address, type Hex } from "viem";
import { MAX_UINT128, positionManagerAbi } from "./abi";
import { withSlippage, type RemoveQuote } from "./quote";

export * from "./quote";

const enc = (functionName: string, args: readonly unknown[]): Hex =>
  encodeFunctionData({ abi: positionManagerAbi, functionName: functionName as never, args: args as never });

export interface PlannedCall {
  functionName: "multicall";
  args: readonly [readonly Hex[]];
  value: bigint;
}

/**
 * New position. If `nativeSide` is set, that side is paid in ETH (msg.value) and the position
 * manager wraps it via WETH9; refundETH returns any unused ETH in the same transaction.
 */
export function planMint(p: {
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
  slippageBps: number;
  recipient: Address;
  deadline: bigint;
  nativeSide: 0 | 1 | null;
}): PlannedCall {
  const calls: Hex[] = [
    enc("mint", [
      {
        token0: p.token0,
        token1: p.token1,
        fee: p.fee,
        tickLower: p.tickLower,
        tickUpper: p.tickUpper,
        amount0Desired: p.amount0,
        amount1Desired: p.amount1,
        amount0Min: withSlippage(p.amount0, p.slippageBps),
        amount1Min: withSlippage(p.amount1, p.slippageBps),
        recipient: p.recipient,
        deadline: p.deadline,
      },
    ]),
  ];
  let value = 0n;
  if (p.nativeSide !== null) {
    value = p.nativeSide === 0 ? p.amount0 : p.amount1;
    calls.push(enc("refundETH", []));
  }
  return { functionName: "multicall", args: [calls], value };
}

export function planIncrease(p: {
  tokenId: bigint;
  amount0: bigint;
  amount1: bigint;
  slippageBps: number;
  deadline: bigint;
  nativeSide: 0 | 1 | null;
}): PlannedCall {
  const calls: Hex[] = [
    enc("increaseLiquidity", [
      {
        tokenId: p.tokenId,
        amount0Desired: p.amount0,
        amount1Desired: p.amount1,
        amount0Min: withSlippage(p.amount0, p.slippageBps),
        amount1Min: withSlippage(p.amount1, p.slippageBps),
        deadline: p.deadline,
      },
    ]),
  ];
  let value = 0n;
  if (p.nativeSide !== null) {
    value = p.nativeSide === 0 ? p.amount0 : p.amount1;
    calls.push(enc("refundETH", []));
  }
  return { functionName: "multicall", args: [calls], value };
}

/** Collect calls; with `wethSide`, WETH is unwrapped to ETH and the other token swept to the user. */
function collectCalls(tokenId: bigint, recipient: Address, unwrap: { weth: Address; other: Address } | null): Hex[] {
  if (!unwrap) return [enc("collect", [{ tokenId, recipient, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }])];
  return [
    // recipient = address(0) → tokens stay in the position manager, then unwrap + sweep to the user
    enc("collect", [{ tokenId, recipient: zeroAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }]),
    enc("unwrapWETH9", [0n, recipient]),
    enc("sweepToken", [unwrap.other, 0n, recipient]),
  ];
}

/** decreaseLiquidity + collect (principal and all fees) in one transaction. */
export function planRemove(p: {
  tokenId: bigint;
  quote: RemoveQuote;
  recipient: Address;
  deadline: bigint;
  unwrap: { weth: Address; other: Address } | null;
}): PlannedCall {
  return {
    functionName: "multicall",
    args: [
      [
        enc("decreaseLiquidity", [
          { tokenId: p.tokenId, liquidity: p.quote.liquidity, amount0Min: p.quote.amount0Min, amount1Min: p.quote.amount1Min, deadline: p.deadline },
        ]),
        ...collectCalls(p.tokenId, p.recipient, p.unwrap),
      ],
    ],
    value: 0n,
  };
}

export function planCollect(p: { tokenId: bigint; recipient: Address; unwrap: { weth: Address; other: Address } | null }): PlannedCall {
  return { functionName: "multicall", args: [collectCalls(p.tokenId, p.recipient, p.unwrap)], value: 0n };
}
