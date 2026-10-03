"use client";

import bookIcon from "@iconify-icons/solar/book-bookmark-bold";
import linkIcon from "@iconify-icons/solar/link-round-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import trashIcon from "@iconify-icons/solar/trash-bin-2-bold";
import usersIcon from "@iconify-icons/solar/users-group-rounded-bold";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import { ROOM_CODE_LENGTH } from "@settersaga/backend/convex/model/constants";
import { DEFAULT_BASE_GAME_SETTINGS, type BotDifficulty } from "@settersaga/game";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useState } from "react";

import { AccountToolbar } from "@/components/app/account-toolbar";
import { BrandWordmark } from "@/components/app/brand-logo";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import { GameHelpDialog } from "@/components/game/game-help-dialog";
import { QuickMatchDialog } from "@/components/quick-match/quick-match-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { toActionableError } from "@/lib/app/action-errors";
import type { PendingAction } from "@/lib/app/pending-action";
import { isRoomCode, normalizeRoomCode } from "@/lib/session";
import { cn } from "@/lib/utils";

// Imported rather than referenced by URL so each card gets a blurred placeholder while it loads.
import hostIslandArt from "../../../public/home-assets/menu/host-island.png";
import joinCrewArt from "../../../public/home-assets/menu/join-crew.png";
import quickMatchArt from "../../../public/home-assets/menu/quick-match.png";

/** A room this player is still seated in, offered as a one-tap rejoin. */
export interface RejoinRoom {
  /** The viewer is the host and may remove it: a lobby, or a game only bots are left playing. */
  canRemove: boolean;
  code: string;
  status: "active" | "waiting";
}

export interface HomeScreenProps {
  error: string;
  initialJoinCode?: string;
  initialJoinOpen?: boolean;
  onCreateRoom(): Promise<void>;
  onDismissError(): void;
  onJoinRoom(code: string): Promise<void>;
  onQuickPlay(botDifficulty: BotDifficulty): Promise<void>;
  /** Rejects when the server refuses, so the confirmation can say why and offer a retry. */
  onRemoveRoom(code: string): Promise<void>;
  pendingAction: PendingAction;
  rejoinRoom: RejoinRoom | null;
}

