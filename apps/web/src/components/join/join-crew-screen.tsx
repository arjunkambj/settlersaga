"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { Icon } from "@iconify/react";
import backIcon from "@iconify-icons/solar/arrow-left-bold";
import usersIcon from "@iconify-icons/solar/users-group-rounded-bold";
import { useMutation } from "convex/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BrandMark } from "@/components/app/brand-logo";
import { useAppSession } from "@/components/app/app-session-context";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { toActionableError } from "@/lib/app/action-errors";
import { cleanDisplayName } from "@/lib/app/display-name";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

export function JoinCrewScreen() {
  return (
    <Suspense fallback={null}>
      <JoinCrewScreenInner />
    </Suspense>
  );
}

function JoinCrewScreenInner() {
  const { displayName, error, pendingAction, setError, setPendingAction, updateSession } =
    useAppSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") ?? searchParams.get("room") ?? "";
  const [joinCode, setJoinCode] = useState(() => normalizeRoomCode(initialCode));
  const joinRoom = useMutation(api.rooms.joinRoom);

  const isPending = pendingAction !== null;

  const handleJoinCrew = async (codeToJoin: string) => {
    const normalizedCode = normalizeRoomCode(codeToJoin);
    if (!isRoomCode(normalizedCode)) {
      setError("The room code must be 6 letters or numbers.");
      return;
    }

    setError("");
    setPendingAction("join");
    try {
      const result = await joinRoom({
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
    <main className="min-h-dvh bg-background" id="main-content">
      <div className="flex items-center gap-2 px-4 pt-4">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Return home"
          onClick={() => router.push("/")}
        >
          <Icon icon={backIcon} className="h-5 w-5" />
        </Button>
        <BrandMark className="size-8 drop-shadow-none" />
        <div>
          <p className="text-sm font-bold leading-none">Join Crew</p>
          <p className="text-xs text-muted-foreground">Private Room Entry</p>
        </div>
      </div>

      <div className="mx-auto max-w-xl p-4 sm:p-6">
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 rounded-xl bg-card p-4">
          <Image
            alt="Join Crew"
            className="h-24 w-auto object-contain rounded-md"
            height={200}
            src="/home-assets/menu/join-crew.png"
            width={320}
          />
          <div>
            <h1 className="text-xl font-bold">Enter Friend Code</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Ask the host for their 6-character room code, then join their table on the island.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-card p-6 space-y-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleJoinCrew(joinCode);
            }}
            className="space-y-4"
          >
            <Field>
              <FieldLabel htmlFor="room-code">Friend Room Code</FieldLabel>
              <Input
                id="room-code"
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                className="text-center font-mono text-xl tracking-widest uppercase"
                maxLength={6}
                placeholder="ABC123"
                spellCheck={false}
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              />
              <p className="text-xs text-muted-foreground text-center">
                {joinCode.length === 0
                  ? "Room codes contain exactly six letters or numbers."
                  : isRoomCode(joinCode)
                    ? "Code ready — click below to join the crew."
                    : `${6 - joinCode.length} character${6 - joinCode.length === 1 ? "" : "s"} remaining.`}
              </p>
            </Field>

            {error ? (
              <div className="flex justify-center">
                <LiveMessage message={error} />
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full text-base py-5"
              disabled={isPending || !isRoomCode(joinCode) || !displayName.trim()}
            >
              <Icon icon={usersIcon} className="mr-2 h-5 w-5" />
              {pendingAction === "join" ? (
                <>
                  <Spinner data-icon="inline-start" /> Joining Crew...
                </>
              ) : (
                "Join Island Crew"
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
