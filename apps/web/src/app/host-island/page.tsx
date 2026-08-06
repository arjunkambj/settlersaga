import type { Metadata } from "next";
import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { HostIslandScreen } from "@/components/host-island/host-island-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";

export const metadata: Metadata = {
  description: "Configure bots and start a new island table.",
  title: "Host Island · SetterSaga",
};

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
