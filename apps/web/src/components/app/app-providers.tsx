"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isUiPreviewMode, UiPreview } from "@/components/app/ui-preview";

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
}: AppProvidersProps) {
  const searchParams = useSearchParams();
  const previewMode = searchParams.get("preview");
  const previewSeed = searchParams.get("seed")?.trim() || undefined;

  if (process.env.NODE_ENV === "development" && isUiPreviewMode(previewMode)) {
    return <UiPreview mode={previewMode} seed={previewSeed} />;
  }

  // Hexclave + Convex are now provided once in `apps/web/src/app/layout.tsx`
  // via `HexclaveProvider` (hexclaveServerApp) and `Providers` (Convex).
  // This wrapper only keeps the preview bypass and the missing-env guard
  // so we don't duplicate provider instantiation.
  const isConfigured = Boolean(
    (convexUrl ?? process.env.NEXT_PUBLIC_CONVEX_URL) &&
      (hexclaveProjectId ?? process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID),
  );

  if (!isConfigured) return <SetupRequired />;

  return <>{children}</>;
}

function SetupRequired() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6" id="main-content">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Connect SetterSaga</CardTitle>
          <CardDescription>
            Add the Convex deployment URL and Hexclave project ID to <code>apps/web/.env.local</code>,
            then restart the web server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{`NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_HEXCLAVE_PROJECT_ID=your-project-id`}</pre>
        </CardContent>
      </Card>
    </main>
  );
}
