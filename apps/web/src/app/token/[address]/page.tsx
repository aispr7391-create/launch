import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { TokenDetail } from "@/features/launch/components/TokenDetail";

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  return { title: isAddress(address) ? `Token ${address.slice(0, 8)}…` : "Token" };
}

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  return <TokenDetail address={getAddress(address)} />;
}
