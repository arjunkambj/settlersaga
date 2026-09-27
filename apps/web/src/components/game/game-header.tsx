import type { PlayerGameView } from "@settersaga/game";
import chatIcon from "@iconify-icons/solar/chat-round-dots-bold";
import goalIcon from "@iconify-icons/solar/cup-star-bold";
import helpIcon from "@iconify-icons/solar/help-bold";
import menuIcon from "@iconify-icons/solar/hamburger-menu-bold";
import logoutIcon from "@iconify-icons/solar/logout-2-bold";
import pauseIcon from "@iconify-icons/solar/pause-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import settingsIcon from "@iconify-icons/solar/settings-bold";
import { Icon } from "@iconify/react/offline";
import type { Ref } from "react";

import { BrandMark, BrandWordmark } from "@/components/app/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { GAME_MAP_NAMES } from "@/lib/lobby/map-names";

import { GAME_HELP_DIALOG_ID } from "./game-help-dialog";

export const GAME_SIDEBAR_ID = "game-table-drawer";

/**
 * Brand on the left; the goal (turn and points to win) beside the table buttons on the right, so
 * the board's top edge stays clear. Phones fold pause, settings, help and leave into one menu.
 */
export function GameHeader({
  drawerOpen,
  drawerToggleRef,
  game,
  isHelpOpen,
  isHost,
  isPaused,
  onLeave,
  onOpenDrawer,
  onOpenHelp,
  onOpenSettings,
  onPauseChange,
  pauseChangePending,
  unreadChatCount,
}: {
  drawerOpen: boolean;
  drawerToggleRef: Ref<HTMLButtonElement>;
  game: PlayerGameView;
  isHelpOpen: boolean;
  isHost: boolean;
  isPaused: boolean;
  onLeave(): void;
  onOpenDrawer(): void;
  onOpenHelp(): void;
  onOpenSettings(): void;
  onPauseChange(shouldPause: boolean): void;
  pauseChangePending: boolean;
  unreadChatCount: number;
}) {
  const canPause = isHost && game.phase.kind !== "finished";
  const isSetup = game.phase.kind === "setup_settlement" || game.phase.kind === "setup_road";
  const pauseLabel = isPaused ? "Resume game" : "Pause game";
  const goalLabel = `${GAME_MAP_NAMES[game.settings.map]}, ${isSetup ? "opening round" : `turn ${game.turnNumber}`}. First to ${game.settings.victoryPoints} victory points wins.`;

  return (
    <header className="game-header">
      <div className="game-header-start">
        {/* Phones get the hex mark alone; the wordmark's letters would be too small there. */}
        <BrandMark className="game-brand-mark" />
        <BrandWordmark className="game-brand" priority />
      </div>

      <div className="game-header-end">
        <Tooltip label={goalLabel}>
          <p aria-label={goalLabel} className="game-goal-chip" role="img">
            <Icon aria-hidden="true" className="game-goal-icon" icon={goalIcon} />
            <span className="game-goal-turn">{isSetup ? "Setup" : `Turn ${game.turnNumber}`}</span>
            <span className="game-goal-points">
              <strong>{game.settings.victoryPoints} VP</strong> to win
            </span>
          </p>
        </Tooltip>
        <div className="game-header-tools">
          {canPause ? (
            <Tooltip label={pauseLabel}>
              <Button
                aria-label={pauseLabel}
                aria-pressed={isPaused}
                disabled={pauseChangePending}
                onClick={() => onPauseChange(!isPaused)}
                size="game-md"
                variant="game-icon"
              >
                <Icon aria-hidden="true" icon={isPaused ? playIcon : pauseIcon} />
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip label="Settings">
            <Button
              aria-haspopup="dialog"
              aria-label="Settings"
              onClick={onOpenSettings}
              size="game-md"
              variant="game-icon"
            >
              <Icon aria-hidden="true" icon={settingsIcon} />
            </Button>
          </Tooltip>
          <Tooltip label="How to play">
            <Button
              aria-controls={GAME_HELP_DIALOG_ID}
              aria-expanded={isHelpOpen}
              aria-haspopup="dialog"
              aria-label="How to play"
              onClick={onOpenHelp}
              size="game-md"
              variant="game-icon"
            >
              <Icon aria-hidden="true" icon={helpIcon} />
            </Button>
          </Tooltip>
          <Tooltip label="Leave game">
            <Button
              aria-haspopup="dialog"
              aria-label="Leave game"
              className="game-header-leave"
              onClick={onLeave}
              size="game-md"
              variant="game-danger"
            >
              <Icon aria-hidden="true" className="size-5" icon={logoutIcon} />
            </Button>
          </Tooltip>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Game menu"
            className={`game-header-menu ${buttonVariants({ size: "game-md", variant: "game-icon" })}`}
          >
            <Icon aria-hidden="true" icon={menuIcon} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10}>
            {canPause ? (
              <DropdownMenuItem
                disabled={pauseChangePending}
                onClick={() => onPauseChange(!isPaused)}
              >
                <Icon aria-hidden="true" icon={isPaused ? playIcon : pauseIcon} />
                {pauseLabel}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={onOpenSettings}>
              <Icon aria-hidden="true" icon={settingsIcon} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenHelp}>
              <Icon aria-hidden="true" icon={helpIcon} />
              How to play
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLeave} variant="destructive">
              <Icon aria-hidden="true" icon={logoutIcon} />
              Leave game
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          aria-controls={GAME_SIDEBAR_ID}
          aria-expanded={drawerOpen}
          aria-label={
            unreadChatCount > 0
              ? `Crew & chat, ${unreadChatCount} unread ${unreadChatCount === 1 ? "message" : "messages"}`
              : "Crew & chat"
          }
          className="game-drawer-toggle"
          onClick={onOpenDrawer}
          ref={drawerToggleRef}
          size="game-md"
          variant="game-icon"
        >
          <Icon aria-hidden="true" icon={chatIcon} />
          {unreadChatCount > 0 ? (
            <span aria-hidden="true" className="game-unread-badge">
              {unreadChatCount > 9 ? "9+" : unreadChatCount}
            </span>
          ) : null}
        </Button>
      </div>
    </header>
  );
}
