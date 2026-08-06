"use client";

import { HomePageContent } from "@/components/home/home-page-content";

export function JoinPageClient({ initialJoinCode }: { initialJoinCode: string }) {
  return <HomePageContent initialJoinCode={initialJoinCode} initialJoinOpen />;
}
