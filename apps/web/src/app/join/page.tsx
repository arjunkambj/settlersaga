"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { HomePageContent } from "@/components/home/home-page-content";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { normalizeRoomCode } from "@/lib/session";

function JoinPageContent() {
  const searchParams = useSearchParams();
  const rawCode = searchParams.get("code") ?? searchParams.get("room") ?? "";
  const initialJoinCode = normalizeRoomCode(rawCode);

  return <HomePageContent initialJoinCode={initialJoinCode} initialJoinOpen />;
}

export default function JoinPage() {
  return (
    <Suspense fallback={<FullPageStatus label="Opening Join Room…" />}>
      <AppProviders>
        <AppSessionProvider>
          <JoinPageContent />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
