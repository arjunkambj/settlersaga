"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { Icon } from "@iconify/react";
import houseIcon from "@iconify-icons/game-icons/house";
import backIcon from "@iconify-icons/solar/arrow-left-linear";
import userIcon from "@iconify-icons/solar/user-bold-duotone";
import { useMutation } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAppSession } from "@/components/app/app-session-context";
import { LobbySettings, type LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { Button, buttonVariants } from "@/components/ui/button";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { toActionableError } from "@/lib/app/action-errors";
import { cleanDisplayName } from "@/lib/app/display-name";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

export function HostIslandScreen() {
  const { displayName, error, pendingAction, setError, setPendingAction, updateSession } =
    useAppSession();
  const router = useRouter();
  const createRoom = useMutation(api.rooms.createRoom);
  const updateLobbyConfiguration = useMutation(api.rooms.updateLobbyConfiguration);

  const [lobbySettings, setLobbySettings] = useState<LobbySettingsValue>({
    botCount: 0,
    botDifficulty: "medium",
    settings: { ...DEFAULT_BASE_GAME_SETTINGS },
  });

  const isPending = pendingAction !== null;

  const handleHostIsland = async () => {
    setError("");
    setPendingAction("create");
    try {
      const created = await createRoom({
        displayName: cleanDisplayName(displayName),
      });
      const normalizedCode = normalizeRoomCode(created.code);
      if (!isRoomCode(normalizedCode)) {
        throw new Error("Invalid room code generated");
      }

      await updateLobbyConfiguration({
        botCount: lobbySettings.botCount,
        botDifficulty: lobbySettings.botDifficulty,
        code: normalizedCode,
        settings: lobbySettings.settings,
      });

      updateSession((current) => ({ ...current, activeCode: normalizedCode }));
      router.push(`/room/${encodeURIComponent(normalizedCode)}`);
    } catch (cause) {
      setError(toActionableError(cause));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main className="min-h-dvh bg-background flex flex-col" id="main-content">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Link
            aria-label="Return home"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            href="/"
          >
            <Icon icon={backIcon} className="h-5 w-5" />
          </Link>
          <span aria-hidden="true" className="text-lg font-black leading-none tracking-tight">
            S
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">Host Island</p>
            <p className="text-xs text-muted-foreground">Private Room Setup</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold">
          <Icon icon={userIcon} className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{displayName || "Explorer"}</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl w-full p-4 sm:p-6 space-y-6 flex-1">
        <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border bg-card p-5">
          <Image
            alt="Host Island"
            className="h-28 w-auto object-contain shrink-0"
            height={200}
            src="/home-assets/menu/host-island-v2.png"
            width={320}
          />
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              <Icon icon={houseIcon} className="h-3.5 w-3.5" /> Multiplayer Private Room
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Host a Private Island</h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Create a custom table, set rules for your crew, and receive a 6-character room code to
              invite friends or add optional AI bots.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 sm:p-7 space-y-6">
          <LobbySettings
            botCount={lobbySettings.botCount}
            botDifficulty={lobbySettings.botDifficulty}
            disabled={isPending}
            humanCount={1}
            minBotCount={0}
            onChange={setLobbySettings}
            settings={lobbySettings.settings}
          />

          {error ? (
            <div className="flex justify-center pt-2">
              <LiveMessage message={error} />
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-5">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              After creating your room, share your 6-character friend code with your crew to join.
            </p>
            <Button
              className="w-full sm:w-auto min-w-[220px] h-11 text-base font-bold rounded-xl"
              disabled={isPending || !displayName.trim()}
              onClick={() => void handleHostIsland()}
            >
              {pendingAction === "create" ? (
                <>
                  <Spinner data-icon="inline-start" /> Hosting Island...
                </>
              ) : (
                <>
                  <Icon icon={houseIcon} className="mr-2 h-5 w-5" /> Host Island Room
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
