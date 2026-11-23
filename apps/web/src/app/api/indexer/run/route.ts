import { NextResponse } from "next/server";
import { isStorageConfigured, keyProblem } from "@/lib/server/supabase";
import { runIndexStep } from "@/lib/server/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs one bounded indexer step (≈45 s). Called every few minutes by
 * .github/workflows/indexer.yml. Idempotent and soft-locked, so extra calls are harmless.
 * If CRON_SECRET is set, callers must send `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ status: "not_configured" }, { status: 503 });
  }
  const problem = keyProblem();
  if (problem) return NextResponse.json({ status: "error", error: problem }, { status: 500 });
  try {
    const result = await runIndexStep(45_000);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[indexer]", err);
    return NextResponse.json({ status: "error", error: err instanceof Error ? err.message.slice(0, 300) : "Indexer failed" }, { status: 500 });
  }
}
