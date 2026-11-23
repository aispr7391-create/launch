import type { ModuleKey } from "@/config/modules";

type IconName = ModuleKey | "external" | "copy" | "check" | "close" | "power" | "alert" | "wallet" | "chevron";

const paths: Record<IconName, React.ReactNode> = {
  overview: <path d="M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z" />,
  launch: <path d="M12 2c3 3 4.5 6.5 4.5 10.5L12 17l-4.5-4.5C7.5 8.5 9 5 12 2zM7.5 12.5 4 15l3 1M16.5 12.5 20 15l-3 1M10 19l2 3 2-3" />,
  trade: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  pools: <path d="M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2-1.5 4.5-1.5S19 15 21 15M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19M12 3l4 6a4 4 0 1 1-8 0z" />,
  explore: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />,
  portfolio: <path d="M3 7h18v13H3zM8 7V4h8v3M3 12h18" />,
  creator: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  network: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  copy: <path d="M8 8h12v12H8zM16 8V4H4v12h4" />,
  check: <path d="M5 12l4 4L19 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  power: <path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0" />,
  alert: <path d="M12 3 2 21h20zM12 10v5M12 18v.01" />,
  wallet: <path d="M3 6h16v14H3zM3 10h18v6h-5a3 3 0 0 1 0-6" />,
  chevron: <path d="M6 9l6 6 6-6" />,
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
