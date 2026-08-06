"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { Icon } from "@iconify/react";
import botIcon from "@iconify-icons/game-icons/robot-golem";
import backIcon from "@iconify-icons/solar/arrow-left-linear";
import userIcon from "@iconify-icons/solar/user-bold-duotone";
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

  const applyPreset = (preset: "standard" | "duel" | "conquest") => {
    if (preset === "standard") {
      setQuickSettings({
        botCount: 3,
        botDifficulty: "medium",
        settings: { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 4, victoryPoints: 10 },
      });
    } else if (preset === "duel") {
      setQuickSettings({
        botCount: 2,
        botDifficulty: "hard",
        settings: {
          ...DEFAULT_BASE_GAME_SETTINGS,
          maxPlayers: 3,
          turnTimerSeconds: 30,
          victoryPoints: 10,
        },
      });
    } else if (preset === "conquest") {
      setQuickSettings({
        botCount: 3,
        botDifficulty: "hard",
        settings: { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 4, victoryPoints: 12 },
      });
    }
  };

  return (
    <main className="min-h-dvh bg-background flex flex-col" id="main-content">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Return home"
            onClick={() => router.push("/")}
          >
            <Icon icon={backIcon} className="h-5 w-5" />
          </Button>
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

      <div className="mx-auto max-w-4xl w-full p-4 sm:p-6 space-y-6 flex-1">
        <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border bg-card p-5">
          <Image
            alt="Quick Match Voyage"
            className="h-28 w-auto object-contain shrink-0"
            height={200}
            src="/home-assets/menu/quick-match-v2.png"
            width={320}
          />
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              <Icon icon={botIcon} className="h-3.5 w-3.5" /> Singleplayer & Bot AI
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Quick Match Voyage</h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Launch an instant game populated with AI explorers. Customize rules, victory points,
              and bot difficulty below, or select a preset to begin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-2 rounded-xl border">
          <span className="text-xs font-bold text-muted-foreground px-2">Presets:</span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => applyPreset("standard")}
            className="rounded-lg text-xs"
          >
            Standard (4P, Medium)
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => applyPreset("duel")}
            className="rounded-lg text-xs"
          >
            Fast Duel (3P, Hard, Timed)
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => applyPreset("conquest")}
            className="rounded-lg text-xs"
          >
            High VP Conquest (12 VP)
          </Button>
        </div>

        <div className="rounded-2xl border bg-card p-5 sm:p-7 space-y-6">
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
            <div className="flex justify-center pt-2">
              <LiveMessage message={error} />
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-5">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              Quick match reserves all open seats for AI bots and launches immediately into the
              island.
            </p>
            <Button
              className="w-full sm:w-auto min-w-[220px] h-11 text-base font-bold rounded-xl"
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
      </div>
    </main>
  );
}