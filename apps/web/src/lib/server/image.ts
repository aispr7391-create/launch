import "server-only";
import type { LogoType } from "@/features/launch/validation";

/**
 * Identifies PNG / JPEG / WEBP by magic bytes (never trusts the declared MIME type)
 * and reads pixel dimensions from the header without decoding the image.
 */
export function sniffImage(buf: Uint8Array): { type: LogoType; width: number; height: number } | null {
  const u32be = (o: number) => ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;
  const u16be = (o: number) => (buf[o] << 8) | buf[o + 1];
  const u16le = (o: number) => buf[o] | (buf[o + 1] << 8);
  const u24le = (o: number) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
  const ascii = (o: number, n: number) => String.fromCharCode(...buf.subarray(o, o + n));

  // PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR
  if (buf.length > 24 && buf[0] === 0x89 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") {
    return { type: "image/png", width: u32be(16), height: u32be(20) };
  }

  // JPEG: FF D8, scan for a SOFn marker
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) return null;
      const marker = buf[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2;
        continue;
      }
      const len = u16be(o + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { type: "image/jpeg", height: u16be(o + 5), width: u16be(o + 7) };
      o += 2 + len;
    }
    return null;
  }

  // WEBP: RIFF....WEBP + VP8 / VP8L / VP8X chunk
  if (buf.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ") return { type: "image/webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.subarray(21, 25);
      const width = 1 + (((b[1] & 0x3f) << 8) | b[0]);
      const height = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
      return { type: "image/webp", width, height };
    }
    if (chunk === "VP8X") return { type: "image/webp", width: 1 + u24le(24), height: 1 + u24le(27) };
  }
  return null;
}
