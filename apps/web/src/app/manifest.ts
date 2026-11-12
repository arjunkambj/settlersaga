import type { MetadataRoute } from "next";

import { SETTERSAGA_MARK_ASSET_PATH } from "@/constants/game/brand-assets";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// Mirrors --background in styles.css, like the theme color in layout.tsx.
const BACKGROUND = "#1a4a94";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: BACKGROUND,
    description: SITE_DESCRIPTION,
    display: "standalone",
    icons: [{ sizes: "512x512", src: SETTERSAGA_MARK_ASSET_PATH, type: "image/png" }],
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: "/",
    theme_color: BACKGROUND,
  };
}
