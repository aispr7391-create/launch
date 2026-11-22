import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { LaunchForm } from "@/features/launch/components/LaunchForm";

export const metadata: Metadata = { title: "Launch token" };

export default function LaunchPage() {
  return (
    <div className="animate-rise">
      <PageHeader
        title="Launch a token"
        description="Create a token on a bonding curve on Robinhood Chain Mainnet. It moves to Uniswap v3 automatically when the curve completes."
      />
      <LaunchForm />
    </div>
  );
}
