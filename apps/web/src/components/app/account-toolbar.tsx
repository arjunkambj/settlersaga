"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import logoutIcon from "@iconify-icons/solar/logout-2-bold";
import settingsIcon from "@iconify-icons/solar/settings-minimalistic-bold";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState } from "react";

import { useOptionalAppSession } from "@/components/app/app-session-context";
import { PlayerSettingsDialog } from "@/components/app/player-settings-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_AUDIO_SETTINGS } from "@/lib/audio-settings";
import { cn } from "@/lib/utils";

export function AccountToolbar({
  className,
  tone = "solid",
}: {
  className?: string;
  tone?: "glass" | "solid";
}) {
  const session = useOptionalAppSession();
  const accountLabel = session?.accountLabel ?? "";
  const audioSettings = session?.audioSettings ?? DEFAULT_AUDIO_SETTINGS;
  const displayName = session?.displayName ?? "";
  const onAudioSettingsChange = session?.onAudioSettingsChange;
  const onDisplayNameChange = session?.onDisplayNameChange;
  const pendingAction = session?.pendingAction ?? null;
  const profileImageUrl = session?.profileImageUrl ?? null;
  const signOut = session?.signOut;
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const isPending = pendingAction !== null;
  const chipClass =
    tone === "glass"
      ? "bg-card/50 shadow-lg shadow-background/40 backdrop-blur-md hover:bg-card/80"
      : "bg-card hover:bg-card/80";

  if (!session) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger
          aria-label="Settings"
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50",
            chipClass,
          )}
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
          className={cn(
            "inline-flex max-w-48 items-center gap-2 rounded-full py-1 pr-3 pl-1 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50",
            chipClass,
          )}
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
            onClick={() => void signOut?.()}
          >
            <Icon icon={logoutIcon} />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PlayerSettingsDialog
        audioSettings={audioSettings}
        displayName={displayName}
        isPending={isPending}
        onAudioSettingsChange={onAudioSettingsChange}
        onDisplayNameChange={onDisplayNameChange}
        onOpenChange={setShowPlayerSettings}
        open={showPlayerSettings}
      />
    </div>
  );
}
