import "server-only";

/**
 * Minimal Supabase client over REST (Storage + PostgREST), server-side only.
 * Uses the service-role key, which must never reach the browser.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Schema + bucket: supabase/migrations/0001_tokens.sql
 */

export const ASSET_BUCKET = "token-assets";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
    this.name = "StorageNotConfiguredError";
  }
}

function env() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageNotConfiguredError();
  return { url, key };
}

/**
 * Legacy keys are JWTs and go in both headers. New-format keys (sb_secret_…) are not JWTs:
 * they must be sent only as `apikey`, and the gateway maps them to the service role.
 */
export function authHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_") ? { apikey: key } : { Authorization: `Bearer ${key}`, apikey: key };
}

/** Publishable/anon keys cannot write (RLS); catch the common mix-up with a clear message. */
export function keyProblem(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (key.startsWith("sb_publishable_")) return "SUPABASE_SERVICE_ROLE_KEY is a publishable key. Use the secret key (sb_secret_…) or the legacy service_role key.";
  if (key.startsWith("eyJ")) {
    try {
      const role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role;
      if (role && role !== "service_role") return `SUPABASE_SERVICE_ROLE_KEY has role "${role}". Use the service_role key.`;
    } catch {
      /* not a JWT we can read; let the request decide */
    }
  }
  return null;
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function publicObjectPrefix(): string {
  return `${env().url}/storage/v1/object/public/${ASSET_BUCKET}/`;
}

/** Upload (idempotent: paths are content hashes) and return the public URL. */
export async function uploadObject(path: string, body: ArrayBuffer | Uint8Array | string, contentType: string): Promise<string> {
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/${ASSET_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(key),
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${await res.text().catch(() => "")}`);
  return `${publicObjectPrefix()}${path}`;
}

export async function upsertRow<T extends object>(table: string, row: T, onConflict: string): Promise<void> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      ...authHeaders(key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Database write failed (${res.status}): ${await res.text().catch(() => "")}`);
}

export async function selectOne<T>(table: string, column: string, value: string): Promise<T | null> {
  const { url, key } = env();
  const res = await fetch(
    `${url}/rest/v1/${table}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}&limit=1`,
    { headers: { ...authHeaders(key) }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Database read failed (${res.status})`);
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Raw PostgREST GET, e.g. selectRows("tokens?select=*&order=created_at.desc&limit=50"). */
export async function selectRows<T>(pathAndQuery: string): Promise<T[]> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    headers: { ...authHeaders(key) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Database read failed (${res.status})`);
  return (await res.json()) as T[];
}

/** Exact row count of a table/view via PostgREST's Content-Range header. */
export async function countRows(table: string): Promise<number | null> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    method: "HEAD",
    headers: { ...authHeaders(key), Prefer: "count=exact" },
    cache: "no-store",
  });
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}
