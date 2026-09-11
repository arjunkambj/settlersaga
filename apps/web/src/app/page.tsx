import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { HomePageContent } from "@/components/home/home-page-content";
import { FullPageStatus } from "@/components/ui/full-page-status";

export default function HomePage() {
  return (
    <Suspense fallback={<FullPageStatus label="Building your island…" />}>
      <AppProviders
        convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL}
        hexclaveProjectId={process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID}
      >
        <AppSessionProvider>
          <HomePageContent />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
