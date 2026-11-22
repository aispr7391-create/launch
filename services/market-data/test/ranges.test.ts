import { test } from "node:test";
import assert from "node:assert/strict";
import { binarySearchDeployBlock, chunkRanges } from "../src/ranges.ts";

test("chunkRanges covers the range exactly", () => {
  assert.deepEqual(chunkRanges(10n, 25n, 5n), [[10n, 14n], [15n, 19n], [20n, 24n], [25n, 25n]]);
  assert.deepEqual(chunkRanges(5n, 5n, 100n), [[5n, 5n]]);
  assert.deepEqual(chunkRanges(6n, 5n, 100n), []);
});

test("binarySearchDeployBlock finds the first deployed block", async () => {
  for (const deployAt of [0n, 1n, 777n, 1_000_000n]) {
    const got = await binarySearchDeployBlock(async (b) => b >= deployAt, 2_000_000n);
    assert.equal(got, deployAt);
  }
  await assert.rejects(binarySearchDeployBlock(async () => false, 100n));
});
