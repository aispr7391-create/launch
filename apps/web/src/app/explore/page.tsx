import type { Metadata } from "next";
import { ModulePending } from "@/components/modules/ModulePending";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <ModulePending moduleKey="explore" />;
}
