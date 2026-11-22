/** Inclusive [from, to] split into chunks of at most `size` blocks. */
export function chunkRanges(from: bigint, to: bigint, size: bigint): [bigint, bigint][] {
  if (size <= 0n) throw new Error("size must be > 0");
  const out: [bigint, bigint][] = [];
  for (let a = from; a <= to; a += size) out.push([a, a + size - 1n > to ? to : a + size - 1n]);
  return out;
}

/** First block at which `deployed(block)` is true (contract code exists), by binary search. */
export async function binarySearchDeployBlock(deployed: (b: bigint) => Promise<boolean>, head: bigint): Promise<bigint> {
  if (!(await deployed(head))) throw new Error("Contract not deployed at head");
  let lo = 0n;
  let hi = head;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (await deployed(mid)) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}
