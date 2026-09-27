"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppSessionProvider } from "@/components/app/app-session-context";
import { MenuScreen, MenuScreenText } from "@/components/app/menu-screen";
import { isUiPreviewMode } from "@/components/app/ui-preview-modes";
import { FullPageStatus } from "@/components/ui/full-page-status";

// Loaded on demand so the fixture screens stay out of the playable routes' bundle.
const UiPreview = dynamic(() =>
  import("@/components/app/ui-preview").then((module) => module.UiPreview),
);

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_CONVEX_URL && process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID,
);

/**
 * Shared by every playable route, so the signed-in session (and the music it hosts) survives
 * navigation between home and a room.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  if (!isConfigured) return <SetupRequired />;

  const app = <AppSessionProvider>{children}</AppSessionProvider>;
  if (process.env.NODE_ENV !== "development") return app;

  return (
    <Suspense fallback={<FullPageStatus label="Loading…" />}>
      <DevPreviewSwitch>{app}</DevPreviewSwitch>
    </Suspense>
  );
}

// Development only: `?preview=<mode>&seed=<seed>` renders a screen from fixture data, signed out.
function DevPreviewSwitch({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const mode = searchParams.get("preview");
  if (!isUiPreviewMode(mode)) return children;
  return <UiPreview mode={mode} seed={searchParams.get("seed")?.trim() || undefined} />;
}

function SetupRequired() {
  return (
    <MenuScreen title="Connect SetterSaga">
      <MenuScreenText>
        This copy of the game isn&apos;t linked to a server yet. Add these two lines to{" "}
        <code className="font-mono text-foreground">apps/web/.env.local</code>, then restart the web
        server.
      </MenuScreenText>
      <pre className="w-full overflow-auto rounded-2xl border-2 border-well-line bg-well-fill p-4 text-left font-mono text-xs inset-shadow-well-deep">{`NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_HEXCLAVE_PROJECT_ID=your-project-id`}</pre>
    </MenuScreen>
  );
}
