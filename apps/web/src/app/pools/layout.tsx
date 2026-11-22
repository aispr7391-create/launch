import { PageHeader } from "@/components/ui/primitives";
import { PoolsNav } from "@/features/pools/components/ui";

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-rise">
      <PageHeader title="Liquidity" description="Provide liquidity to official Uniswap v3 pools on Robinhood Chain Mainnet and manage your positions." />
      <PoolsNav />
      {children}
    </div>
  );
}
