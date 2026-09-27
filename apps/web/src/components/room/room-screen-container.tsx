"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useAppSession } from "@/components/app/app-session-context";
import { BackgroundMusic } from "@/components/audio/background-music";
import { GameScreen } from "@/components/game/game-screen";
import { LobbyScreen } from "@/components/lobby/lobby-screen";
import { ConnectionBanner } from "@/components/room/connection-banner";
import { useRoomPresence } from "@/components/room/use-room-presence";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { NoticeScreen } from "@/components/ui/notice-screen";
import { toActionableError } from "@/lib/app/action-errors";
import { parsePlayerView } from "@/lib/game/types";
import type { LobbySettingsValue } from "@/lib/lobby/lobby-settings-model";
import { isRoomCode, normalizeRoomCode, type PlayerSession } from "@/lib/session";

export function RoomScreenContainer({ roomCode }: { roomCode: string }) {
  const {
    audioSettings,
    displayName,
    error,
    exitRoomLocally,
    pendingAction,
    profileImageUrl,
    runAction,
    updateSession,
  } = useAppSession();
  const normalizedCode = normalizeRoomCode(roomCode);

  const applyGameCommand = useMutation(api.games.applyCommand);
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
  const pauseGame = useMutation(api.games.pauseGame);
  const rematch = useMutation(api.rooms.rematch);
  const replacePlayerWithBot = useMutation(api.rooms.replacePlayerWithBot);
  const resumeGame = useMutation(api.games.resumeGame);
  const sendChatMessage = useMutation(api.rooms.sendChatMessage);
  const updateLobbyConfiguration = useMutation(api.rooms.updateLobbyConfiguration);
  const startGame = useMutation(api.rooms.startGame);

  const room = useQuery(
    api.rooms.getRoom,
    isRoomCode(normalizedCode) ? { code: normalizedCode } : "skip",
  );
  const chatMessages = useQuery(
    api.rooms.listChatMessages,
    room ? { code: normalizedCode } : "skip",
  );
  const offlineSeatIndexes = useRoomPresence(room);
  const isWebSocketConnected = useIsWebSocketConnected();
  const gameJson = room?.gameJson;
  const game = useMemo(() => parsePlayerView(gameJson), [gameJson]);

  // getRoom only returns a view to seated human members, so a null room means the
  // visitor has not joined yet (or the room does not exist). Attempt the join; the
  // server rejects with a specific error when the room is missing, full, or started.
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomClosed, setRoomClosed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const hadRoomRef = useRef(false);
  const joinAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    hadRoomRef.current = false;
    joinAttemptedRef.current = null;
    setJoinError(null);
    setRoomClosed(false);
  }, [normalizedCode]);

  // The home screen offers to rejoin the stored room, so only remember a room this player
  // actually sits in, and forget it while its game is over. A rematch makes it rejoinable again.
  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus === undefined) return;
    updateSession((current) =>
      roomStatus === "finished"
        ? forgetRoom(current, normalizedCode)
        : current.activeCode === normalizedCode
          ? current
          : { ...current, activeCode: normalizedCode },
    );
  }, [normalizedCode, roomStatus, updateSession]);

  // Once the room view has loaded, a later null means this seat was released (the host
  // removed the player) or the room closed. Rejoining would fail or silently re-seat the
  // player, so surface a notice and drop the stored room code. Leaving on purpose nulls the
  // room too, before the redirect home lands.
  useEffect(() => {
    if (room) {
      hadRoomRef.current = true;
      return;
    }
    if (room === null && hadRoomRef.current && !leaving) {
      setRoomClosed(true);
      updateSession((current) => forgetRoom(current, normalizedCode));
    }
  }, [leaving, normalizedCode, room, updateSession]);

  useEffect(() => {
    if (!isRoomCode(normalizedCode) || room !== null) return;
    if (hadRoomRef.current || joinAttemptedRef.current === normalizedCode) return;
    joinAttemptedRef.current = normalizedCode;
    let cancelled = false;
    joinRoomMutation({ code: normalizedCode, displayName }).catch((cause: unknown) => {
      if (cancelled) return;
      setJoinError(toActionableError(cause));
      updateSession((current) => forgetRoom(current, normalizedCode));
    });
    return () => {
      cancelled = true;
    };
  }, [displayName, joinRoomMutation, normalizedCode, room, updateSession]);

  if (!isRoomCode(normalizedCode)) {
    return (
      <NoticeScreen
        actionLabel="Go home"
        message="That game code doesn't look right. Check the link and try again."
        onAction={exitRoomLocally}
        title="That code won't work"
      />
    );
  }

  if (room === undefined) {
    return <FullPageStatus label="Joining the game…" />;
  }

  if (room === null) {
    if (leaving) {
      return <FullPageStatus label="Leaving the game…" />;
    }
    if (roomClosed) {
      return (
        <NoticeScreen
          actionLabel="Go home"
          message="The host removed you, or the game closed."
          onAction={exitRoomLocally}
          title="You're out of this game"
        />
      );
    }
    if (joinError === null) {
      return <FullPageStatus label="Joining the game…" />;
    }
    return (
      <NoticeScreen
        actionLabel="Go home"
        message={joinError}
        onAction={exitRoomLocally}
        title="Couldn't join"
      />
    );
  }

  // Rejects when the server refuses, so each screen can say why in its own way.
  const leaveRoom = async () => {
    setLeaving(true);
    try {
      await leaveRoomMutation({ code: normalizedCode });
    } catch (cause) {
      setLeaving(false);
      throw cause;
    }
    exitRoomLocally();
  };

  const replacePlayer = async (targetSeatId: string) => {
    await replacePlayerWithBot({ code: normalizedCode, targetSeatId });
  };

  const saveLobbySettings = ({ botCount, botDifficulty, settings }: LobbySettingsValue) =>
    updateLobbyConfiguration({ botCount, botDifficulty, code: normalizedCode, settings });

  const chat = {
    messages: chatMessages ?? [],
    onSend: async (body: string) => {
      await sendChatMessage({ body, code: normalizedCode });
    },
  };

  if (room.status === "waiting") {
    return (
      <>
        <BackgroundMusic
          src="/music/main-lobby-music.mp3"
          volume={audioSettings.lobbyMusicVolume}
        />
        <ConnectionBanner />
        <LobbyScreen
          chat={chat}
          error={error}
          offlineSeatIndexes={offlineSeatIndexes}
          onLeave={leaveRoom}
          onReplacePlayer={replacePlayer}
          onSaveSettings={(value) => runAction("settings", () => saveLobbySettings(value))}
          onStart={(option) =>
            runAction("start", async () => {
              await saveLobbySettings(option.value);
              await startGame({
                code: normalizedCode,
                fillEmptySeatsWithBots: option.kind === "fill",
              });
            })
          }
          pendingAction={pendingAction}
          room={room}
        />
      </>
    );
  }

  if (!game) {
    return (
      <NoticeScreen
        actionLabel="Leave game"
        confirmation={{
          confirmLabel: "Leave game",
          description:
            "A bot takes your seat, and you can't come back to it. If no players are left, the game closes.",
          title: "Leave this game?",
        }}
        message="We couldn't load this game. Refresh the page, or leave and start a new one."
        onAction={leaveRoom}
        title="Game didn't load"
      />
    );
  }

  return (
    <>
      <ConnectionBanner />
      <GameScreen
        audioSettings={audioSettings}
        botDifficulty={room.botDifficulty}
        botThinking={room.botThinking}
        chat={chat}
        events={room.events}
        game={game}
        hostSeatIndex={room.members.find((member) => member.role === "host")?.seatIndex ?? null}
        isConnected={isWebSocketConnected}
        isHost={room.isHost}
        isPaused={room.isPaused}
        nextActionAt={room.nextActionAt}
        offlineSeatIndexes={offlineSeatIndexes}
        onCommand={async (command) => {
          await applyGameCommand({
            clientActionId: globalThis.crypto.randomUUID(),
            code: normalizedCode,
            command,
            expectedActionNumber: game.actionNumber,
          });
        }}
        onLeave={leaveRoom}
        onPauseChange={async (shouldPause) => {
          await (shouldPause ? pauseGame : resumeGame)({ code: normalizedCode });
        }}
        onRematch={async () => {
          await rematch({ code: normalizedCode });
        }}
        onReplacePlayer={replacePlayer}
        pausedRemainingMs={room.pausedRemainingMs}
        viewerProfileImageUrl={profileImageUrl}
      />
    </>
  );
}

/**
 * Whether the socket to the server is up. Unlike useConvexConnectionState it re-renders only when
 * that flips, not on every request the connection counts.
 */
function useIsWebSocketConnected(): boolean {
  const convex = useConvex();
  return useSyncExternalStore(
    (onChange) => convex.subscribeToConnectionState(onChange),
    () => convex.connectionState().isWebSocketConnected,
    () => true,
  );
}

function forgetRoom(session: PlayerSession, code: string): PlayerSession {
  if (session.activeCode !== code) return session;
  const { activeCode: _activeCode, ...rest } = session;
  return rest;
}
