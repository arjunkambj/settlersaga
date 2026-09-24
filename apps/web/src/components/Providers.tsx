"use client";

import { ConvexProvider, ConvexReactClient, useConvex } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";

import { hexclaveClientApp } from "@/hexclave/client";

const authenticateConvex = (client: ConvexReactClient) => {
  client.setAuth(hexclaveClientApp.getConvexClientAuth({}));
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  useEffect(() => {
    if (!client) return;
    authenticateConvex(client);
  }, [client]);

  if (!client) return <>{children}</>;

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

/**
 * Convex reads the Hexclave token once in `setAuth` and treats a missing token as "signed out"
 * until `setAuth` is called again. Google sign-in reloads the page, so it gets a fresh `setAuth`
 * for free; a session created in place (a guest account) must call this to hand Convex its token.
 */
export function useReauthenticateConvex() {
  const client = useConvex();
  return useCallback(() => authenticateConvex(client), [client]);
}
