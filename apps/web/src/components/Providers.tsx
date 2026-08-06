"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { hexclaveClientApp } from "@/hexclave/client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

convex.setAuth(hexclaveClientApp.getConvexClientAuth({}));

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
