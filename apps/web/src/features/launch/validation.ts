/**
 * Validation shared by the browser form and the API routes. Limits match the
 * launchpad contract where it enforces one (name ≤ 32 bytes, symbol ≤ 10 bytes, supply bounds).
 */

export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];
export const LOGO_EXTENSIONS: Record<LogoType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_MIN_PX = 128;
export const LOGO_MAX_PX = 4096;
/** Logos are shown in circles and squares; allow mild non-square images only. */
export const LOGO_MAX_ASPECT = 1.25;

export const NAME_MIN = 2;
export const NAME_MAX = 32;
export const SYMBOL_MIN = 2;
export const SYMBOL_MAX = 10;
export const DESCRIPTION_MAX = 500;

/** Contract constants (BondingCurveLaunchpad.MIN_SUPPLY / MAX_SUPPLY), in whole tokens. Re-read on-chain when deployed. */
export const DEFAULT_MIN_SUPPLY = 1_000_000n;
export const DEFAULT_MAX_SUPPLY = 1_000_000_000_000n;

export interface SocialLinks {
  website: string;
  x: string;
  telegram: string;
  discord: string;
}

export interface TokenDetails {
  name: string;
  symbol: string;
  description: string;
}

export type FieldErrors = Partial<Record<string, string>>;

const utf8Length = (s: string) => new TextEncoder().encode(s).length;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

export function normalizeSymbol(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SYMBOL_MAX);
}

export function validateDetails(d: TokenDetails): FieldErrors {
  const e: FieldErrors = {};
  const name = d.name.trim();
  if (!name) e.name = "Token name is required.";
  else if (name.length < NAME_MIN) e.name = `At least ${NAME_MIN} characters.`;
  else if (name.length > NAME_MAX || utf8Length(name) > NAME_MAX) e.name = `At most ${NAME_MAX} characters (bytes).`;
  else if (CONTROL.test(name)) e.name = "Contains invalid characters.";

  if (!d.symbol) e.symbol = "Ticker is required.";
  else if (d.symbol.length < SYMBOL_MIN) e.symbol = `At least ${SYMBOL_MIN} characters.`;
  else if (d.symbol.length > SYMBOL_MAX) e.symbol = `At most ${SYMBOL_MAX} characters.`;
  else if (!/^[A-Z0-9]+$/.test(d.symbol)) e.symbol = "Use letters A–Z and digits only.";

  if (d.description.length > DESCRIPTION_MAX) e.description = `At most ${DESCRIPTION_MAX} characters.`;
  else if (CONTROL.test(d.description.replace(/[\n\r\t]/g, ""))) e.description = "Contains invalid characters.";
  return e;
}

const SOCIAL_HOSTS: Record<keyof SocialLinks, string[] | null> = {
  website: null,
  x: ["x.com", "twitter.com"],
  telegram: ["t.me", "telegram.me"],
  discord: ["discord.gg", "discord.com"],
};

export function validateUrl(value: string, allowedHosts: string[] | null): string | undefined {
  if (!value) return undefined;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "Enter a full URL starting with https://";
  }
  if (u.protocol !== "https:") return "Must start with https://";
  if (u.username || u.password) return "URL must not contain credentials.";
  if (value.length > 200) return "URL is too long.";
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (allowedHosts && !allowedHosts.includes(host)) return `Must be a ${allowedHosts.join(" or ")} link.`;
  if (!allowedHosts && !host.includes(".")) return "Enter a valid domain.";
  if (host === "discord.com" && !u.pathname.startsWith("/invite/")) return "Use a discord.com/invite/… or discord.gg/… link.";
  return undefined;
}

export function validateSocials(s: SocialLinks): FieldErrors {
  const e: FieldErrors = {};
  (Object.keys(SOCIAL_HOSTS) as (keyof SocialLinks)[]).forEach((k) => {
    const err = validateUrl(s[k].trim(), SOCIAL_HOSTS[k]);
    if (err) e[k] = err;
  });
  return e;
}

/** Whole-token supply string → error message, or undefined. */
export function validateSupply(raw: string, min = DEFAULT_MIN_SUPPLY, max = DEFAULT_MAX_SUPPLY): string | undefined {
  const digits = raw.replace(/[,_\s]/g, "");
  if (!digits) return "Total supply is required.";
  if (!/^\d+$/.test(digits)) return "Whole tokens only (no decimals).";
  const n = BigInt(digits);
  if (n < min) return `Minimum ${min.toLocaleString("en-US")} tokens.`;
  if (n > max) return `Maximum ${max.toLocaleString("en-US")} tokens.`;
  return undefined;
}

export function parseSupply(raw: string): bigint | null {
  const digits = raw.replace(/[,_\s]/g, "");
  return /^\d+$/.test(digits) ? BigInt(digits) : null;
}

export function validateEthAmount(raw: string): string | undefined {
  if (!raw) return undefined;
  if (!/^\d*\.?\d*$/.test(raw) || raw === ".") return "Enter an ETH amount, e.g. 0.05";
  const [, frac = ""] = raw.split(".");
  if (frac.length > 18) return "At most 18 decimals.";
  return undefined;
}

/** Checks done on the decoded image (browser: <img>, server: header parsing). */
export function validateLogoDimensions(width: number, height: number): string | undefined {
  if (width < LOGO_MIN_PX || height < LOGO_MIN_PX) return `Image must be at least ${LOGO_MIN_PX}×${LOGO_MIN_PX}px.`;
  if (width > LOGO_MAX_PX || height > LOGO_MAX_PX) return `Image must be at most ${LOGO_MAX_PX}×${LOGO_MAX_PX}px.`;
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > LOGO_MAX_ASPECT) return "Use a square (or nearly square) image.";
  return undefined;
}

export function validateLogoFile(file: { type: string; size: number }): string | undefined {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return "PNG, JPG/JPEG or WEBP only.";
  if (file.size > LOGO_MAX_BYTES) return "Maximum file size is 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return undefined;
}

/** Canonical metadata document stored off-chain and referenced by `metadataURI` on-chain. */
export interface TokenMetadataV1 {
  schema: "projectx.token.v1";
  chainId: 4663;
  name: string;
  symbol: string;
  description: string;
  image: string;
  links: SocialLinks;
  creator: string;
}
