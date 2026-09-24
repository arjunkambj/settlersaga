"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import type { BotDifficulty } from "@settersaga/game";
import { useMutation, useQuery_experimental as useQuery } from "convex/react";

import { useAppSession } from "@/components/app/app-session-context";
import { BackgroundMusic } from "@/components/audio/background-music";
import { HomeScreen, type RejoinRoom } from "@/components/home/home-screen";
import { QUICK_MATCH_SETTINGS } from "@/lib/app/quick-match";

export function HomePageContent({
  initialJoinCode,
  initialJoinOpen,
}: {
  initialJoinCode?: string;
  initialJoinOpen?: boolean;
}) {
  const {
    audioSettings,
    displayName,
    enterRoom,
    error,
    pendingAction,
    runAction,
    session,
    setError,
  } = useAppSession();
  const joinRoom = useMutation(api.rooms.joinRoom);
  const createRoom = useMutation(api.rooms.createRoom);
  const createQuickGame = useMutation(api.games.createQuickGame);

  // The remembered room is only worth offering while this player still has a live seat in it.
  // Errors (a revoked seat, an expired sign-in) just hide the offer instead of failing the page.
  const activeRoom = useQuery({
    args: session?.activeCode ? { code: session.activeCode } : "skip",
    query: api.rooms.getRoom,
  });
  const rejoinRoom: RejoinRoom | null =
    activeRoom.status === "success" &&
    (activeRoom.data?.status === "waiting" || activeRoom.data?.status === "active")
      ? { code: activeRoom.data.code, status: activeRoom.data.status }
      : null;

  const handleQuickPlay = async (botDifficulty: BotDifficulty) => {
    const result = await runAction("quick", () =>
      createQuickGame({
        botDifficulty,
        displayName,
        settings: QUICK_MATCH_SETTINGS,
      }),
    );
    if (result) enterRoom(result.code);
  };

  const handleCreateRoom = async () => {
    const result = await runAction("create", () => createRoom({ displayName }));
    if (result) enterRoom(result.code);
  };

  const handleJoinRoom = async (code: string) => {
    const result = await runAction("join", () => joinRoom({ code, displayName }));
    if (result) enterRoom(result.code);
  };

  return (
    <>
      <BackgroundMusic src="/music/main-lobby-music.mp3" volume={audioSettings.lobbyMusicVolume} />
      <HomeScreen
        error={error}
        initialJoinCode={initialJoinCode}
        initialJoinOpen={initialJoinOpen}
        onCreateRoom={handleCreateRoom}
        onDismissError={() => setError("")}
        onJoinRoom={handleJoinRoom}
        onQuickPlay={handleQuickPlay}
        pendingAction={pendingAction}
        rejoinRoom={rejoinRoom}
      />
    </>
  );
}
