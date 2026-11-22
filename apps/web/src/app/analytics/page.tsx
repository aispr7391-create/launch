import type { Metadata } from "next";
import { ModulePending } from "@/components/modules/ModulePending";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <ModulePending moduleKey="analytics" />;
}
