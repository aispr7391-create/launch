import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { Swap } from "@/features/trade/components/Swap";

export const metadata: Metadata = { title: "Trade" };

export default function TradePage() {
  return (
    <div className="animate-rise">
      <PageHeader title="Trade" description="Swap ETH and tokens through the official Uniswap v3 contracts on Robinhood Chain Mainnet." />
      <Swap />
    </div>
  );
}
