"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/config/modules";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { isActivePath } from "./Sidebar";

const MOBILE_KEYS = ["overview", "trade", "launch", "pools", "portfolio"] as const;

export function MobileNav() {
  const pathname = usePathname();
  const items = MOBILE_KEYS.map((k) => MODULES.find((m) => m.key === k)!).filter(Boolean);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-secondary/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((m) => {
          const active = isActivePath(pathname, m.href);
          return (
            <li key={m.key}>
              <Link
                href={m.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px]",
                  active ? "text-fg" : "text-faint",
                )}
              >
                <Icon name={m.key} size={18} className={active ? "text-accent" : undefined} />
                {m.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
