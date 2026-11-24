"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Portal } from "@/components/ui/Portal";
import { Logo } from "@/components/ui/Logo";
import { SidebarNav } from "./Sidebar";

/** Phone/tablet menu: the desktop sidebar in a slide-in drawer. Hidden on lg screens. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close after navigating and on Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-raised text-fg transition hover:border-faint lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
            <aside className="animate-drawer absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-line bg-secondary shadow-2xl shadow-black/50">
              <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-4">
                <div onClick={() => setOpen(false)}>
                  <Logo />
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="grid size-9 place-items-center rounded-lg border border-line-strong text-muted transition hover:text-fg"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
            </aside>
          </div>
        </Portal>
      )}
    </>
  );
}
