import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// Nothing is blocked here: the private pages (rooms, invites, the asset sheet) carry a noindex
// tag instead, which a crawler can only obey if it is allowed to read the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", userAgent: "*" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
