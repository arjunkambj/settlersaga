import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  transpilePackages: ["@settersaga/backend", "@settersaga/game"],
};

export default nextConfig;
