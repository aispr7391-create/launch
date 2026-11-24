import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { FAQS } from "@/content/site";
import { InfoPage } from "@/components/info/InfoPage";
import { FaqList } from "@/components/info/FaqList";

export const metadata: Metadata = { title: "FAQ", description: `Frequently asked questions about ${BRAND.name}.` };

export default function FaqPage() {
  return (
    <InfoPage current="/faq" eyebrow="FAQ" title="Frequently asked questions." lead="Short, honest answers about SYNORA, Robinhood Chain, wallets, fees and safety.">
      <FaqList items={FAQS} />
      <p className="text-[13px] text-faint">
        Still have a question? See the <Link href="/docs" className="text-accent hover:text-accent-hover">documentation</Link> or the{" "}
        <Link href="/contact" className="text-accent hover:text-accent-hover">community channels</Link>.
      </p>
    </InfoPage>
  );
}
