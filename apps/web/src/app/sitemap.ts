import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * The public pages only. Rooms and invite links are private, so they stay out.
 *
 * `lastModified` is the day a page's words last changed. Move it forward by hand when they change
 * again; a date that moves on every deploy teaches search engines to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { changeFrequency: "weekly", lastModified: "2026-11-12", priority: 1, url: `${SITE_URL}/` },
    {
      changeFrequency: "monthly",
      lastModified: "2026-11-12",
      priority: 0.8,
      url: `${SITE_URL}/how-to-play`,
    },
  ];
}
