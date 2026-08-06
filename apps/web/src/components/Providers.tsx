"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useEffect, useMemo } from "react";

import { hexclaveClientApp } from "@/hexclave/client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  useEffect(() => {
    if (!client) return;
    client.setAuth(hexclaveClientApp.getConvexClientAuth({}));
  }, [client]);

  if (!client) return <>{children}</>;

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
