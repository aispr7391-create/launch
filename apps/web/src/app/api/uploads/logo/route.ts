import { NextResponse } from "next/server";
import { sniffImage } from "@/lib/server/image";
import { StorageNotConfiguredError, isStorageConfigured, sha256Hex, uploadObject } from "@/lib/server/supabase";
import { LOGO_EXTENSIONS, LOGO_MAX_BYTES, validateLogoDimensions } from "@/features/launch/validation";

export const runtime = "nodejs";

/**
 * POST multipart/form-data { file } → { url, width, height, type }
 * The image is re-validated here from its bytes (type by magic number, real dimensions),
 * then stored content-addressed so the same logo always gets the same immutable URL.
 *
 * Hosting note: some platforms cap request bodies below 5 MB (e.g. 4.5 MB on Vercel
 * functions). There, switch to Supabase signed upload URLs — see docs/LAUNCH_FLOW.md.
 */
export async function POST(req: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: new StorageNotConfiguredError().message }, { status: 503 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > LOGO_MAX_BYTES) return NextResponse.json({ error: "Maximum file size is 5 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = sniffImage(bytes);
  if (!info) return NextResponse.json({ error: "Not a valid PNG, JPG/JPEG or WEBP image." }, { status: 415 });
  const dimError = validateLogoDimensions(info.width, info.height);
  if (dimError) return NextResponse.json({ error: dimError }, { status: 422 });

  try {
    const hash = await sha256Hex(bytes);
    const url = await uploadObject(`logos/${hash}.${LOGO_EXTENSIONS[info.type]}`, bytes, info.type);
    return NextResponse.json({ url, width: info.width, height: info.height, type: info.type });
  } catch (err) {
    console.error("[logo upload]", err);
    return NextResponse.json({ error: "Upload to storage failed. Please try again." }, { status: 502 });
  }
}

/** GET → whether storage is configured, so the form can say so before the user fills it in. */
export async function GET() {
  return NextResponse.json({ configured: isStorageConfigured() });
}
