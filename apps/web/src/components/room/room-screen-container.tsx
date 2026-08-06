"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import type { GameCommand } from "@settersaga/game";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

import { useAppSession } from "@/components/app/app-session-context";
import { BackgroundMusic } from "@/components/audio/background-music";
import { GameScreen } from "@/components/game/game-screen";
import type { LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { LobbyScreen } from "@/components/lobby/lobby-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { NoticeScreen } from "@/components/ui/notice-screen";
import { toActionableError } from "@/lib/app/action-errors";
import { createCachedValue } from "@/lib/app/cached-value";
import { parsePlayerView } from "@/lib/game/types";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

const getParsedPlayerView = createCachedValue(
  (current: string | undefined, next) => current === next,
  parsePlayerView,
);

export function RoomScreenContainer({ roomCode }: { roomCode: string }) {
  const {
    audioSettings,
    displayName,
    error,
    exitRoomLocally,
    pendingAction,
    profileImageUrl,
    setError,
    setPendingAction,
    updateSession,
  } = useAppSession();
  const normalizedCode = normalizeRoomCode(roomCode);

  const applyGameCommand = useMutation(api.games.applyCommand);
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
  const pauseGame = useMutation(api.games.pauseGame);
  const replacePlayerWithBot = useMutation(api.rooms.replacePlayerWithBot);
  const resumeGame = useMutation(api.games.resumeGame);
  const updateLobbyConfiguration = useMutation(api.rooms.updateLobbyConfiguration);
  const startGame = useMutation(api.games.startGame);

  useEffect(() => {
    if (isRoomCode(normalizedCode)) {
      updateSession((current) => ({ ...current, activeCode: normalizedCode }));
    }
  }, [normalizedCode, updateSession]);

  const room = useQuery(
    api.rooms.getRoom,
    isRoomCode(normalizedCode) ? { code: normalizedCode } : "skip",
  );

  // Auto-join room if valid room code and user not yet in room members
  useEffect(() => {
    if (!room || room.status !== "waiting") return;
    const alreadyMember = room.members.some((m) => m.displayName === displayName);
    if (!alreadyMember) {
      void joinRoomMutation({ code: normalizedCode, displayName });
    }
  }, [displayName, joinRoomMutation, normalizedCode, room]);

  if (!isRoomCode(normalizedCode)) {
    return (
      <NoticeScreen
        actionLabel="Return Home"
        message="The room code is invalid. Check the link and try again."
        onAction={exitRoomLocally}
        title="Invalid Room Code"
      />
    );
  }

  if (room === undefined) {
    return <FullPageStatus label="Joining the Island…" />;
  }

  if (room === null) {
    return (
      <NoticeScreen
        actionLabel="Return Home"
        message="This invite may have expired. Check the code and try again."
        onAction={exitRoomLocally}
        title="Room Not Found"
      />
    );
  }

  const perform = async <Result,>(
    action: Exclude<typeof pendingAction, null>,
    work: () => Promise<Result>,
  ): Promise<Result | null> => {
    setError("");
    setPendingAction(action);
    try {
      return await work();
    } catch (cause) {
      setError(toActionableError(cause));
      return null;
    } finally {
      setPendingAction(null);
    }
  };

  const leaveRoom = async () => {
    if (room.status === "completed") {
      exitRoomLocally();
      return;
    }

    const left = await perform("leave", async () => {
      await leaveRoomMutation({ code: normalizedCode });
      return true;
    });
    if (left) {
      exitRoomLocally();
    }
  };

  const handleStartGame = async () => {
    await perform("start", () => startGame({ code: normalizedCode }));
  };

  const handleReplacePlayer = async (targetSeatId: string) => {
    await perform("replace", async () => {
      await replacePlayerWithBot({ code: normalizedCode, targetSeatId });
      return true;
    });
  };

  const handleGameCommand = async (
    code: string,
    expectedActionNumber: number,
    command: GameCommand,
  ) => {
    await applyGameCommand({
      clientActionId: globalThis.crypto.randomUUID(),
      code,
      command,
      expectedActionNumber,
    });
  };

  const handlePauseChange = async (code: string, shouldPause: boolean) => {
    if (shouldPause) {
      await pauseGame({ code });
      return;
    }
    await resumeGame({ code });
  };

  const handleRoomSettings = async ({ botCount, botDifficulty, settings }: LobbySettingsValue) => {
    await perform("settings", async () => {
      await updateLobbyConfiguration({
        botCount,
        botDifficulty,
        code: normalizedCode,
        settings,
      });
      return true;
    });
  };

  if (room.status === "waiting") {
    return (
      <>
        <BackgroundMusic
          src="/music/main-lobby-music.mp3"
          volume={audioSettings.lobbyMusicVolume}
        />
        <LobbyScreen
          error={error}
          onLeave={leaveRoom}
          onReplacePlayer={handleReplacePlayer}
          onSaveSettings={handleRoomSettings}
          onStart={handleStartGame}
          pendingAction={pendingAction}
          room={room}
        />
      </>
    );
  }

  const game = getParsedPlayerView(room.gameJson);
  if (!game) {
    return (
      <NoticeScreen
        actionLabel="Leave Game"
        confirmation={{
          confirmLabel: "Leave Game",
          description:
            "You cannot reclaim this seat after leaving. A bot will take over, or the game will close if no human players remain.",
          title: "Leave this game?",
        }}
        message="The live game payload could not be read. Refresh once, or leave and create a new game."
        onAction={leaveRoom}
        title="Game State Unavailable"
      />
    );
  }

  return (
    <GameScreen
      audioSettings={audioSettings}
      botThinking={room.botThinking}
      events={room.events}
      game={game}
      isHost={room.isHost}
      isPaused={room.isPaused}
      nextActionAt={room.nextActionAt}
      onCommand={(command) => handleGameCommand(room.code, game.actionNumber, command)}
      onLeave={leaveRoom}
      onPauseChange={(shouldPause) => handlePauseChange(room.code, shouldPause)}
      onReplacePlayer={(targetSeatId) =>
        replacePlayerWithBot({ code: room.code, targetSeatId }).then(() => undefined)
      }
      viewerProfileImageUrl={profileImageUrl}
    />
  );
}
