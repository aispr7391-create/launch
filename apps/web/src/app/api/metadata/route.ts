import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { isStorageConfigured, publicObjectPrefix, sha256Hex, uploadObject } from "@/lib/server/supabase";
import {
  normalizeSymbol,
  validateDetails,
  validateSocials,
  type SocialLinks,
  type TokenMetadataV1,
} from "@/features/launch/validation";

export const runtime = "nodejs";

/**
 * POST JSON { name, symbol, description, image, links, creator } → { uri }
 * Stores a canonical, content-addressed metadata document. Its URL is passed to
 * `createToken(..., metadataURI, ...)`, which emits it on-chain — permanently linking
 * the metadata to the deployed token.
 */
export async function POST(req: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const rawLinks = (body.links ?? {}) as Record<string, unknown>;
  const links: SocialLinks = {
    website: str(rawLinks.website).trim(),
    x: str(rawLinks.x).trim(),
    telegram: str(rawLinks.telegram).trim(),
    discord: str(rawLinks.discord).trim(),
  };
  const details = {
    name: str(body.name).trim(),
    symbol: normalizeSymbol(str(body.symbol)),
    description: str(body.description).trim(),
  };
  const errors = { ...validateDetails(details), ...validateSocials(links) };
  const image = str(body.image);
  if (!image.startsWith(publicObjectPrefix() + "logos/")) errors.image = "Logo must be uploaded through PROJECT X first.";
  const creator = str(body.creator);
  if (!isAddress(creator)) errors.creator = "Invalid creator address.";
  if (Object.keys(errors).length) return NextResponse.json({ error: "Validation failed.", fields: errors }, { status: 422 });

  // Fixed key order → identical input always hashes to the same file.
  const doc: TokenMetadataV1 = {
    schema: "projectx.token.v1",
    chainId: 4663,
    name: details.name,
    symbol: details.symbol,
    description: details.description,
    image,
    links,
    creator: getAddress(creator),
  };
  const json = JSON.stringify(doc);

  try {
    const hash = await sha256Hex(json);
    const uri = await uploadObject(`metadata/${hash}.json`, json, "application/json");
    return NextResponse.json({ uri, hash });
  } catch (err) {
    console.error("[metadata upload]", err);
    return NextResponse.json({ error: "Saving metadata failed. Please try again." }, { status: 502 });
  }
}
