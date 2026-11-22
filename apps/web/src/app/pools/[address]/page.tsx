import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { PoolDetail } from "@/features/pools/components/PoolDetail";

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  return { title: isAddress(address) ? `Pool ${address.slice(0, 8)}…` : "Pool" };
}

export default async function PoolPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  return <PoolDetail address={getAddress(address)} />;
}
