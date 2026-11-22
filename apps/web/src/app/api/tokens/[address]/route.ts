import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { isStorageConfigured, selectOne } from "@/lib/server/supabase";
import type { TokenRow } from "@/features/launch/types";

export const runtime = "nodejs";


/** GET → the verified launch record for a token, or 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  try {
    const row = await selectOne<TokenRow>("tokens", "address", address.toLowerCase());
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(row, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (err) {
    console.error("[token read]", err);
    return NextResponse.json({ error: "Database unavailable." }, { status: 502 });
  }
}
