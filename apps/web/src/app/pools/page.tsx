import type { Metadata } from "next";
import { PoolsOverview } from "@/features/pools/components/Overview";

export const metadata: Metadata = { title: "Liquidity" };

export default function PoolsPage() {
  return <PoolsOverview />;
}
