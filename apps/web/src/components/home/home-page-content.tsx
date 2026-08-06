"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAppSession } from "@/components/app/app-session-context";
import { BackgroundMusic } from "@/components/audio/background-music";
import { HomeScreen } from "@/components/home/home-screen";
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

  useEffect(() => {
    if (!requestedRoom) return;
    const normalized = normalizeRoomCode(requestedRoom);
    if (isRoomCode(normalized)) {
      router.replace(`/room/${encodeURIComponent(normalized)}`);
    }
  }, [requestedRoom, router]);

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
        onAudioSettingsChange={onAudioSettingsChange}
        onDisplayNameChange={onDisplayNameChange}
        onJoinRoom={handleJoinRoom}
        onSignOut={signOut}
        pendingAction={pendingAction}
        profileImageUrl={profileImageUrl}
      />
    </>
  );
}
