import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import Providers from "@/components/Providers";
import { fontVariables } from "@/components/app/fonts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

import "./styles.css";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  // Relative links in metadata (canonical, share images) resolve against this.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: SITE_DESCRIPTION,
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    type: "website",
    url: "/",
  },
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  twitter: { card: "summary_large_image" },
};

// Tells search engines what the site is: a free browser game for one to eight players.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@id": `${SITE_URL}/#website`, "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    {
      "@id": `${SITE_URL}/#game`,
      "@type": "VideoGame",
      applicationCategory: "Game",
      description: SITE_DESCRIPTION,
      gamePlatform: "Web browser",
      genre: ["Board game", "Strategy"],
      image: `${SITE_URL}/opengraph-image.jpg`,
      name: SITE_NAME,
      numberOfPlayers: { "@type": "QuantitativeValue", maxValue: 8, minValue: 1 },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      operatingSystem: "Any",
      playMode: ["SinglePlayer", "MultiPlayer"],
      url: SITE_URL,
    },
  ],
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
        <script
          // Built from constants above, so there is no user text to escape.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          type="application/ld+json"
        />
        <HexclaveProvider app={hexclaveServerApp}>
          <HexclaveTheme />
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <Providers>{children}</Providers>
        </HexclaveProvider>
      </body>
    </html>
  );
}
