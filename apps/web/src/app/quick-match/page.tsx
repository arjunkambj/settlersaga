import type { Metadata } from "next";
import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { QuickMatchScreen } from "@/components/quick-match/quick-match-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";

export const metadata: Metadata = {
  description: "Jump into a quick match against bots.",
  title: "Quick Match · SetterSaga",
};

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
