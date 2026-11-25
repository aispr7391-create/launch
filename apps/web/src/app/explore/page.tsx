import type { Metadata } from "next";
import { ExploreView } from "@/features/explore/ExploreView";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <ExploreView />;
}
