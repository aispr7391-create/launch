import type { Metadata } from "next";
import { ExplorePools } from "@/features/pools/components/Explore";

export const metadata: Metadata = { title: "Explore pools" };

export default function ExplorePoolsPage() {
  return <ExplorePools />;
}
