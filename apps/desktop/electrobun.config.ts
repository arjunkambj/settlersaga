import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "SetterSaga",
    identifier: "com.settersaga.desktop",
    version: "0.0.1",
  },
  runtime: {
    exitOnLastWindowClosed: true,
    // The web app needs its Next.js server, so the shell loads it by URL instead of bundling files.
    webUrl: process.env.SETTERSAGA_WEB_URL || "http://localhost:3000",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    mac: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
  },
  scripts: {
    preBuild: "scripts/require-web-url.ts",
  },
} satisfies ElectrobunConfig;
