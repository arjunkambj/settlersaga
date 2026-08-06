import type { Metadata } from "next";
import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { RoomScreenContainer } from "@/components/room/room-screen-container";
import { FullPageStatus } from "@/components/ui/full-page-status";

export const metadata: Metadata = {
  description: "Join an island table and play.",
  title: "Island Room · SetterSaga",
};

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return (
    <Suspense fallback={<FullPageStatus label="Joining the Island…" />}>
      <AppProviders>
        <AppSessionProvider>
          <RoomScreenContainer roomCode={code} />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
