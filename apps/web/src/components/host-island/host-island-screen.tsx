"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { Icon } from "@iconify/react";
import houseIcon from "@iconify-icons/game-icons/house";
import backIcon from "@iconify-icons/solar/arrow-left-linear";
import { useMutation } from "convex/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAppSession } from "@/components/app/app-session-context";
import { LobbySettings, type LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { Button } from "@/components/ui/button";
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

      // Apply custom settings if different from standard defaults
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
    <main className="min-h-dvh bg-background" id="main-content">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Return home"
            onClick={() => router.push("/")}
          >
            <Icon icon={backIcon} className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              S
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Host Island</p>
              <p className="text-xs text-muted-foreground">Private Room Setup</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
          <Image
            alt="Host Island"
            className="h-24 w-auto object-contain rounded-md"
            height={200}
            src="/home-assets/menu/host-island-v2.png"
            width={320}
          />
          <div>
            <h1 className="text-xl font-bold">Host a Private Island</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Configure custom player limits, victory points, turn timer, and friendly robber rules
              for your table.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-xs space-y-6">
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
            <div className="flex justify-center">
              <LiveMessage message={error} />
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              After creating your room, you will receive a unique 6-character friend code to share
              with your crew.
            </p>
            <Button
              className="w-full sm:w-auto min-w-[200px]"
              disabled={isPending || !displayName.trim()}
              onClick={() => void handleHostIsland()}
            >
              <Icon icon={houseIcon} className="mr-2 h-4 w-4" />
              {pendingAction === "create" ? (
                <>
                  <Spinner data-icon="inline-start" /> Hosting Island...
                </>
              ) : (
                "Host Island Room"
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
