import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Profile pictures of players who signed in with Google.
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  reactCompiler: true,
  transpilePackages: ["@settersaga/backend", "@settersaga/game"],
};

export default nextConfig;
