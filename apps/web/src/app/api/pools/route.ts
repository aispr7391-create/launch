import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { countRows, isStorageConfigured, selectRows } from "@/lib/server/supabase";
import type { IndexedPool } from "@/features/pools/types";

export const runtime = "nodejs";

/**
 * GET → pools discovered by the indexer (services/market-data) from the official Uniswap v3
 * factory's PoolCreated events, with 24h stats computed from indexed Swap events.
 * Query: q (symbol/address search), token (address), fee, sort = weth_reserve | volume_eth_24h | created
 */
export async function GET(req: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ configured: false, pools: [] }, { status: 503 });
  }
  const sp = new URL(req.url).searchParams;
  const filters: string[] = [];
  const q = (sp.get("q") ?? "").trim();
  if (q) {
    if (isAddress(q)) {
      const a = q.toLowerCase();
      filters.push(`or=(address.eq.${a},token0.eq.${a},token1.eq.${a})`);
    } else {
      const safe = q.replace(/[^a-zA-Z0-9$_-]/g, "").slice(0, 20);
      if (safe) filters.push(`or=(symbol0.ilike.*${safe}*,symbol1.ilike.*${safe}*)`);
    }
  }
  const token = sp.get("token");
  if (token && isAddress(token)) filters.push(`or=(token0.eq.${token.toLowerCase()},token1.eq.${token.toLowerCase()})`);
  const fee = Number(sp.get("fee"));
  if ([100, 500, 3000, 10000].includes(fee)) filters.push(`fee=eq.${fee}`);
  const sort = sp.get("sort");
  const order =
    sort === "volume_eth_24h" ? "volume_eth_24h.desc.nullslast" : sort === "created" ? "created_block.desc" : "weth_reserve.desc.nullslast";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 100) || 100));

  try {
    const pools = await selectRows<IndexedPool>(`pool_stats?select=*&${filters.join("&")}${filters.length ? "&" : ""}order=${order}&limit=${limit}`);
    const [[meta], total] = await Promise.all([
      selectRows<{ value: string }>("indexer_state?key=eq.last_block&select=value"),
      countRows("pools"),
    ]);
    return NextResponse.json({ configured: true, pools, total, indexedThroughBlock: meta?.value ?? null }, { headers: { "Cache-Control": "public, max-age=15" } });
  } catch (err) {
    console.error("[pools list]", err);
    return NextResponse.json({ configured: true, error: "Pool index unavailable.", pools: [] }, { status: 502 });
  }
}
