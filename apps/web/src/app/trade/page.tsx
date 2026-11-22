import type { Metadata } from "next";
import { ModulePending } from "@/components/modules/ModulePending";

export const metadata: Metadata = { title: "Trade" };

export default function TradePage() {
  return <ModulePending moduleKey="trade" />;
}
