import Link from "next/link";
import { BRAND } from "@/config/brand";

/** Placeholder mark. Replace with the final logo; the rest of the app only uses <Logo />. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#172338" stroke="#293a52" />
        <path d="M10 10l12 12" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
        <path d="M22 10 10 22" stroke="#f1f5fc" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {!compact && <span className="text-[15px] font-semibold tracking-[0.06em]">{BRAND.name}</span>}
    </Link>
  );
}
