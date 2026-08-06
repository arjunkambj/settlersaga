"use client";

import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { QuickMatchScreen } from "@/components/quick-match/quick-match-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";

export default function QuickMatchPage() {
  return (
    <Suspense fallback={<FullPageStatus label="Preparing Quick Match…" />}>
      <AppProviders>
        <AppSessionProvider>
          <QuickMatchScreen />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
