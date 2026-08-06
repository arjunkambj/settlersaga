"use client";

import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { HostIslandScreen } from "@/components/host-island/host-island-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";

export default function HostIslandPage() {
  return (
    <Suspense fallback={<FullPageStatus label="Preparing Host Island…" />}>
      <AppProviders>
        <AppSessionProvider>
          <HostIslandScreen />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
