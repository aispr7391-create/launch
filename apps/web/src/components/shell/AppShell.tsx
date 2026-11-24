import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { NetworkBanner } from "@/components/wallet/NetworkBanner";
import { SiteFooter } from "@/components/info/SiteFooter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="grid-bg pointer-events-none fixed inset-x-0 top-0 h-[480px]" aria-hidden />
      <Sidebar />
      <div className="relative lg:pl-60">
        <TopBar />
        <NetworkBanner />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}
