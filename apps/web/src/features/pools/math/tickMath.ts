/**
 * Exact port of Uniswap v3-core TickMath (BigInt). Used to convert between ticks, sqrt prices
 * and human prices for range selection. Verified against the library's boundary constants in tests.
 */

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;
export const Q96 = 1n << 96n;
export const Q192 = 1n << 192n;
const MAX_UINT256 = (1n << 256n) - 1n;

const MULTIPLIERS: [number, bigint][] = [
  [0x2, 0xfff97272373d413259a46990580e213an],
  [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000, 0x48a170391f7dc42444e8fa2n],
];

export function getSqrtRatioAtTick(tick: number): bigint {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) throw new RangeError("tick out of range");
  const absTick = Math.abs(tick);
  let ratio = absTick & 0x1 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  for (const [bit, m] of MULTIPLIERS) if (absTick & bit) ratio = (ratio * m) >> 128n;
  if (tick > 0) ratio = MAX_UINT256 / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/** Greatest tick whose sqrt ratio is ≤ sqrtPriceX96 (same result as TickMath.getTickAtSqrtRatio). */
export function getTickAtSqrtRatio(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 < MIN_SQRT_RATIO || sqrtPriceX96 >= MAX_SQRT_RATIO) throw new RangeError("sqrt price out of range");
  // Float estimate, then exact correction.
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  let tick = Math.floor((2 * Math.log(ratio)) / Math.log(1.0001));
  tick = Math.max(MIN_TICK, Math.min(MAX_TICK, tick));
  while (tick < MAX_TICK && getSqrtRatioAtTick(tick + 1) <= sqrtPriceX96) tick++;
  while (tick > MIN_TICK && getSqrtRatioAtTick(tick) > sqrtPriceX96) tick--;
  return tick;
}

export function nearestUsableTick(tick: number, spacing: number): number {
  const rounded = Math.round(tick / spacing) * spacing;
  const min = Math.ceil(MIN_TICK / spacing) * spacing;
  const max = Math.floor(MAX_TICK / spacing) * spacing;
  return Math.max(min, Math.min(max, rounded));
}

export function fullRangeTicks(spacing: number): [number, number] {
  return [Math.ceil(MIN_TICK / spacing) * spacing, Math.floor(MAX_TICK / spacing) * spacing];
}
