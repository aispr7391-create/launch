import { NextResponse } from "next/server";
import { isStorageConfigured, selectRows } from "@/lib/server/supabase";

export const runtime = "nodejs";

/** GET ?limit= → most recent verified PROJECT X launches (address, symbol, name, image). */
export async function GET(req: Request) {
  if (!isStorageConfigured()) return NextResponse.json([], { status: 200, headers: { "x-storage": "unconfigured" } });
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50));
  try {
    const rows = await selectRows(`tokens?select=address,symbol,name,image_url,created_at&order=created_at.desc&limit=${limit}`);
    return NextResponse.json(rows, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (err) {
    console.error("[tokens list]", err);
    return NextResponse.json({ error: "Database unavailable." }, { status: 502 });
  }
}
