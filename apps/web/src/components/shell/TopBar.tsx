"use client";

import Link from "next/link";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Logo } from "@/components/ui/Logo";
import { Dot } from "@/components/ui/primitives";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-secondary/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <Link href="/network" className="hidden items-center gap-2 text-[13px] text-muted hover:text-fg sm:flex">
          <Dot pulse />
          {ACTIVE_CHAIN.name}
          <span className="num text-faint">{ACTIVE_CHAIN.id}</span>
        </Link>
        <ConnectWalletButton />
      </div>
    </header>
  );
}
