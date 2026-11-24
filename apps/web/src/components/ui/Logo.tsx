"use client";

import { useId } from "react";
import Link from "next/link";
import { BRAND } from "@/config/brand";

const RINGS = [
  [50, 36],
  [37, 58.5],
  [63, 58.5],
] as const;

/**
 * SYNORA "Halo" mark: three glowing rings meeting at a bright core.
 * Gradient and glow ids come from useId so every instance (sidebar, top bar) renders on its own,
 * even when another instance sits inside a hidden container.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg width={size} height={size} viewBox="8 8 84 84" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fd0ff" />
          <stop offset="0.5" stopColor="#397bff" />
          <stop offset="1" stopColor="#2865e8" />
        </linearGradient>
        <filter id={`${id}-g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {RINGS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="17" fill="none" stroke={`url(#${id}-b)`} strokeWidth="4" filter={`url(#${id}-g)`} />
      ))}
      <circle cx="50" cy="51" r="4.5" fill="#ffffff" filter={`url(#${id}-g)`} />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <LogoMark />
      {!compact && (
        <span
          className="text-[15px] font-normal tracking-[0.14em]"
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
      )}
    </Link>
  );
}
