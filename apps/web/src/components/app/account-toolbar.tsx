"use client";

import logoutIcon from "@iconify-icons/solar/logout-2-bold";
import settingsIcon from "@iconify-icons/solar/settings-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useState } from "react";

import { useAppSession } from "@/components/app/app-session-context";
import { PlayerSettingsDialog } from "@/components/app/player-settings-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import { cn } from "@/lib/utils";

/**
 * Settings and account buttons for the top-right corner of menu screens. `roomy` grows them to
 * 48px on large screens, for the home header's bigger capsules.
 */
export function AccountToolbar({ roomy = false }: { roomy?: boolean }) {
  const {
    accountLabel,
    audioSettings,
    displayName,
    isGuest,
    onAudioSettingsChange,
    onDisplayNameChange,
    pendingAction,
    profileImageUrl,
    signOut,
  } = useAppSession();
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  // Guests confirm first; anyone else sees the same dialog only if signing out fails.
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const isPending = pendingAction !== null;

  const handleSignOut = () => {
    setSignOutError("");
    setSigningOut(true);
    signOut().catch(() => {
      setSignOutError("We couldn't sign you out. Check your connection and try again.");
      setShowSignOutDialog(true);
      setSigningOut(false);
    });
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Tooltip label="Settings">
        <Button
          aria-label="Settings"
          className={cn(roomy && "lg:size-12")}
          disabled={isPending}
          onClick={() => setShowPlayerSettings(true)}
          size="game-md"
          variant="game-icon"
        >
          <Icon icon={settingsIcon} />
        </Button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account: ${displayName}`}
          className={cn(
            buttonVariants({ size: "game-md", variant: "game-icon" }),
            "w-auto max-w-56 gap-2 p-1 sm:pr-4",
            roomy && "lg:h-12 lg:w-auto lg:gap-2.5 lg:pr-5",
          )}
          disabled={isPending || signingOut}
        >
          <Image
            alt=""
            className={cn("size-8 shrink-0 rounded-full object-cover", roomy && "lg:size-10")}
            height={40}
            src={profileImageUrl ?? getPlayerPortraitPath("red")}
            width={40}
          />
          <span
            className={cn(
              "hidden min-w-0 truncate text-sm sm:inline",
              roomy && "lg:text-[0.9375rem]",
            )}
          >
            {displayName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={10}>
          <div className="flex max-w-64 flex-col gap-0.5 px-2.5 py-2">
            <p className="truncate text-base font-extrabold">{displayName}</p>
            <p className="truncate text-sm font-semibold text-muted-foreground">{accountLabel}</p>
          </div>
          <DropdownMenuItem
            onClick={() => (isGuest ? setShowSignOutDialog(true) : handleSignOut())}
            variant="destructive"
          >
            <Icon icon={logoutIcon} />
            Sign out
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

      {showSignOutDialog ? (
        <ConfirmationDialog
          busy={signingOut}
          confirmLabel="Sign out"
          description={
            isGuest
              ? "Once you sign out, this guest profile is gone. You'll lose this name and any seat you hold in a game."
              : "Sign back in with the same account any time to pick up where you left off."
          }
          error={signOutError}
          onCancel={() => {
            setSignOutError("");
            setShowSignOutDialog(false);
          }}
          onConfirm={handleSignOut}
          title={isGuest ? "Sign out as guest?" : "Sign out?"}
        />
      ) : null}
    </div>
  );
}
