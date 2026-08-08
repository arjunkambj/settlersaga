import { HexclaveClientApp } from "@hexclave/next";

export const hexclaveClientApp = new HexclaveClientApp({
  tokenStore: "cookie", // "nextjs-cookie" for Next.js, "cookie" for other web frontends, null for backend environments
  urls: {
    default: {
      type: "hosted",
    },
  },
  // The SDK's built-in analytics event tracker monkey-patches history.pushState/replaceState.
  // In local dev its first flush fails (no analytics backend reachable), which tears down the
  // patch mid-flight and leaves a dead closure installed as window.history.pushState, throwing
  // "this._originalPushState is not a function" on the next client-side navigation.
  analytics: process.env.NODE_ENV === "development" ? { enabled: false } : undefined,
});
