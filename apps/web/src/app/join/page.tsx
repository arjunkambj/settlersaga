import type { Metadata } from "next";
import { Suspense } from "react";

import { AppProviders } from "@/components/app/app-providers";
import { AppSessionProvider } from "@/components/app/app-session-context";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

import { JoinPageClient } from "./join-client";

export const metadata: Metadata = {
  description: "Join an island table with a room code.",
  title: "Join Crew · SetterSaga",
};

type JoinPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const raw = params.code ?? params.room;
  const rawCode = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const normalized = normalizeRoomCode(rawCode);
  const initialJoinCode = isRoomCode(normalized) ? normalized : normalized;

  return (
    <Suspense fallback={<FullPageStatus label="Opening Join Room…" />}>
      <AppProviders>
        <AppSessionProvider>
          <JoinPageClient initialJoinCode={initialJoinCode} />
        </AppSessionProvider>
      </AppProviders>
    </Suspense>
  );
}
