import type { Metadata } from "next";
import { ModulePending } from "@/components/modules/ModulePending";

export const metadata: Metadata = { title: "Creator" };

export default function CreatorPage() {
  return <ModulePending moduleKey="creator" />;
}
