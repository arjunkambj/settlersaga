import type { Metadata, Viewport } from "next";
import { DM_Sans, Inter } from "next/font/google";
import type { ReactNode } from "react";
import Link from "next/link";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import Providers from "@/components/Providers";

import "./styles.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  description: "A friendly real-time island-building board game.",
  title: {
    default: "SetterSaga",
    template: "%s · SetterSaga",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const dmSans = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={cn("dark", dmSans.variable, "font-sans", inter.variable)}
      data-theme="dark"
      lang="en"
    >
      <body className="bg-background text-foreground">
        <HexclaveProvider app={hexclaveServerApp}>
          <HexclaveTheme />
          <Link className="skip-link" href="#main-content">
            Skip to Game
          </Link>
          <Providers>{children}</Providers>
        </HexclaveProvider>
      </body>
    </html>
  );
}
