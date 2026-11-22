"use client";

import type { SocialLinks } from "./validation";

export class UploadError extends Error {
  constructor(message: string, public readonly status?: number, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UploadedLogo {
  url: string;
  width: number;
  height: number;
}

/** Upload the logo with real progress events (fetch has no upload progress). */
export function uploadLogo(file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<UploadedLogo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/logo");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = xhr.response as { url?: string; width?: number; height?: number; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) {
        onProgress(100);
        resolve({ url: body.url, width: body.width ?? 0, height: body.height ?? 0 });
      } else {
        reject(new UploadError(body?.error ?? `Logo upload failed (${xhr.status}).`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError("Network error while uploading the logo."));
    xhr.onabort = () => reject(new UploadError("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export async function uploadMetadata(input: {
  name: string;
  symbol: string;
  description: string;
  image: string;
  links: SocialLinks;
  creator: string;
}): Promise<string> {
  const res = await fetch("/api/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as { uri?: string; error?: string; fields?: Record<string, string> };
  if (!res.ok || !body.uri) throw new UploadError(body.error ?? `Metadata upload failed (${res.status}).`, res.status, body.fields);
  return body.uri;
}

/** Ask the server to verify the launch on-chain and record it. */
export async function recordLaunch(txHash: string): Promise<string> {
  const res = await fetch("/api/launches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new UploadError(body.error ?? `Saving launch failed (${res.status}).`, res.status);
  return body.token;
}
