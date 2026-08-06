import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { SetterSagaApp } from "@/components/app/settersaga-app";
import { FullPageStatus } from "@/components/ui/full-page-status";

export default function HomePage() {
  return (
    <Suspense fallback={<FullPageStatus label="Building your island…" />}>
      <AppProviders
        convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL}
        hexclaveProjectId={process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID}
        hexclavePublishableClientKey={process.env.NEXT_PUBLIC_HEXCLAVE_PUBLISHABLE_CLIENT_KEY}
      >
        <SetterSagaApp />
      </AppProviders>
    </Suspense>
  );
}
