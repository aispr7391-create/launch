import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { InfoBlock, InfoPage, Prose } from "@/components/info/InfoPage";
import { EcosystemGrid } from "@/components/info/Blocks";

export const metadata: Metadata = { title: "Ecosystem", description: `Every ${BRAND.name} product and its current status.` };

export default function EcosystemPage() {
  return (
    <InfoPage
      current="/ecosystem"
      eyebrow="Ecosystem"
      title="Six products, one connected flow."
      lead="A token can be launched, traded, pooled and tracked without leaving the platform. Each product shows its real status — Live, Partial or Not built."
    >
      <InfoBlock title="Products">
        <EcosystemGrid detailed />
      </InfoBlock>
      <InfoBlock title="How the pieces connect">
        <Prose>
          <p>
            A token starts on the <strong>Launchpad</strong> bonding curve. When the curve sells out, it graduates to a{" "}
            <strong>Uniswap v3</strong> pool, where it can be <strong>traded</strong> and where anyone can add <strong>liquidity</strong>.
            Your balances and positions appear in <strong>Portfolio</strong>, and market-wide numbers appear in <strong>Analytics</strong>.
          </p>
          <p>
            Status labels come from the same configuration that drives the app itself, so this page cannot claim more than the product
            delivers.
          </p>
        </Prose>
      </InfoBlock>
    </InfoPage>
  );
}
