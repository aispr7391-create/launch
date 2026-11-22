import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PositionDetail } from "@/features/pools/components/Positions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Position #${(await params).id}` };
}

export default async function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,30}$/.test(id)) notFound();
  return <PositionDetail tokenId={BigInt(id)} />;
}
