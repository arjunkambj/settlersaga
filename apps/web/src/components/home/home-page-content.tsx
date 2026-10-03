"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import type { BotDifficulty } from "@settersaga/game";
import { useMutation, useQuery_experimental as useQuery } from "convex/react";
import { useState } from "react";

import { useAppSession } from "@/components/app/app-session-context";
import { BackgroundMusic } from "@/components/audio/background-music";
import { HomeScreen, type RejoinRoom } from "@/components/home/home-screen";
import type { PendingAction } from "@/lib/app/pending-action";
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

  // Set once an action lands in a room, until the room page replaces this one. Entering makes the
  // new room the remembered one, so meanwhile it would flash up as a rejoin offer and the clicked
  // button would stop spinning; instead the screen holds what it showed when the action started.
  const [entering, setEntering] = useState<{
    action: Exclude<PendingAction, null>;
    rejoinRoom: RejoinRoom | null;
  } | null>(null);

  const enterFrom = (action: Exclude<PendingAction, null>, code: string) => {
    setEntering({ action, rejoinRoom });
    enterRoom(code);
  };

  const handleQuickPlay = async (botDifficulty: BotDifficulty) => {
    const result = await runAction("quick", () =>
      createQuickGame({
        botDifficulty,
        displayName,
        settings: QUICK_MATCH_SETTINGS,
      }),
    );
    if (result) enterFrom("quick", result.code);
  };

  const handleCreateRoom = async () => {
    const result = await runAction("create", () => createRoom({ displayName }));
    if (result) enterFrom("create", result.code);
  };

  const handleJoinRoom = async (code: string) => {
    const result = await runAction("join", () => joinRoom({ code, displayName }));
    if (result) enterFrom("join", result.code);
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
        pendingAction={entering?.action ?? pendingAction}
        rejoinRoom={entering ? entering.rejoinRoom : rejoinRoom}
      />
    </>
  );
}
