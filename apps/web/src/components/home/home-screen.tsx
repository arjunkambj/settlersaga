"use client";

import { useRouter } from "next/navigation";

import { DEFAULT_BASE_GAME_SETTINGS, type BotDifficulty } from "@settersaga/game";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState } from "react";
import arrowRightIcon from "@iconify-icons/solar/arrow-right-bold";
import logoutIcon from "@iconify-icons/solar/logout-2-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import settingsIcon from "@iconify-icons/solar/settings-minimalistic-bold";

import { BrandMark } from "@/components/app/brand-logo";
import { PlayerSettingsDialog } from "@/components/app/player-settings-dialog";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import type { LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { QuickMatchDialog } from "@/components/quick-match/quick-match-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiveMessage } from "@/components/ui/live-message";
import type { PendingAction } from "@/lib/app/pending-action";
import type { AudioSettings } from "@/lib/audio-settings";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";
import { cn } from "@/lib/utils";

export interface HomeScreenProps {
  accountLabel: string;
  activeCode?: string;
  audioSettings: AudioSettings;
  displayName: string;
  error: string;
  initialJoinCode?: string;
  initialJoinOpen?: boolean;
  onCreateRoom(): Promise<void>;
  onAudioSettingsChange(settings: AudioSettings): void;
  onDisplayNameChange(value: string): void;
  onJoinRoom?(code: string): Promise<void>;
  onQuickPlay?(value: LobbySettingsValue): Promise<void>;
  onSignOut(): Promise<void | null>;
  pendingAction: PendingAction;
  profileImageUrl: string | null;
}

export function HomeScreen({
  accountLabel,
  activeCode,
  audioSettings,
  displayName,
  error,
  initialJoinCode,
  initialJoinOpen,
  onCreateRoom,
  onAudioSettingsChange,
  onDisplayNameChange,
  onJoinRoom,
  onQuickPlay,
  onSignOut,
  pendingAction,
  profileImageUrl,
}: HomeScreenProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");
  const [showJoinRoom, setShowJoinRoom] = useState(initialJoinOpen ?? false);
  const [showBotSetup, setShowBotSetup] = useState(false);
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const isPending = pendingAction !== null;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden" id="main-content">
      <SceneBackdrop />

      <div className="relative z-20 flex items-center justify-between gap-3 p-4">
        <BrandMark priority />
        <div className="flex items-center gap-2">
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger
              aria-label="Settings"
              className="inline-flex size-10 items-center justify-center rounded-full bg-card/50 text-foreground shadow-lg shadow-background/40 backdrop-blur-md hover:bg-card/80 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50"
              delay={200}
              disabled={isPending}
              onClick={() => setShowPlayerSettings(true)}
              type="button"
            >
              <Icon icon={settingsIcon} />
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Positioner align="center" side="bottom" sideOffset={8}>
                <TooltipPrimitive.Popup className="z-50 rounded-xl bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md outline-none">
                  Settings
                </TooltipPrimitive.Popup>
              </TooltipPrimitive.Positioner>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account"
              className="inline-flex max-w-48 items-center gap-2 rounded-full bg-card/50 py-1 pr-3 pl-1 shadow-lg shadow-background/40 backdrop-blur-md hover:bg-card/80 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50"
              disabled={isPending}
            >
              <Image
                alt=""
                height={32}
                width={32}
                className="size-8 shrink-0 rounded-full object-cover"
                src={profileImageUrl ?? "/game-assets/players/red-navigator.png"}
              />
              <span className="min-w-0 truncate text-sm font-semibold">{displayName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44" side="bottom" sideOffset={12}>
              {accountLabel && accountLabel !== displayName ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{accountLabel}</p>
              ) : null}
              <DropdownMenuItem
                disabled={isPending && pendingAction !== "signout"}
                onClick={() => void onSignOut()}
              >
                <Icon icon={logoutIcon} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] px-4 pb-8 sm:px-6">
        <div className="flex flex-col items-center justify-end pb-5">
          <div className="relative">
            {activeCode ? (
              <button
                aria-label={`Rejoin room ${activeCode}`}
                className={cn(
                  voyageCardClassName,
                  "absolute bottom-full left-1/2 mb-3 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 flex-row items-center justify-between gap-3 px-4 py-2.5 text-left",
                )}
                onClick={() => router.push(`/room/${encodeURIComponent(activeCode)}`)}
                type="button"
              >
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold tracking-wide uppercase">
                    Game in progress
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Room{" "}
                    <span className="font-mono font-semibold text-foreground">{activeCode}</span> is
                    still active
                  </p>
                </div>
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-5" icon={playIcon} />
                </span>
              </button>
            ) : null}
            <div className="space-y-1 text-center">
              <h1 className="font-heading text-3xl font-bold drop-shadow-md sm:text-4xl">
                Choose your voyage
              </h1>
              <p className="text-sm font-medium text-foreground/90 drop-shadow-md">
                Play now, host a table, or join a crew.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-stretch gap-5 sm:grid-cols-3">
          <PlayModeButton
            actionLabel={
              pendingAction === "quick" ? "Starting..." : "Play instantly with bots or players"
            }
            artSrc="/home-assets/menu/quick-match.png"
            className="sm:col-start-2 sm:row-start-1"
            disabled={isPending || !displayName.trim()}
            onClick={() => setShowBotSetup(true)}
            pending={pendingAction === "quick"}
            title="Quick Match"
          />
          <PlayModeButton
            actionLabel={pendingAction === "create" ? "Creating..." : "Create a private room"}
            artSrc="/home-assets/menu/host-island.png"
            className="sm:col-start-1 sm:row-start-1"
            disabled={isPending || !displayName.trim()}
            onClick={() => void onCreateRoom()}
            pending={pendingAction === "create"}
            title="Host Island"
          />
          <PlayModeButton
            actionLabel={pendingAction === "join" ? "Joining..." : "Enter a friend code"}
            artSrc="/home-assets/menu/join-crew.png"
            className="sm:col-start-3 sm:row-start-1"
            disabled={isPending || !displayName.trim()}
            onClick={() => setShowJoinRoom(true)}
            pending={pendingAction === "join"}
            title="Join Crew"
          />
        </div>

        <div className="flex justify-center pt-4">
          {error && !showBotSetup ? <LiveMessage message={error} /> : null}
        </div>
      </div>

      <Dialog
        open={showJoinRoom}
        onOpenChange={(open) => {
          if (!open && !isPending) setShowJoinRoom(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Room Code</DialogTitle>
            <DialogDescription>Enter the 6-character code from your host.</DialogDescription>
          </DialogHeader>
          <form
            id="join-room-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (onJoinRoom) {
                void onJoinRoom(joinCode);
              }
            }}
            className="space-y-4"
          >
            <Field>
              <FieldLabel htmlFor="room-code">Room code</FieldLabel>
              <Input
                id="room-code"
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                maxLength={6}
                placeholder="ABC123"
                spellCheck={false}
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {joinCode.length === 0
                  ? "6 letters or numbers."
                  : isRoomCode(joinCode)
                    ? "Ready to join."
                    : `${6 - joinCode.length} left.`}
              </p>
            </Field>
          </form>
          <DialogFooter>
            <Button variant="ghost" disabled={isPending} onClick={() => setShowJoinRoom(false)}>
              Cancel
            </Button>
            <Button
              form="join-room-form"
              type="submit"
              disabled={isPending || !isRoomCode(joinCode) || !displayName.trim()}
            >
              {pendingAction === "join" ? (
                <>
                  <Spinner data-icon="inline-start" /> Joining...
                </>
              ) : (
                "Join Crew"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlayerSettingsDialog
        audioSettings={audioSettings}
        displayName={displayName}
        isPending={isPending}
        onAudioSettingsChange={onAudioSettingsChange}
        onDisplayNameChange={onDisplayNameChange}
        onOpenChange={setShowPlayerSettings}
        open={showPlayerSettings}
      />

      <QuickMatchDialog
        botDifficulty={botDifficulty}
        disabled={isPending}
        error={error}
        onBotDifficultyChange={setBotDifficulty}
        onOpenChange={setShowBotSetup}
        onStart={() => {
          if (!onQuickPlay) {
            return;
          }
          void onQuickPlay({
            botCount: 3,
            botDifficulty,
            settings: { ...DEFAULT_BASE_GAME_SETTINGS },
          });
        }}
        open={showBotSetup}
        pending={pendingAction === "quick"}
      />
    </main>
  );
}

const voyageCardClassName = cn(
  "group flex w-full overflow-hidden rounded-4xl",
  "border border-white/10 bg-gradient-to-b from-card/35 to-card/60",
  "focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
  "disabled:pointer-events-none disabled:opacity-50",
);

function PlayModeButton({
  actionLabel,
  artSrc,
  className,
  disabled,
  onClick,
  pending,
  title,
}: {
  actionLabel: string;
  artSrc: string;
  className?: string;
  disabled: boolean;
  onClick(): void;
  pending: boolean;
  title: string;
}) {
  return (
    <button
      className={cn(voyageCardClassName, "flex-col text-center", className)}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-center px-6 pt-8">
        <Image
          alt=""
          className="h-64 w-auto object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105 sm:h-72"
          height={640}
          src={artSrc}
          width={640}
        />
      </div>
      <div className="flex flex-col items-center px-5 pt-1 pb-6">
        <p className="font-heading text-xl font-bold tracking-wide uppercase">{title}</p>
        <p className="mt-1 max-w-56 text-sm text-muted-foreground">{actionLabel}</p>
        <span className="mt-4 inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {pending ? <Spinner /> : <Icon className="size-5" icon={arrowRightIcon} />}
        </span>
      </div>
    </button>
  );
}
