import type { Metadata } from "next";
import { ModulePending } from "@/components/modules/ModulePending";

export const metadata: Metadata = { title: "Stake" };

export default function StakePage() {
  return <ModulePending moduleKey="stake" />;
}
