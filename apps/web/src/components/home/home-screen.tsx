"use client";

import { useRouter } from "next/navigation";

import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState } from "react";
import botIcon from "@iconify-icons/game-icons/robot-golem";
import logoutIcon from "@iconify-icons/solar/logout-2-outline";
import playIcon from "@iconify-icons/solar/play-bold";
import settingsIcon from "@iconify-icons/solar/settings-minimalistic-outline";

import { LobbySettings, type LobbySettingsValue } from "@/components/lobby/lobby-settings";
import { AudioSettingsControls } from "@/components/audio/audio-settings-controls";
import { LiveMessage } from "@/components/ui/live-message";
import { cleanDisplayName } from "@/lib/app/display-name";
import type { PendingAction } from "@/lib/app/pending-action";
import type { AudioSettings } from "@/lib/audio-settings";
import { toBotCount } from "@/lib/lobby/lobby-settings-model";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";

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
  const [displayNameDraft, setDisplayNameDraft] = useState(displayName);
  const [audioSettingsDraft, setAudioSettingsDraft] = useState(audioSettings);
  const [audioSettingsAtOpen, setAudioSettingsAtOpen] = useState(audioSettings);
  const [quickSettings, setQuickSettings] = useState<LobbySettingsValue>({
    botCount: 3,
    botDifficulty: "medium",
    settings: { ...DEFAULT_BASE_GAME_SETTINGS },
  });
  const isPending = pendingAction !== null;

  const openPlayerSettings = () => {
    setDisplayNameDraft(displayName);
    setAudioSettingsDraft(audioSettings);
    setAudioSettingsAtOpen(audioSettings);
    setShowPlayerSettings(true);
  };
  const savePlayerSettings = () => {
    onDisplayNameChange(cleanDisplayName(displayNameDraft));
    setShowPlayerSettings(false);
  };
  const cancelPlayerSettings = () => {
    onAudioSettingsChange(audioSettingsAtOpen);
    setShowPlayerSettings(false);
  };
  const updateAudioSettingsDraft = (settings: AudioSettings) => {
    setAudioSettingsDraft(settings);
    onAudioSettingsChange(settings);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden" id="main-content">
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/shared-assets/coastal-island-kingdom-supercell.png"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#012d5c]/90 via-[#01315f]/55 to-[#01315f]/95" />
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-card/50 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-md">
          <span aria-hidden="true" className="text-lg font-black leading-none tracking-tight">
            S
          </span>
          <div>
            <p className="text-sm font-bold leading-none">SetterSaga</p>
            <p className="text-xs text-white/70">Settlers Saga</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full border border-white/15 bg-card/50 p-1 shadow-lg shadow-black/20 backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open player settings"
              disabled={isPending}
              onClick={openPlayerSettings}
            >
              <Icon icon={settingsIcon} />
            </Button>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-card/50 py-1 pr-1 pl-2 shadow-lg shadow-black/20 backdrop-blur-md">
            <Image
              alt=""
              height={28}
              width={28}
              className="h-7 w-7 rounded-full object-cover"
              src={profileImageUrl ?? "/game-assets/players/red-navigator.png"}
            />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-none">{displayName}</p>
              <p className="text-xs text-white/70 leading-none">{accountLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              disabled={isPending && pendingAction !== "signout"}
              onClick={() => void onSignOut()}
            >
              <Icon icon={logoutIcon} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 pt-6 sm:p-6 sm:pt-6 space-y-6">
        {activeCode ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/15 bg-card/55 p-4 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-5">
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Game in Progress
              </p>
              <h2 className="text-lg font-bold">
                Room <span className="font-mono">{activeCode}</span> is still active
              </h2>
              <p className="text-xs text-white/70">Hop back in anytime.</p>
            </div>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => router.push(`/room/${encodeURIComponent(activeCode)}`)}
            >
              <Icon icon={playIcon} className="mr-2 h-4 w-4" /> Rejoin
            </Button>
          </div>
        ) : null}

        <div className="text-center">
          <h1 className="text-2xl font-bold drop-shadow-md">How do you want to play?</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex flex-col overflow-hidden border-white/15 bg-card/50 shadow-xl shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-2xl">
            <div className="relative h-32 w-full overflow-hidden bg-gradient-to-b from-white/10 to-transparent flex items-center justify-center">
              <Image
                alt="Quick Match"
                className="h-24 w-24 shrink-0 object-contain drop-shadow-lg sm:h-28 sm:w-28"
                height={140}
                src="/home-assets/menu/quick-match-v2.png"
                width={140}
              />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Match</CardTitle>
              <CardDescription>Instant game with bots</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              {onQuickPlay ? (
                <Button
                  className="w-full"
                  disabled={isPending || !displayName.trim()}
                  onClick={() => setShowBotSetup(true)}
                >
                  {pendingAction === "quick" ? (
                    <>
                      <Spinner data-icon="inline-start" /> Starting...
                    </>
                  ) : (
                    "Quick Match"
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={isPending || !displayName.trim()}
                  onClick={() => router.push("/quick-match")}
                >
                  Quick Match
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col overflow-hidden border-white/15 bg-card/50 shadow-xl shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-2xl">
            <div className="relative h-32 w-full overflow-hidden bg-gradient-to-b from-white/10 to-transparent flex items-center justify-center">
              <Image
                alt="Custom Game"
                className="h-24 w-24 shrink-0 object-contain drop-shadow-lg sm:h-28 sm:w-28"
                height={140}
                src="/home-assets/menu/host-island-v2.png"
                width={140}
              />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Custom Game</CardTitle>
              <CardDescription>Set rules and invite friends</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              <Button
                className="w-full"
                disabled={isPending || !displayName.trim()}
                onClick={() => void onCreateRoom()}
              >
                {pendingAction === "create" ? (
                  <>
                    <Spinner data-icon="inline-start" /> Creating...
                  </>
                ) : (
                  "Create Custom Game"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col overflow-hidden border-white/15 bg-card/50 shadow-xl shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-2xl">
            <div className="relative h-32 w-full overflow-hidden bg-gradient-to-b from-white/10 to-transparent flex items-center justify-center">
              <Image
                alt="Join Crew"
                className="h-24 w-24 shrink-0 object-contain drop-shadow-lg sm:h-28 sm:w-28"
                height={140}
                src="/home-assets/menu/join-crew-v2.png"
                width={140}
              />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Join Crew</CardTitle>
              <CardDescription>Enter a room code</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-2">
              <Button
                className="w-full"
                variant="secondary"
                disabled={isPending || !displayName.trim()}
                onClick={() => setShowJoinRoom(true)}
              >
                {pendingAction === "join" ? (
                  <>
                    <Spinner data-icon="inline-start" /> Joining...
                  </>
                ) : (
                  "Join Crew"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <div className="mt-4 flex justify-center">
            <LiveMessage message={error} />
          </div>
        ) : null}
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

      <Dialog
        open={showPlayerSettings}
        onOpenChange={(open) => {
          if (!open && !isPending) cancelPlayerSettings();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <form
            id="player-settings-form"
            onSubmit={(event) => {
              event.preventDefault();
              savePlayerSettings();
            }}
            className="space-y-4"
          >
            <Field>
              <FieldLabel htmlFor="display-name-input">Display name</FieldLabel>
              <Input
                id="display-name-input"
                autoComplete="off"
                autoFocus
                maxLength={24}
                placeholder="Your name"
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
              />
            </Field>
            <Separator />
            <AudioSettingsControls
              onChange={updateAudioSettingsDraft}
              settings={audioSettingsDraft}
            />
          </form>
          <DialogFooter>
            <Button variant="ghost" disabled={isPending} onClick={cancelPlayerSettings}>
              Cancel
            </Button>
            <Button
              form="player-settings-form"
              type="submit"
              disabled={isPending || !displayNameDraft.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBotSetup}
        onOpenChange={(open) => {
          if (!open && !isPending) setShowBotSetup(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Match Setup</DialogTitle>
            <DialogDescription>Choose rules and bot difficulty.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <LobbySettings
              botCount={quickSettings.botCount}
              botDifficulty={quickSettings.botDifficulty}
              disabled={isPending}
              humanCount={1}
              minBotCount={toBotCount(quickSettings.settings.maxPlayers - 1)}
              onChange={(value) => setQuickSettings(normalizeQuickSettings(value))}
              settings={quickSettings.settings}
            />
          </div>
          <p className="text-xs text-muted-foreground">All open seats will be filled with bots.</p>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => {
                if (onQuickPlay) void onQuickPlay(quickSettings);
              }}
              className="w-full sm:w-auto"
            >
              <Icon icon={botIcon} />
              {pendingAction === "quick" ? (
                <>
                  <Spinner data-icon="inline-start" /> Starting...
                </>
              ) : (
                "Start Quick Match"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function normalizeQuickSettings(next: LobbySettingsValue): LobbySettingsValue {
  return { ...next, botCount: toBotCount(next.settings.maxPlayers - 1) };
}
