import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import Providers from "@/components/Providers";
import { fontVariables } from "@/components/app/fonts";

import "./styles.css";

export const metadata: Metadata = {
  description: "Build, trade and outwit your crew in a friendly island board game.",
  title: {
    default: "SetterSaga",
    template: "%s · SetterSaga",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Full-bleed on notched phones; screens pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
  colorScheme: "dark",
  // Mirrors --background in styles.css; the viewport API can't read CSS variables.
  themeColor: "#1a4a94",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={fontVariables} lang="en">
      <body>
        <HexclaveProvider app={hexclaveServerApp}>
          <HexclaveTheme />
          <a className="skip-link" href="#main-content">
            Skip to game
          </a>
          <Providers>{children}</Providers>
        </HexclaveProvider>
      </body>
    </html>
  );
}
