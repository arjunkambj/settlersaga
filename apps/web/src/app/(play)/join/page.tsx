import type { Metadata } from "next";

import { HomePageContent } from "@/components/home/home-page-content";
import { normalizeRoomCode } from "@/lib/session";

export const metadata: Metadata = {
  description: "Hop aboard your crew's Island with its code.",
  title: "Join Crew",
};

type JoinPageProps = {
  searchParams: Promise<{ code?: string | string[] }>;
};

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { code } = await searchParams;
  const rawCode = Array.isArray(code) ? code[0] : code;

  return <HomePageContent initialJoinCode={normalizeRoomCode(rawCode ?? "")} initialJoinOpen />;
}