export function HomeScreen({
  error,
  initialJoinCode = "",
  initialJoinOpen = false,
  onCreateRoom,
  onDismissError,
  onJoinRoom,
  onQuickPlay,
  onRemoveRoom,
  pendingAction,
  rejoinRoom,
}: HomeScreenProps) {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [showJoinRoom, setShowJoinRoom] = useState(initialJoinOpen);
  const [showBotSetup, setShowBotSetup] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const isPending = pendingAction !== null;

  // Each dialog shows only its own action's error, so opening or closing one clears it.
  const setDialogOpen = (setOpen: (value: boolean) => void, open: boolean) => {
    onDismissError();
    setOpen(open);
  };

  return (
    <main className="home-screen relative" id="main-content">
      <SceneBackdrop />

      <header className="home-header relative z-20">
        <BrandWordmark className="w-32 shrink-0 sm:w-48 lg:w-56" priority />
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            className="sm:w-auto sm:px-4 lg:h-12 lg:px-5 lg:text-[0.9375rem]"
            onClick={() => setShowHelp(true)}
            size="game-md"
            variant="game-icon"
          >
            <Icon icon={bookIcon} />
            <span className="sr-only sm:not-sr-only">How to play</span>
          </Button>
          <AccountToolbar roomy />
        </div>
      </header>

      {/* Three rows under the header: the lead, the cards, and an equal row below. The outer
          rows share the leftover height, so the cards stay centered whether or not the rejoin
          bar is showing. */}
      <div className="home-stage">
        <div className="home-lead relative z-20">
          {rejoinRoom ? (
            <RejoinBar disabled={isPending} onRemove={onRemoveRoom} room={rejoinRoom} />
          ) : null}
          <h1 className="game-heading game-title-on-art home-title">Pick a way to play</h1>
        </div>

        <div className="home-modes relative z-10">
          <PlayModeCard
            art={hostIslandArt}
            buttonIcon={usersIcon}
            buttonLabel="Host"
            description="Invite your friends"
            disabled={isPending}
            onClick={() => void onCreateRoom()}
            pending={pendingAction === "create"}
            title="Host a Game"
          />
          <PlayModeCard
            art={quickMatchArt}
            buttonIcon={playIcon}
            buttonLabel="Play"
            description="Play against bots now"
            disabled={isPending}
            featured={!rejoinRoom}
            onClick={() => setDialogOpen(setShowBotSetup, true)}
            pending={pendingAction === "quick"}
            title="Quick Match"
          />
          <PlayModeCard
            art={joinCrewArt}
            buttonIcon={linkIcon}
            buttonLabel="Join"
            description="Got a code? Join in"
            disabled={isPending}
            onClick={() => setDialogOpen(setShowJoinRoom, true)}
            pending={pendingAction === "join"}
            title="Join a Game"
          />
        </div>

        <div className="home-foot relative z-10">
          <LiveMessage message={showJoinRoom || showBotSetup ? "" : error} />
        </div>
      </div>

      <Dialog
        open={showJoinRoom}
        onOpenChange={(open) => {
          if (!open && !isPending) setDialogOpen(setShowJoinRoom, false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a Game</DialogTitle>
            <DialogDescription>Type the code your host shared.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            id="join-room-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onJoinRoom(joinCode);
            }}
          >
            <Field className="gap-2">
              <FieldLabel className="justify-center" htmlFor="room-code">
                Game code
              </FieldLabel>
              <Input
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
                // The indent balances the letter spacing that trails the last character.
                className="h-14 indent-[0.3em] text-center text-3xl font-extrabold tracking-[0.3em] tabular-nums uppercase"
                id="room-code"
                maxLength={ROOM_CODE_LENGTH}
                onChange={(event) => {
                  onDismissError();
                  setJoinCode(normalizeRoomCode(event.target.value));
                }}
                placeholder="ABC123"
                spellCheck={false}
                value={joinCode}
              />
              <p className="text-center text-sm font-semibold text-ui-text-soft">
                {joinCode.length === 0
                  ? `${ROOM_CODE_LENGTH} letters or numbers`
                  : isRoomCode(joinCode)
                    ? "Looks good"
                    : `${ROOM_CODE_LENGTH - joinCode.length} more to go`}
              </p>
            </Field>
            <LiveMessage message={error} />
          </form>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setDialogOpen(setShowJoinRoom, false)}
              size="game-md"
              variant="game-secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending || !isRoomCode(joinCode)}
              form="join-room-form"
              size="game-md"
              type="submit"
              variant="game-gold"
            >
              {pendingAction === "join" ? (
                <>
                  <Spinner data-icon="inline-start" /> Joining…
                </>
              ) : (
                "Join"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickMatchDialog
        botDifficulty={botDifficulty}
        disabled={isPending}
        error={error}
        onBotDifficultyChange={setBotDifficulty}
        onOpenChange={(open) => setDialogOpen(setShowBotSetup, open)}
        onStart={() => void onQuickPlay(botDifficulty)}
        open={showBotSetup}
        pending={pendingAction === "quick"}
      />

      {showHelp ? (
        <GameHelpDialog onClose={() => setShowHelp(false)} settings={DEFAULT_BASE_GAME_SETTINGS} />
      ) : null}
    </main>
  );
}

function RejoinBar({
  disabled,
  onRemove,
  room,
}: {
  disabled: boolean;
  onRemove(code: string): Promise<void>;
  room: RejoinRoom;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const isLobby = room.status === "waiting";

  // The dialog closes as soon as the server agrees, without waiting for the bar to go away.
  const remove = async () => {
    setRemoving(true);
    setRemoveError("");
    try {
      await onRemove(room.code);
      setConfirming(false);
    } catch (cause) {
      setRemoveError(toActionableError(cause));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="game-menu-panel home-rejoin motion-safe:animate-game-rise">
      <Link className="home-rejoin-link" href={`/room/${encodeURIComponent(room.code)}`}>
        <span className="game-art-stage home-rejoin-thumb max-[22.5rem]:hidden">
          <Image
            alt=""
            className="size-9 object-contain"
            placeholder="blur"
            sizes="36px"
            src={hostIslandArt}
          />
          <span aria-hidden="true" className="home-rejoin-live" />
        </span>
        <span className="home-rejoin-text">
          <span className="game-title home-rejoin-title">
            {isLobby ? "Your crew is waiting" : "Your game is still on"}
          </span>
          <span className="home-rejoin-code">
            Code <span>{room.code}</span>
          </span>
        </span>
        <span
          className={cn(
            buttonVariants({ size: "game-md", variant: "game-gold" }),
            "home-rejoin-button",
          )}
        >
          Rejoin
        </span>
      </Link>
      {room.canRemove ? (
        <Tooltip label={isLobby ? "Remove lobby" : "Remove game"}>
          <Button
            aria-label={isLobby ? "Remove lobby" : "Remove game"}
            disabled={disabled || removing}
            onClick={() => {
              setRemoveError("");
              setConfirming(true);
            }}
            size="game-md"
            variant="game-icon"
          >
            {removing ? <Spinner className="size-5" /> : <Icon icon={trashIcon} />}
          </Button>
        </Tooltip>
      ) : null}

      {confirming ? (
        <ConfirmationDialog
          busy={removing}
          confirmLabel="Remove"
          description={
            isLobby
              ? "Anyone waiting in it is sent home, and the code stops working."
              : "Only bots are left playing, so the game ends for good."
          }
          error={removeError}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void remove()}
          title={isLobby ? "Remove this lobby?" : "Remove this game?"}
        />
      ) : null}
    </div>
  );
}

function PlayModeCard({
  art,
  buttonIcon,
  buttonLabel,
  description,
  disabled,
  featured = false,
  onClick,
  pending,
  title,
}: {
  art: StaticImageData;
  buttonIcon: IconifyIcon;
  buttonLabel: string;
  description: string;
  disabled: boolean;
  /** The screen's one gold action; only when no rejoin bar is showing its own. */
  featured?: boolean;
  onClick(): void;
  pending: boolean;
  title: string;
}) {
  return (
    <button
      className="game-menu-panel game-card-button home-mode-card"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="home-mode-art">
        <Image
          alt=""
          fill
          loading="eager"
          placeholder="blur"
          sizes="(min-width: 768px) 220px, 96px"
          src={art}
        />
      </span>
      <span className="home-mode-text">
        <span className="game-title home-mode-title">{title}</span>
        <span className="home-mode-description">{description}</span>
      </span>
      {/* A span, not a Button: the whole card is already the button. */}
      <span
        className={cn(
          buttonVariants({ size: "game-md", variant: featured ? "game-gold" : "game" }),
          "home-mode-button",
        )}
      >
        {pending ? (
          <>
            <Spinner className="size-5" />
            <span className="sr-only">Working…</span>
          </>
        ) : (
          <>
            <Icon aria-hidden="true" icon={buttonIcon} />
            {buttonLabel}
          </>
        )}
      </span>
    </button>
  );
}
