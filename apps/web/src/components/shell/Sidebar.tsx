"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/config/modules";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { Dot } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const primary = MODULES.filter((m) => m.group === "main");
  const more = MODULES.filter((m) => m.group === "more");
  const secondary = MODULES.filter((m) => m.group === "system");

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-canvas/80 backdrop-blur lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Primary">
        {[...primary, ...more].map((m, i) => {
          const active = isActivePath(pathname, m.href);
          return (
            <div key={m.key}>
            {i === primary.length && <p className="px-3 pb-1.5 pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">More</p>}
            <Link
              href={m.href}
              className={cn(
                "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition",
                active ? "bg-raised text-fg" : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              <Icon name={m.key} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
              <span className="flex-1">{m.label}</span>
              {m.status === "planned" && <span className="num text-[10px] text-faint">S{m.stage}</span>}
            </Link>
            </div>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {secondary.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className={cn(
              "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition",
              isActivePath(pathname, m.href) ? "bg-raised text-fg" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            <Icon name={m.key} className="text-faint" />
            <span className="flex-1">{m.label}</span>
            <Dot pulse />
          </Link>
        ))}
        <p className="px-3 pt-2 text-[11px] leading-4 text-faint">
          {ACTIVE_CHAIN.name}
          <span className="num"> · {ACTIVE_CHAIN.id}</span>
        </p>
      </div>
    </aside>
  );
}
