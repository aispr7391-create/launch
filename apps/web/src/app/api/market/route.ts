import { NextResponse } from "next/server";
import { isStorageConfigured, selectRows } from "@/lib/server/supabase";
import { serverClient } from "@/lib/server/chain";
import type { IndexedPool } from "@/features/pools/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Market overview built only from indexed on-chain events (see lib/server/indexer.ts). */
export async function GET() {
  if (!isStorageConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  try {
    const [trending, newest, all, state, head] = await Promise.all([
      selectRows<IndexedPool>("pool_stats?select=*&swaps_24h=gt.0&order=volume_eth_24h.desc.nullslast,swaps_24h.desc&limit=5"),
      selectRows<IndexedPool>("pool_stats?select=*&order=created_block.desc&limit=5"),
      selectRows<Pick<IndexedPool, "swaps_24h" | "volume_eth_24h" | "weth_reserve">>("pool_stats?select=swaps_24h,volume_eth_24h,weth_reserve&limit=10000"),
      selectRows<{ key: string; value: string }>("indexer_state?key=in.(last_block)&select=key,value"),
      serverClient.getBlockNumber().catch(() => null),
    ]);
    const last = state.find((s) => s.key === "last_block")?.value ?? null;
    const totals = all.reduce(
      (acc, p) => ({
        pools: acc.pools + 1,
        swaps24h: acc.swaps24h + (p.swaps_24h ?? 0),
        volumeEth24h: acc.volumeEth24h + (p.volume_eth_24h ?? 0),
        wethLocked: acc.wethLocked + (p.weth_reserve ?? 0),
      }),
      { pools: 0, swaps24h: 0, volumeEth24h: 0, wethLocked: 0 },
    );
    const behind = last && head ? Number(head - BigInt(last)) : null;
    return NextResponse.json(
      {
        configured: true,
        indexedThroughBlock: last,
        headBlock: head?.toString() ?? null,
        blocksBehind: behind,
        // "synced" when within ~5 minutes of head (Robinhood Chain produces several blocks per second).
        synced: behind !== null && behind < 2_000,
        totals,
        trending,
        newest,
      },
      { headers: { "Cache-Control": "public, max-age=20" } },
    );
  } catch (err) {
    console.error("[market]", err);
    return NextResponse.json({ configured: true, error: "Market data unavailable." }, { status: 502 });
  }
}
