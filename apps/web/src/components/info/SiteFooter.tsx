import Link from "next/link";
import { BRAND } from "@/config/brand";
import { robinhoodChain } from "@/config/chains";
import { LEARN_PAGES } from "@/content/site";
import { LogoMark } from "@/components/ui/Logo";

const PRODUCT = [
  { href: "/launch", label: "Launch" },
  { href: "/trade", label: "Trade" },
  { href: "/pools", label: "Pools" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/analytics", label: "Analytics" },
  { href: "/network", label: "Status" },
];

export function SiteFooter() {
  const learn = LEARN_PAGES.slice(0, 4);
  const trust = LEARN_PAGES.slice(4);
  const cols = [
    { title: "Product", links: PRODUCT },
    { title: "Learn", links: learn },
    { title: "Trust", links: trust },
  ];
  return (
    <footer className="border-t border-line bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-12 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:pb-12">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span
              className="text-[15px] tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-brand), var(--font-ui), sans-serif",
                backgroundImage: "linear-gradient(90deg, var(--color-fg), var(--color-accent-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {BRAND.name}
            </span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-5 text-muted">{BRAND.description}</p>
          <p className="mt-4 text-[12px] text-faint">
            Built for {robinhoodChain.name} Mainnet · Chain ID <span className="num">{robinhoodChain.id}</span>
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13px] text-muted transition hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="border-t border-line pt-6 text-[12px] leading-5 text-faint lg:col-span-4">
          {BRAND.name} is an independent project and is not affiliated with, endorsed by or operated by Robinhood. DeFi carries risk,
          including the loss of funds. Nothing on this site is financial advice. © {new Date().getFullYear()} {BRAND.name}.
        </div>
      </div>
    </footer>
  );
}
