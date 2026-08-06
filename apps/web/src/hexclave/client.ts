import { HexclaveClientApp } from "@hexclave/next";

export const hexclaveClientApp = new HexclaveClientApp({
  tokenStore: "cookie", // "nextjs-cookie" for Next.js, "cookie" for other web frontends, null for backend environments
  urls: {
    default: {
      type: "hosted",
    },
  },
});
