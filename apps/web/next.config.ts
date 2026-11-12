import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // 90 is for the full-screen menu backdrop, which is stretched across the whole screen.
    qualities: [75, 90],
    // Profile pictures of players who signed in with Google.
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  reactCompiler: true,
  transpilePackages: ["@settersaga/backend", "@settersaga/game"],
};

export default nextConfig;
