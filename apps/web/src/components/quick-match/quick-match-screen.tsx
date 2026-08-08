"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { Icon } from "@iconify/react";
import botIcon from "@iconify-icons/game-icons/robot-golem";
import backIcon from "@iconify-icons/solar/arrow-left-linear";
import userIcon from "@iconify-icons/solar/user-bold-duotone";
import { useMutation } from "convex/react";
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
    <main className="flex min-h-dvh flex-col bg-background" id="main-content">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4">
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
            <p className="text-sm font-bold leading-tight">Quick Match</p>
            <p className="text-xs text-muted-foreground">Instant Bot Voyage</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold">
          <Icon icon={userIcon} className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{displayName || "Explorer"}</span>
        </div>
      </div>

      <div className="flex-1">
        <div className="container mx-auto max-w-3xl space-y-4 p-4 pb-28 sm:p-6 sm:pb-28">
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
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
          </div>

          {error ? (
            <div className="flex justify-center">
              <LiveMessage message={error} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-0 shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="container mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6">
          <p className="hidden max-w-[34ch] text-xs leading-relaxed text-muted-foreground sm:block">
            Quick match fills every open seat with bots and launches immediately.
          </p>
          <Button
            className="w-full sm:ml-auto sm:w-auto min-w-[240px] h-11 text-base font-bold rounded-xl"
            disabled={isPending || !displayName.trim()}
            onClick={() => void handleStartQuickMatch()}
          >
            {pendingAction === "quick" ? (
              <>
                <Spinner data-icon="inline-start" /> Building Island...
              </>
            ) : (
              <>
                <Icon icon={botIcon} className="mr-2 h-5 w-5" /> Start Quick Match
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
