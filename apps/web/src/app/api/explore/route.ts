import { NextResponse } from "next/server";
import { isStorageConfigured, selectRows } from "@/lib/server/supabase";
import type { IndexedPool } from "@/features/pools/types";
import { tokenPriceEth } from "@/features/explore/price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ExploreRow extends IndexedPool {
  /** Non-WETH token of a WETH pair, its current price in ETH, and its 24h change. Null for non-WETH pairs. */
  token: { symbol: string; address: string; priceEth: number } | null;
  change24h: number | null;
}

const COLS = "pool_stats?select=*";

/**
 * Token-discovery lists for /explore, built only from indexed Uniswap v3 events.
 * 24h change = current pool price vs. the price after the first indexed swap in the last 24 hours
 * (WETH pairs only). Nothing is estimated: pools without a swap in that window get no change.
 */
export async function GET() {
  if (!isStorageConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [trending, newest, volume, liquidity, moverCandidates, state] = await Promise.all([
      selectRows<IndexedPool>(`${COLS}&swaps_24h=gt.0&order=volume_eth_24h.desc.nullslast,swaps_24h.desc&limit=25`),
      selectRows<IndexedPool>(`${COLS}&created_block=gt.0&order=created_block.desc&limit=25`),
      selectRows<IndexedPool>(`${COLS}&swaps_24h=gt.0&volume_eth_24h=not.is.null&order=volume_eth_24h.desc&limit=25`),
      selectRows<IndexedPool>(`${COLS}&weth_reserve=gt.0&order=weth_reserve.desc&limit=25`),
      selectRows<IndexedPool>(`${COLS}&swaps_24h=gt.0&weth_side=not.is.null&order=swaps_24h.desc&limit=40`),
      selectRows<{ value: string }>("indexer_state?key=eq.last_block&select=value"),
    ]);

    // First swap price in the window, per candidate pool.
    const firstPrice = new Map<string, string>();
    await Promise.all(
      moverCandidates.map(async (p) => {
        const [first] = await selectRows<{ sqrt_price_x96: string }>(
          `pool_swaps?pool=eq.${p.address}&block_time=gt.${encodeURIComponent(since)}&select=sqrt_price_x96&order=block_time.asc,log_index.asc&limit=1`,
        );
        if (first) firstPrice.set(p.address, first.sqrt_price_x96);
      }),
    );

    const enrich = (p: IndexedPool): ExploreRow => {
      const now = tokenPriceEth(p, p.sqrt_price_x96);
      const then = firstPrice.has(p.address) ? tokenPriceEth(p, firstPrice.get(p.address)!) : null;
      return {
        ...p,
        token: now,
        change24h: now && then && then.priceEth > 0 ? now.priceEth / then.priceEth - 1 : null,
      };
    };

    const movers = moverCandidates.map(enrich).filter((r) => r.change24h !== null);
    return NextResponse.json(
      {
        configured: true,
        indexedThroughBlock: state[0]?.value ?? null,
        trending: trending.map(enrich),
        newest: newest.map(enrich),
        volume: volume.map(enrich),
        liquidity: liquidity.map(enrich),
        gainers: movers.filter((r) => r.change24h! > 0).sort((a, b) => b.change24h! - a.change24h!).slice(0, 15),
        losers: movers.filter((r) => r.change24h! < 0).sort((a, b) => a.change24h! - b.change24h!).slice(0, 15),
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch (err) {
    console.error("[explore]", err);
    return NextResponse.json({ configured: true, error: "Explore data unavailable." }, { status: 502 });
  }
}
