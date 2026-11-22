/**
 * Exact BigInt replica of CurveMath + BondingCurveLaunchpad buy/sell accounting.
 * Lets the curve maths be checked without a Solidity toolchain:  npx tsx sim/curve-sim.ts
 */
const BPS = 10_000n;
const mulDiv = (a: bigint, b: bigint, d: bigint) => (a * b) / d;
const mulDivUp = (a: bigint, b: bigint, d: bigint) => (a * b + d - 1n) / d;
const E = 10n ** 18n;

type L = { x: bigint; v: bigint; realEth: bigint; curveLeft: bigint; curveSupply: bigint; lp: bigint; fees: bigint; graduated: boolean };

function split(S: bigint, v0: bigint, R: bigint, toLp: bigint) {
  const a = R * (v0 + R);
  const C = mulDiv(S, a, a + toLp * v0);
  return { C, Lp: S - C, x0: mulDiv(v0 + R, C, R) };
}

function launch(S: bigint, v0: bigint, R: bigint, gradFee: bigint): L {
  const { C, Lp, x0 } = split(S, v0, R, R - gradFee);
  return { x: x0, v: v0, realEth: 0n, curveLeft: C, curveSupply: C, lp: Lp, fees: 0n, graduated: false };
}

function buy(l: L, value: bigint, feeBps: bigint) {
  let fee = (value * feeBps) / BPS;
  let ethIn = value - fee;
  let out = mulDiv(l.x, ethIn, l.v + ethIn);
  let refund = 0n;
  if (out >= l.curveLeft) {
    out = l.curveLeft;
    ethIn = mulDivUp(l.v, out, l.x - out);
    fee = mulDivUp(ethIn, feeBps, BPS - feeBps);
    if (ethIn + fee > value) fee = value - ethIn;
    refund = value - ethIn - fee;
  }
  if (out === 0n) throw new Error("ZeroAmount");
  l.x -= out; l.v += ethIn; l.realEth += ethIn; l.curveLeft -= out; l.fees += fee;
  if (l.curveLeft === 0n) l.graduated = true;
  return { out, refund, ethIn, fee };
}

function sell(l: L, amt: bigint, feeBps: bigint) {
  const gross = mulDiv(l.v, amt, l.x + amt);
  if (gross > l.realEth) throw new Error("InsufficientReserve");
  const fee = (gross * feeBps) / BPS;
  l.x += amt; l.v -= gross; l.realEth -= gross; l.curveLeft += amt; l.fees += fee;
  return gross - fee;
}

let rng = 12345n;
const rand = (n: bigint) => { rng = (rng * 6364136223846793005n + 1442695040888963407n) % (1n << 64n); return rng % n; };

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log("FAIL:", msg); } };

const configs = [
  { S: 1_000_000_000n * E, v0: 15n * E / 10n, R: 4n * E, gf: 2n * E / 10n, fee: 100n },
  { S: 1_000_000n * E, v0: 1n * E, R: 10n * E, gf: 1n * E / 2n, fee: 200n },
  { S: 1_000_000_000_000n * E, v0: 3n * E, R: 25n * E / 10n, gf: 0n, fee: 0n },
];

for (const c of configs) {
  // 1) Split sums to supply; end price == LP price.
  const l = launch(c.S, c.v0, c.R, c.gf);
  check(l.curveSupply + l.lp === c.S, "split sums to supply");
  const k0 = l.x * l.v;

  // 2) Random trading keeps solvency and k non-decreasing.
  let holdings = 0n;
  for (let i = 0; i < 4000 && !l.graduated; i++) {
    if (rand(3n) === 0n && holdings > 0n) {
      const amt = (holdings * (rand(100n) + 1n)) / 100n;
      if (amt === 0n) continue;
      sell(l, amt, c.fee); holdings -= amt;
    } else {
      const r = buy(l, rand(c.R / 20n) + 10n ** 9n, c.fee); holdings += r.out;
    }
    check(l.v - c.v0 === l.realEth, `v - v0 == realEth (i=${i})`);
    check(l.realEth >= 0n, "realEth >= 0");
    check(l.x * l.v >= k0, `k non-decreasing (i=${i})`);
    check(holdings === l.curveSupply - l.curveLeft, "holdings == sold");
  }

  // 3) Everyone sells back → reserve never goes negative.
  const l2 = launch(c.S, c.v0, c.R, c.gf);
  const parts: bigint[] = [];
  for (let i = 0; i < 50; i++) parts.push(buy(l2, c.R / 60n, c.fee).out);
  for (const p of parts.reverse()) sell(l2, p, c.fee);
  check(l2.realEth >= 0n && l2.curveLeft === l2.curveSupply, "full sell-back solvent");

  // 4) Completing the curve: raised ≈ target, price continuity.
  const l3 = launch(c.S, c.v0, c.R, c.gf);
  const fin = buy(l3, c.R * 3n, c.fee);
  check(l3.graduated, "graduates on big buy");
  const toLp = l3.realEth - c.gf;
  const curveP = Number(l3.v) / Number(l3.x);
  const lpP = Number(toLp) / Number(l3.lp);
  const jump = Math.abs(lpP / curveP - 1);
  const raisedErr = Number(l3.realEth - c.R) / Number(c.R);
  check(jump < 1e-9, `price jump ${jump}`);
  check(raisedErr >= 0 && raisedErr < 1e-12, `raised vs target err ${raisedErr}`);
  console.log(
    `S=${c.S / E} v0=${Number(c.v0) / 1e18} R=${Number(c.R) / 1e18}: curve ${(Number(l.curveSupply * 10000n / c.S) / 100).toFixed(2)}% / LP ${(Number(l.lp * 10000n / c.S) / 100).toFixed(2)}%, ` +
    `final-buy refund ${(Number(fin.refund) / 1e18).toFixed(4)} ETH, price jump ${jump.toExponential(2)}, raised-target ${raisedErr.toExponential(2)}`,
  );
}
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);
