import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { cookieToInitialState } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { BRAND } from "@/config/brand";
import { AppShell } from "@/components/shell/AppShell";
import { Providers } from "./providers";
import "./globals.css";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const num = JetBrains_Mono({ subsets: ["latin"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0a0e14" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Restores the wallet connection on the server render to avoid a hydration flash.
  const initialState = cookieToInitialState(wagmiConfig, (await headers()).get("cookie"));

  return (
    <html lang="en" className={`${ui.variable} ${num.variable}`}>
      <body>
        <Providers initialState={initialState}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
