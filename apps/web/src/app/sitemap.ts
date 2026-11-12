import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/** The public pages only. Rooms and invite links are private, so they stay out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { changeFrequency: "weekly", priority: 1, url: `${SITE_URL}/` },
    { changeFrequency: "monthly", priority: 0.8, url: `${SITE_URL}/how-to-play` },
  ];
}
