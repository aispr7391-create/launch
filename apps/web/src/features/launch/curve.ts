/**
 * Exact TypeScript mirror of CurveMath.sol (BigInt, same rounding). Used to show token
 * economics and to quote the optional initial buy before the token exists. Inputs come
 * from the launchpad's on-chain `config()`; nothing here is a hard-coded parameter.
 */

export interface OnchainConfig {
  virtualEth: bigint;
  targetEth: bigint;
  graduationFee: bigint;
  creationFee: bigint;
  tradeFeeBps: number;
  creatorShareBps: number;
}

const BPS = 10_000n;
const WAD = 10n ** 18n;
const mulDiv = (a: bigint, b: bigint, d: bigint) => (a * b) / d;

export function splitSupply(supply: bigint, c: OnchainConfig) {
  const ethToLp = c.targetEth - c.graduationFee;
  const a = c.targetEth * (c.virtualEth + c.targetEth);
  const curveTokens = mulDiv(supply, a, a + ethToLp * c.virtualEth);
  const lpTokens = supply - curveTokens;
  const x0 = mulDiv(c.virtualEth + c.targetEth, curveTokens, c.targetEth);
  return { curveTokens, lpTokens, x0, ethToLp };
}

/** Token economics for a given supply, all derived from on-chain config. */
export function economics(supply: bigint, c: OnchainConfig) {
  const { curveTokens, lpTokens, x0, ethToLp } = splitSupply(supply, c);
  const xEnd = x0 - curveTokens;
  const vEnd = c.virtualEth + c.targetEth;
  // Prices in wei per 1e18 token units.
  const startPrice = mulDiv(c.virtualEth, WAD, x0);
  const endPrice = xEnd > 0n ? mulDiv(vEnd, WAD, xEnd) : 0n;
  return {
    curveTokens,
    lpTokens,
    curvePctBps: Number(mulDiv(curveTokens, BPS, supply)),
    lpPctBps: Number(mulDiv(lpTokens, BPS, supply)),
    startPrice,
    endPrice,
    startMcapWei: mulDiv(startPrice, supply, WAD),
    graduationMcapWei: mulDiv(endPrice, supply, WAD),
    ethToLp,
  };
}

/** Quote the creator's initial buy on a fresh curve (same maths as `_buy`). */
export function quoteInitialBuy(supply: bigint, value: bigint, c: OnchainConfig) {
  if (value <= 0n) return { tokensOut: 0n, fee: 0n, refund: 0n, completesCurve: false };
  const { curveTokens, x0 } = splitSupply(supply, c);
  const feeBps = BigInt(c.tradeFeeBps);
  let fee = (value * feeBps) / BPS;
  let ethIn = value - fee;
  let tokensOut = mulDiv(x0, ethIn, c.virtualEth + ethIn);
  let refund = 0n;
  let completesCurve = false;
  if (tokensOut >= curveTokens) {
    completesCurve = true;
    tokensOut = curveTokens;
    ethIn = (c.virtualEth * tokensOut + (x0 - tokensOut) - 1n) / (x0 - tokensOut);
    fee = (ethIn * feeBps + (BPS - feeBps) - 1n) / (BPS - feeBps);
    if (ethIn + fee > value) fee = value - ethIn;
    refund = value - ethIn - fee;
  }
  return { tokensOut, fee, refund, completesCurve };
}
