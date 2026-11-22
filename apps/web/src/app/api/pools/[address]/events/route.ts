import { NextResponse } from "next/server";
import { isAddress, getAddress, parseEventLogs } from "viem";
import { serverClient } from "@/lib/server/chain";
import { fetchPool, InvalidPoolError } from "@/features/pools/onchain";
import { v3PoolAbi } from "@/features/pools/abi";

export const runtime = "nodejs";

const CHUNK = 2_000n;
const MAX_CHUNKS = 25;
const WANT = 30;

/**
 * GET ?kind=swap|liquidity → most recent Swap (or Mint/Burn) events of an official Uniswap v3 pool,
 * read directly from Robinhood Chain logs by scanning backwards in bounded chunks.
 * Works without the indexer; reports how many blocks were scanned.
 */
export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  const kind = new URL(req.url).searchParams.get("kind") === "liquidity" ? "liquidity" : "swap";
  const pool = getAddress(address);

  try {
    await fetchPool(serverClient, pool); // throws unless it is a pool of the official factory
  } catch (err) {
    const msg = err instanceof InvalidPoolError ? err.message : "Could not read pool.";
    return NextResponse.json({ error: msg }, { status: err instanceof InvalidPoolError ? 422 : 502 });
  }

  try {
    const head = await serverClient.getBlockNumber();
    const events: { kind: string; blockNumber: string; txHash: string; logIndex: number; owner?: string; sender?: string; amount0: string; amount1: string; liquidity?: string; tickLower?: number; tickUpper?: number; sqrtPriceX96?: string; tick?: number }[] = [];
    let to = head;
    let chunks = 0;
    while (events.length < WANT && chunks < MAX_CHUNKS && to > 0n) {
      const from = to > CHUNK ? to - CHUNK + 1n : 0n;
      const logs = await serverClient.getLogs({ address: pool, fromBlock: from, toBlock: to });
      const parsed = parseEventLogs({ abi: v3PoolAbi, logs, eventName: kind === "swap" ? ["Swap"] : ["Mint", "Burn"] });
      for (const l of parsed.reverse()) {
        const base = { kind: l.eventName, blockNumber: l.blockNumber.toString(), txHash: l.transactionHash, logIndex: l.logIndex };
        if (l.eventName === "Swap") {
          events.push({ ...base, sender: l.args.sender, amount0: l.args.amount0.toString(), amount1: l.args.amount1.toString(), sqrtPriceX96: l.args.sqrtPriceX96.toString(), tick: Number(l.args.tick) });
        } else if (l.eventName === "Mint" || l.eventName === "Burn") {
          events.push({ ...base, owner: l.args.owner, amount0: l.args.amount0.toString(), amount1: l.args.amount1.toString(), liquidity: l.args.amount.toString(), tickLower: Number(l.args.tickLower), tickUpper: Number(l.args.tickUpper) });
        }
      }
      to = from - 1n;
      chunks++;
    }
    const scannedFrom = to + 1n;
    const top = events.slice(0, WANT);
    const blocks = [...new Set(top.map((e) => e.blockNumber))];
    const times = Object.fromEntries(
      await Promise.all(blocks.map(async (b) => [b, Number((await serverClient.getBlock({ blockNumber: BigInt(b) })).timestamp)] as const)),
    );
    return NextResponse.json(
      { events: top.map((e) => ({ ...e, timestamp: times[e.blockNumber] })), scannedFromBlock: scannedFrom.toString(), headBlock: head.toString() },
      { headers: { "Cache-Control": "public, max-age=10" } },
    );
  } catch (err) {
    console.error("[pool events]", err);
    return NextResponse.json({ error: "RPC log query failed. Try again shortly." }, { status: 502 });
  }
}
