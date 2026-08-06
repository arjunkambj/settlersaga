"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { RoomScreenContainer } from "@/components/room/room-screen-container";
import { FullPageStatus } from "@/components/ui/full-page-status";

export default function RoomPage() {
  const params = useParams();
  const roomCode = typeof params.code === "string" ? params.code : (params.code?.[0] ?? "");

  return (
    <Suspense fallback={<FullPageStatus label="Joining the Island…" />}>
      <AppProviders>
        <AppSessionProvider>
          <RoomScreenContainer roomCode={roomCode} />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
