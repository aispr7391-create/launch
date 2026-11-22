import type { Metadata } from "next";
import { PositionsList } from "@/features/pools/components/Positions";

export const metadata: Metadata = { title: "My positions" };

export default function PositionsPage() {
  return <PositionsList />;
}
