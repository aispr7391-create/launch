import type { Metadata } from "next";
import { Suspense } from "react";
import { AddLiquidity } from "@/features/pools/components/AddLiquidity";

export const metadata: Metadata = { title: "Add liquidity" };

export default function AddLiquidityPage() {
  return (
    <Suspense>
      <AddLiquidity />
    </Suspense>
  );
}
