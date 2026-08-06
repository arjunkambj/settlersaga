import type { Metadata, Viewport } from "next";
import { DM_Sans, Inter } from "next/font/google";
import type { ReactNode } from "react";
import Link from "next/link";

import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

import "./styles.css";
import "./liquid-glass.css";
import "./reference-screens.css";
import "./game-footer.css";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  description: "A friendly real-time island-building board game.",
  title: "SetterSaga",
};

export const viewport: Viewport = {
  width: "device-width",
};

const dmSans = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const themeInitializationScript = `try {
  const theme = localStorage.getItem("${THEME_STORAGE_KEY}") === "dark" ? "dark" : "${DEFAULT_THEME}";
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
} catch {}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={cn("light", dmSans.variable, "font-sans", inter.variable)}
      data-theme="light"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="bg-background text-foreground">
        <Link className="skip-link" href="#main-content">
          Skip to Game
        </Link>
        {children}
      </body>
    </html>
  );
}
