import type { Metadata } from "next";

import { RoomScreenContainer } from "@/components/room/room-screen-container";

export const metadata: Metadata = {
  description: "Your crew's Island: gather in the harbor, then build and trade.",
  title: "Island Room",
};

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return <RoomScreenContainer roomCode={code} />;
}
