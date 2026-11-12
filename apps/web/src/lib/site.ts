export const SITE_NAME = "SetterSaga";

/** The search-result title of the home page; other pages use their own name and the site's. */
export const SITE_TITLE = "SetterSaga: Free Online Island Board Game with Friends";

export const SITE_DESCRIPTION =
  "Play SetterSaga free in your browser. Build roads and cities, trade resources and race to the top with 3 to 8 friends or against bots. No download needed.";

/** The share picture (app/opengraph-image.jpg), for pages that set their own share text. */
export const SITE_SHARE_IMAGE = {
  alt: "SetterSaga, a free online island board game",
  height: 630,
  url: "/opengraph-image.jpg",
  width: 1200,
};

/**
 * The public address of the site, without a trailing slash. Canonical links, the sitemap and
 * share images are built on it. Set NEXT_PUBLIC_SITE_URL once the game has its own domain; until
 * then a Vercel build falls back to the project's production address.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/+$/, "");
