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
      Authorization: `Bearer ${key}`,
      apikey: key,
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
      Authorization: `Bearer ${key}`,
      apikey: key,
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
    { headers: { Authorization: `Bearer ${key}`, apikey: key }, cache: "no-store" },
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
    headers: { Authorization: `Bearer ${key}`, apikey: key },
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
    headers: { Authorization: `Bearer ${key}`, apikey: key, Prefer: "count=exact" },
    cache: "no-store",
  });
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}
