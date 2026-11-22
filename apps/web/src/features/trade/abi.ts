import { parseAbi } from "viem";

/** Uniswap v3-periphery QuoterV2. Its functions are non-view (they revert internally) and are called via eth_call. */
export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
]);

/**
 * Uniswap swap-router-contracts SwapRouter02 (IV3SwapRouter: the param structs have NO deadline;
 * the deadline is enforced by multicall(uint256 deadline, bytes[] data)).
 */
export const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
  "function refundETH() payable",
]);

/** SwapRouter02 Constants.ADDRESS_THIS: keep output in the router (used before unwrapWETH9). */
export const ROUTER_ADDRESS_THIS = "0x0000000000000000000000000000000000000002" as const;
