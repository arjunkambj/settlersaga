"use client";

import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { isUiPreviewMode, UiPreview } from "@/components/app/ui-preview";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { getHexclaveClientApp } from "@/hexclave/client";

export interface AppProvidersProps {
  children: ReactNode;
  convexUrl?: string;
  hexclaveProjectId?: string;
  hexclavePublishableClientKey?: string;
}

export function AppProviders({
  children,
  convexUrl,
  hexclaveProjectId,
  hexclavePublishableClientKey,
}: AppProvidersProps) {
  const searchParams = useSearchParams();
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  const isConfigured = Boolean(convexUrl && hexclaveProjectId);
  const previewMode = searchParams.get("preview");
  const previewSeed = searchParams.get("seed")?.trim() || undefined;

  useEffect(() => {
    setIsBrowserReady(true);
  }, []);

  const clients = useMemo(() => {
    if (!isBrowserReady || !convexUrl || !hexclaveProjectId) {
      return null;
    }

    const hexclave = getHexclaveClientApp(hexclaveProjectId, hexclavePublishableClientKey);
    const convex = new ConvexReactClient(convexUrl);
    convex.setAuth(hexclave.getConvexClientAuth({}));

    return { convex, hexclave };
  }, [convexUrl, hexclaveProjectId, hexclavePublishableClientKey, isBrowserReady]);

  if (process.env.NODE_ENV === "development" && isUiPreviewMode(previewMode)) {
    return <UiPreview mode={previewMode} seed={previewSeed} />;
  }

  if (!isConfigured) {
    return <SetupRequired />;
  }

  if (!clients) {
    return <FullPageStatus label="Gathering your crew…" />;
  }

  return (
    <HexclaveProvider app={clients.hexclave}>
      <HexclaveTheme>
        <ConvexProvider client={clients.convex}>{children}</ConvexProvider>
      </HexclaveTheme>
    </HexclaveProvider>
  );
}

function SetupRequired() {
  return (
    <main className="centered-page setup-page" id="main-content">
      <div className="brand-mark" aria-hidden="true">
        C
      </div>
      <p className="eyebrow">One Last Step</p>
      <h1>Connect SetterSaga</h1>
      <p>
        Add the Convex deployment URL and Hexclave project ID to
        <code> apps/web/.env.local</code>, then restart the web server.
      </p>
      <pre>{`NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_HEXCLAVE_PROJECT_ID=your-project-id`}</pre>
    </main>
  );
}
