import type { Metadata } from "next";

import { RoomScreenContainer } from "@/components/room/room-screen-container";

export const metadata: Metadata = {
  description: "Gather your crew, then build and trade.",
  // Rooms are private to the players holding the code.
  robots: { follow: false, index: false },
  title: "Game Room",
};

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return <RoomScreenContainer roomCode={code} />;
}
