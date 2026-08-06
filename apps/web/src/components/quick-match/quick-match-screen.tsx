"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { Icon } from "@iconify/react";
import botIcon from "@iconify-icons/game-icons/robot-golem";
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
import { toBotCount } from "@/lib/lobby/lobby-settings-model";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

export function QuickMatchScreen() {
  const { displayName, error, pendingAction, setError, setPendingAction, updateSession } =
    useAppSession();
  const router = useRouter();
  const createQuickGame = useMutation(api.games.createQuickGame);

  const [quickSettings, setQuickSettings] = useState<LobbySettingsValue>({
    botCount: 3,
    botDifficulty: "medium",
    settings: { ...DEFAULT_BASE_GAME_SETTINGS },
  });

  const isPending = pendingAction !== null;

  const handleStartQuickMatch = async () => {
    setError("");
    setPendingAction("quick");
    try {
      const result = await createQuickGame({
        botCount: quickSettings.botCount,
        botDifficulty: quickSettings.botDifficulty,
        displayName: cleanDisplayName(displayName),
        settings: quickSettings.settings,
      });
      const normalizedCode = normalizeRoomCode(result.code);
      if (isRoomCode(normalizedCode)) {
        updateSession((current) => ({ ...current, activeCode: normalizedCode }));
        router.push(`/room/${encodeURIComponent(normalizedCode)}`);
      }
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
              <p className="text-sm font-bold leading-none">Quick Match</p>
              <p className="text-xs text-muted-foreground">Instant Bot Matchmaking</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
          <Image
            alt="Quick Match Voyage"
            className="h-24 w-auto object-contain rounded-md"
            height={200}
            src="/home-assets/menu/quick-match-v2.png"
            width={320}
          />
          <div>
            <h1 className="text-xl font-bold">Quick Match Setup</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Fill open seats instantly with AI explorers and jump right onto the island with your
              custom rules.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-xs space-y-6">
          <LobbySettings
            botCount={quickSettings.botCount}
            botDifficulty={quickSettings.botDifficulty}
            disabled={isPending}
            humanCount={1}
            minBotCount={toBotCount(quickSettings.settings.maxPlayers - 1)}
            onChange={(value) =>
              setQuickSettings({
                ...value,
                botCount: toBotCount(value.settings.maxPlayers - 1),
              })
            }
            settings={quickSettings.settings}
          />

          {error ? (
            <div className="flex justify-center">
              <LiveMessage message={error} />
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Quick matches fill all open seats with bots for the selected map and difficulty.
            </p>
            <Button
              className="w-full sm:w-auto min-w-[200px]"
              disabled={isPending || !displayName.trim()}
              onClick={() => void handleStartQuickMatch()}
            >
              <Icon icon={botIcon} className="mr-2 h-4 w-4" />
              {pendingAction === "quick" ? (
                <>
                  <Spinner data-icon="inline-start" /> Building the Island...
                </>
              ) : (
                "Start Quick Match"
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
