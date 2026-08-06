"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import type { GameCommand } from "@settersaga/game";
import { type CurrentUser, useHexclaveApp } from "@hexclave/next";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BackgroundMusic } from "@/components/audio/background-music";
import { AuthScreen } from "@/components/auth/auth-screen";
import { GameScreen } from "@/components/game/game-screen";
import { HomeScreen } from "@/components/home/home-screen";
import type { LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { LobbyScreen } from "@/components/lobby/lobby-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { NoticeScreen } from "@/components/ui/notice-screen";
import { toActionableError } from "@/lib/app/action-errors";
import { createCachedValue } from "@/lib/app/cached-value";
import { cleanDisplayName } from "@/lib/app/display-name";
import type { PendingAction } from "@/lib/app/pending-action";
import {
  DEFAULT_AUDIO_SETTINGS,
  normalizeAudioSettings,
  readAudioSettings,
  writeAudioSettings,
  type AudioSettings,
} from "@/lib/audio-settings";
import { parsePlayerView } from "@/lib/game/types";
import {
  type PlayerSession,
  isRoomCode,
  normalizeRoomCode,
  readPlayerSession,
  writePlayerSession,
} from "@/lib/session";

const getParsedPlayerView = createCachedValue(
  (current: string | undefined, next) => current === next,
  parsePlayerView,
);

export function SetterSagaApp() {
  const hexclave = useHexclaveApp();
  const [user, setUser] = useState<CurrentUser | null>();
  const [userLoadFailed, setUserLoadFailed] = useState(false);
  const [audioSettings, setAudioSettings] = useState(DEFAULT_AUDIO_SETTINGS);

  useEffect(() => {
    setAudioSettings(readAudioSettings(window.localStorage));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const currentUser = await hexclave.getUser({ includeRestricted: true });
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        if (!cancelled) {
          setUserLoadFailed(true);
        }
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [hexclave]);

  const updateAudioSettings = (settings: AudioSettings) => {
    const nextSettings = normalizeAudioSettings(settings);
    setAudioSettings(nextSettings);
    writeAudioSettings(window.localStorage, nextSettings);
  };

  if (userLoadFailed) {
    return (
      <NoticeScreen
        actionLabel="Try Again"
        message="Your account could not be checked. Check your connection and try again."
        onAction={() => window.location.reload()}
        title="Account Unavailable"
      />
    );
  }

  if (user === undefined) {
    return <FullPageStatus label="Checking Your Account…" />;
  }

  if (user === null || user.isAnonymous || user.isRestricted) {
    return <AuthScreen />;
  }

  const accountLabel = user.displayName ?? user.primaryEmail ?? "Signed-in player";
  const defaultDisplayName = cleanDisplayName(
    user.displayName ?? user.primaryEmail?.split("@")[0] ?? "Explorer",
  );

  return (
    <AuthenticatedApp
      accountLabel={accountLabel}
      audioSettings={audioSettings}
      defaultDisplayName={defaultDisplayName}
      onAudioSettingsChange={updateAudioSettings}
      onSignOut={() => user.signOut({ redirectUrl: "/" })}
      profileImageUrl={user.profileImageUrl}
      userId={user.id}
    />
  );
}

function AuthenticatedApp({
  accountLabel,
  audioSettings,
  defaultDisplayName,
  onAudioSettingsChange,
  onSignOut,
  profileImageUrl,
  userId,
}: {
  accountLabel: string;
  audioSettings: AudioSettings;
  defaultDisplayName: string;
  onAudioSettingsChange(settings: AudioSettings): void;
  onSignOut(): Promise<void>;
  profileImageUrl: string | null;
  userId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRoom = searchParams.get("room");
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const applyGameCommand = useMutation(api.games.applyCommand);
  const createQuickGame = useMutation(api.games.createQuickGame);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
  const pauseGame = useMutation(api.games.pauseGame);
  const replacePlayerWithBot = useMutation(api.rooms.replacePlayerWithBot);
  const resumeGame = useMutation(api.games.resumeGame);
  const updateLobbyConfiguration = useMutation(api.rooms.updateLobbyConfiguration);
  const startGame = useMutation(api.games.startGame);

  useEffect(() => {
    const stored = readPlayerSession(window.localStorage, userId, defaultDisplayName);
    const requestedCode = normalizeRoomCode(requestedRoom ?? "");
    const activeCode = isRoomCode(requestedCode) ? requestedCode : stored.activeCode;
    const restoredSession = { ...stored, activeCode };
    writePlayerSession(window.localStorage, restoredSession);
    setSession(restoredSession);
    if (activeCode && activeCode !== requestedCode) {
      router.replace(`/?room=${encodeURIComponent(activeCode)}`);
    }
  }, [defaultDisplayName, requestedRoom, router, userId]);

  const room = useQuery(
    api.rooms.getRoom,
    session?.activeCode ? { code: session.activeCode } : "skip",
  );

  if (!session) {
    return <FullPageStatus label="Restoring Your Seat…" />;
  }

  const updateSession = (update: (current: PlayerSession) => PlayerSession) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      const nextSession = update(current);
      writePlayerSession(window.localStorage, nextSession);
      return nextSession;
    });
  };

  const updateDisplayName = (displayName: string) => {
    updateSession((current) => ({ ...current, displayName }));
  };

  const enterRoom = (code: string) => {
    const normalizedCode = normalizeRoomCode(code);
    if (!isRoomCode(normalizedCode)) {
      setError("The room code could not be read. Create a new room and try again.");
      return;
    }
    updateSession((current) => ({ ...current, activeCode: normalizedCode }));
    router.replace(`/?room=${encodeURIComponent(normalizedCode)}`);
  };

  const exitRoomLocally = () => {
    updateSession((current) => {
      const { activeCode: _activeCode, ...nextSession } = current;
      return nextSession;
    });
    setError("");
    router.replace("/");
  };

  const leaveRoom = async () => {
    const code = session.activeCode;
    if (!code || room === null || room?.status === "completed") {
      exitRoomLocally();
      return;
    }

    const left = await perform("leave", async () => {
      await leaveRoomMutation({ code });
      return true;
    });
    if (left) {
      exitRoomLocally();
    }
  };

  const perform = async <Result,>(
    action: Exclude<PendingAction, null>,
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

  const handleQuickPlay = async ({ botCount, botDifficulty, settings }: LobbySettingsValue) => {
    const result = await perform("quick", () =>
      createQuickGame({
        botCount,
        botDifficulty,
        displayName: cleanDisplayName(session.displayName),
        settings,
      }),
    );
    if (result) {
      enterRoom(result.code);
    }
  };

  const handleCreateRoom = async () => {
    const result = await perform("create", () =>
      createRoom({
        displayName: cleanDisplayName(session.displayName),
      }),
    );
    if (result) {
      enterRoom(result.code);
    }
  };

  const handleJoinRoom = async (code: string) => {
    const result = await perform("join", () =>
      joinRoom({
        code: normalizeRoomCode(code),
        displayName: cleanDisplayName(session.displayName),
      }),
    );
    if (result) {
      enterRoom(result.code);
    }
  };

  const handleStartGame = async () => {
    const code = session.activeCode;
    if (!code) {
      return;
    }
    await perform("start", () => startGame({ code }));
  };

  const handleReplacePlayer = async (targetSeatId: string) => {
    const code = session.activeCode;
    if (!code) {
      return;
    }
    await perform("replace", async () => {
      await replacePlayerWithBot({ code, targetSeatId });
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
    const code = session.activeCode;
    if (!code) {
      return;
    }
    await perform("settings", async () => {
      await updateLobbyConfiguration({
        botCount,
        botDifficulty,
        code,
        settings,
      });
      return true;
    });
  };

  if (!session.activeCode) {
    return (
      <>
        <BackgroundMusic
          src="/music/main-lobby-music.mp3"
          volume={audioSettings.lobbyMusicVolume}
        />
        <HomeScreen
          accountLabel={accountLabel}
          audioSettings={audioSettings}
          displayName={session.displayName}
          error={error}
          onCreateRoom={handleCreateRoom}
          onDisplayNameChange={updateDisplayName}
          onJoinRoom={handleJoinRoom}
          onAudioSettingsChange={onAudioSettingsChange}
          onQuickPlay={handleQuickPlay}
          onSignOut={() => perform("signout", onSignOut)}
          pendingAction={pendingAction}
          profileImageUrl={profileImageUrl}
        />
      </>
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
        onAction={leaveRoom}
        title="Room Not Found"
      />
    );
  }

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
