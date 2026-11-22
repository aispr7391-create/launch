import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { isStorageConfigured, selectRows } from "@/lib/server/supabase";

export const runtime = "nodejs";

/**
 * GET → indexed price points (from actual Swap events' sqrtPriceX96) and liquidity events.
 * Only data the indexer recorded from chain logs; empty when the pool has not been indexed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  if (!isStorageConfigured()) return NextResponse.json({ configured: false, swaps: [], liquidity: [] }, { status: 503 });
  const a = address.toLowerCase();
  try {
    const [swaps, liquidity] = await Promise.all([
      selectRows<{ block_time: string; sqrt_price_x96: string; amount0: string; amount1: string }>(
        `pool_swaps?pool=eq.${a}&select=block_time,sqrt_price_x96,amount0,amount1&order=block_number.desc,log_index.desc&limit=1000`,
      ),
      selectRows<{ block_time: string; kind: string; liquidity: string; amount0: string; amount1: string }>(
        `pool_liquidity_events?pool=eq.${a}&select=block_time,kind,liquidity,amount0,amount1&order=block_number.desc&limit=500`,
      ),
    ]);
    return NextResponse.json({ configured: true, swaps: swaps.reverse(), liquidity: liquidity.reverse() }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (err) {
    console.error("[pool history]", err);
    return NextResponse.json({ configured: true, error: "Index unavailable.", swaps: [], liquidity: [] }, { status: 502 });
  }
}
