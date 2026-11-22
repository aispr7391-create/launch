import { NextResponse } from "next/server";
import { getAddress, isAddressEqual, isHash, parseEventLogs, type Hash } from "viem";
import { serverClient } from "@/lib/server/chain";
import { isStorageConfigured, publicObjectPrefix, upsertRow } from "@/lib/server/supabase";
import { getContract } from "@/config/contracts";
import { launchpadAbi } from "@/features/launch/abi";
import type { TokenMetadataV1 } from "@/features/launch/validation";

export const runtime = "nodejs";

/**
 * POST { txHash } → { token }
 * Records a launch ONLY after independently verifying it on Robinhood Chain Mainnet:
 *  1. the transaction succeeded and was sent to the PROJECT X launchpad,
 *  2. it emitted TokenCreated from the launchpad,
 *  3. the token address has contract code,
 *  4. the emitted metadataURI is ours and its name/symbol match the on-chain event.
 * The browser's claims are never trusted. Safe to call repeatedly (upsert by token address).
 */
export async function POST(req: Request) {
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  const launchpad = getContract("pxLaunchpad");
  if (!launchpad) return NextResponse.json({ error: "Launchpad is not deployed." }, { status: 503 });

  let txHash: string;
  try {
    txHash = String((await req.json()).txHash ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!isHash(txHash)) return NextResponse.json({ error: "Invalid transaction hash." }, { status: 400 });

  try {
    const receipt = await serverClient.getTransactionReceipt({ hash: txHash as Hash });
    if (receipt.status !== "success") return NextResponse.json({ error: "Transaction reverted." }, { status: 422 });
    if (!receipt.to || !isAddressEqual(receipt.to, launchpad)) {
      return NextResponse.json({ error: "Transaction was not sent to the launchpad." }, { status: 422 });
    }
    const [created] = parseEventLogs({ abi: launchpadAbi, eventName: "TokenCreated", logs: receipt.logs }).filter((l) =>
      isAddressEqual(l.address, launchpad),
    );
    if (!created) return NextResponse.json({ error: "No TokenCreated event in this transaction." }, { status: 422 });

    const token = getAddress(created.args.token);
    const code = await serverClient.getCode({ address: token });
    if (!code || code === "0x") return NextResponse.json({ error: "No contract at token address." }, { status: 422 });

    const uri = created.args.metadataURI;
    if (!uri.startsWith(publicObjectPrefix() + "metadata/")) {
      return NextResponse.json({ error: "Metadata was not created through PROJECT X." }, { status: 422 });
    }
    const metaRes = await fetch(uri, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ error: "Metadata file not found." }, { status: 422 });
    const meta = (await metaRes.json()) as TokenMetadataV1;
    if (meta.name !== created.args.name || meta.symbol !== created.args.symbol) {
      return NextResponse.json({ error: "Metadata does not match the on-chain token." }, { status: 422 });
    }

    const block = await serverClient.getBlock({ blockNumber: receipt.blockNumber });
    await upsertRow(
      "tokens",
      {
        address: token.toLowerCase(),
        chain_id: 4663,
        creator: getAddress(created.args.creator).toLowerCase(),
        name: created.args.name,
        symbol: created.args.symbol,
        total_supply: created.args.supply.toString(),
        decimals: 18,
        description: meta.description,
        image_url: meta.image,
        website: meta.links.website || null,
        x_url: meta.links.x || null,
        telegram: meta.links.telegram || null,
        discord: meta.links.discord || null,
        metadata_uri: uri,
        tx_hash: txHash.toLowerCase(),
        block_number: Number(receipt.blockNumber),
        created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      },
      "address",
    );
    return NextResponse.json({ token });
  } catch (err) {
    console.error("[launch verify]", err);
    return NextResponse.json({ error: "Could not verify the launch yet. Retry in a few seconds." }, { status: 502 });
  }
}
