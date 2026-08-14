"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAppSession } from "@/components/app/app-session-context";
import { BackgroundMusic } from "@/components/audio/background-music";
import { HomeScreen } from "@/components/home/home-screen";
import type { LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { toActionableError } from "@/lib/app/action-errors";
import { cleanDisplayName } from "@/lib/app/display-name";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

export function HomePageContent({
  initialJoinCode,
  initialJoinOpen,
}: {
  initialJoinCode?: string;
  initialJoinOpen?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <HomePageContentInner initialJoinCode={initialJoinCode} initialJoinOpen={initialJoinOpen} />
    </Suspense>
  );
}

function HomePageContentInner({
  initialJoinCode,
  initialJoinOpen,
}: {
  initialJoinCode?: string;
  initialJoinOpen?: boolean;
}) {
  const {
    accountLabel,
    audioSettings,
    displayName,
    error,
    onAudioSettingsChange,
    onDisplayNameChange,
    pendingAction,
    profileImageUrl,
    session,
    setError,
    setPendingAction,
    signOut,
    updateSession,
  } = useAppSession();

  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRoom = searchParams.get("room");
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const createRoomMutation = useMutation(api.rooms.createRoom);
  const createQuickGame = useMutation(api.games.createQuickGame);

  useEffect(() => {
    if (!requestedRoom) return;
    const normalized = normalizeRoomCode(requestedRoom);
    if (isRoomCode(normalized)) {
      router.replace(`/room/${encodeURIComponent(normalized)}`);
    }
  }, [requestedRoom, router]);

  const handleQuickPlay = async ({ botCount, botDifficulty, settings }: LobbySettingsValue) => {
    setError("");
    setPendingAction("quick");
    try {
      const result = await createQuickGame({
        botCount,
        botDifficulty,
        displayName: cleanDisplayName(displayName),
        settings,
      });
      const normalizedCode = normalizeRoomCode(result.code);
      if (!isRoomCode(normalizedCode)) throw new Error("Invalid room code generated");
      updateSession((current) => ({ ...current, activeCode: normalizedCode }));
      router.push(`/room/${encodeURIComponent(normalizedCode)}`);
    } catch (cause) {
      setError(toActionableError(cause));
    } finally {
      setPendingAction(null);
    }
  };

  const handleCreateRoom = async () => {
    setError("");
    setPendingAction("create");
    try {
      const result = await createRoomMutation({
        displayName: cleanDisplayName(displayName),
      });
      const normalizedCode = normalizeRoomCode(result.code);
      if (!isRoomCode(normalizedCode)) throw new Error("Invalid room code generated");
      updateSession((current) => ({ ...current, activeCode: normalizedCode }));
      router.push(`/room/${encodeURIComponent(normalizedCode)}`);
    } catch (cause) {
      setError(toActionableError(cause));
    } finally {
      setPendingAction(null);
    }
  };

  const handleJoinRoom = async (codeToJoin: string) => {
    const normalizedCode = normalizeRoomCode(codeToJoin);
    if (!isRoomCode(normalizedCode)) {
      setError("The room code must be 6 letters or numbers.");
      return;
    }

    setError("");
    setPendingAction("join");
    try {
      const result = await joinRoomMutation({
        code: normalizedCode,
        displayName: cleanDisplayName(displayName),
      });
      const joinedCode = normalizeRoomCode(result.code);
      updateSession((current) => ({ ...current, activeCode: joinedCode }));
      router.push(`/room/${encodeURIComponent(joinedCode)}`);
    } catch (cause) {
      setError(toActionableError(cause));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <BackgroundMusic src="/music/main-lobby-music.mp3" volume={audioSettings.lobbyMusicVolume} />
      <HomeScreen
        accountLabel={accountLabel}
        activeCode={session?.activeCode}
        audioSettings={audioSettings}
        displayName={displayName}
        error={error}
        initialJoinCode={initialJoinCode}
        initialJoinOpen={initialJoinOpen}
        onCreateRoom={handleCreateRoom}
        onAudioSettingsChange={onAudioSettingsChange}
        onDisplayNameChange={onDisplayNameChange}
        onJoinRoom={handleJoinRoom}
        onQuickPlay={handleQuickPlay}
        onSignOut={signOut}
        pendingAction={pendingAction}
        profileImageUrl={profileImageUrl}
      />
    </>
  );
}
