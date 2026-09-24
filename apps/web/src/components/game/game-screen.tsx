"use client";

import type {
  BotDifficulty,
  GameCommand,
  PlayableDevelopmentCardType,
  PlayerGameView,
} from "@settersaga/game";
import closeIcon from "@iconify-icons/solar/close-circle-bold";
import pauseIcon from "@iconify-icons/solar/pause-bold";
import { Icon } from "@iconify/react/offline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useOptionalAppSession } from "@/components/app/app-session-context";
import { PlayerSettingsDialog } from "@/components/app/player-settings-dialog";
import { GameAudio } from "@/components/audio/game-audio";
import type { RoomChat } from "@/components/room/chat-panel";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toActionableError } from "@/lib/app/action-errors";
import type { AudioSettings } from "@/lib/audio-settings";
import {
  resolveBoardTargetMode,
  type BoardBuildMode,
  type BoardTargetMode,
} from "@/lib/game/board-canvas-model";
import {
  GAME_PAUSED_REJECTION,
  getCommandErrorMessage,
  isShownBesideControl,
  toCommandRejection,
  type SendCommand,
} from "@/lib/game/command-errors";
import { getPhaseCopy, phaseTitleText } from "@/lib/game/dock-phase-copy";
import type { RoomEventView } from "@/lib/game/types";
import { getLongestRoadLengths, getViewerAndActivePlayer } from "@/lib/game/view";

import { CommandDock } from "./command-dock";
import { DevelopmentCardDialog, type DevelopmentCardChoice } from "./development-card-dialog";
import { DiscardPanel } from "./discard-panel";
import { GameBoard } from "./game-board";
import { GameHeader } from "./game-header";
import { GameHelpDialog } from "./game-help-dialog";
import { GameSidebar, type GameFeedTab } from "./game-sidebar";
import { HandDockProvider } from "./hand-dock";
import { PlayerStrip } from "./player-strip";
import { ResourceHand } from "./resource-hand";
import { ActiveTradeOffer } from "./trade-center";
import { useAttentionTitle, type AttentionRequest } from "./use-attention-title";
import { useMediaQuery } from "./use-media-query";
import { WinOverlay } from "./win-overlay";

type GameConfirmation =
  | { kind: "leave" }
  | { displayName: string; kind: "replace"; playerId: string };

const ERROR_TOAST_DURATION_MS = 6_000;
const PAUSED_NOTICE_DURATION_MS = 3_000;
/** Matches the rail breakpoint in styles/game-layout.css; below it the sidebar is a drawer. */
const RAIL_LAYOUT_QUERY = "(min-width: 80rem)";

export function GameScreen({
  audioSettings,
  botDifficulty,
  botThinking,
  chat,
  events,
  game,
  hostSeatIndex,
  isHost,
  isPaused,
  nextActionAt,
  offlineSeatIndexes,
  onCommand,
  onLeave,
  onPauseChange,
  onRematch,
  onReplacePlayer,
  pausedRemainingMs,
  viewerProfileImageUrl,
}: {
  audioSettings: AudioSettings;
  /** Every bot at the table plays at the room's difficulty, and wears its art. */
  botDifficulty: BotDifficulty;
  botThinking: boolean;
  chat: RoomChat;
  events: RoomEventView[];
  game: PlayerGameView;
  /** Seat of the room's host, or null while the role is changing hands. */
  hostSeatIndex: number | null;
  isHost: boolean;
  isPaused: boolean;
  nextActionAt?: number;
  /** Human seats whose presence heartbeat has gone stale; bots are never listed. */
  offlineSeatIndexes: ReadonlySet<number>;
  onCommand(command: GameCommand): Promise<void>;
  onLeave(): Promise<void>;
  onPauseChange(shouldPause: boolean): Promise<void>;
  onRematch(): Promise<void>;
  onReplacePlayer(playerId: string): Promise<void>;
  /** While paused: how long the next move will have once play resumes. */
  pausedRemainingMs?: number;
  viewerProfileImageUrl: string | null;
}) {
  const { activePlayer, me } = getViewerAndActivePlayer(game);
  // A chosen build mode belongs to the action it was picked in; any new action clears it.
  const [buildSelection, setBuildSelection] = useState<{
    actionNumber: number;
    mode: BoardBuildMode;
  } | null>(null);
  const buildMode = buildSelection?.actionNumber === game.actionNumber ? buildSelection.mode : null;
  const [pendingCommand, setPendingCommand] = useState<GameCommand["kind"] | null>(null);
  const [pendingReplacementId, setPendingReplacementId] = useState<string | null>(null);
  const [pauseChangePending, setPauseChangePending] = useState(false);
  const [confirmation, setConfirmation] = useState<GameConfirmation | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [developmentCardChoice, setDevelopmentCardChoice] = useState<DevelopmentCardChoice | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [resultsHidden, setResultsHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedTab, setFeedTab] = useState<GameFeedTab>("log");
  const [sheetRoot, setSheetRoot] = useState<HTMLDivElement | null>(null);
  const hasRail = useMediaQuery(RAIL_LAYOUT_QUERY);
  const session = useOptionalAppSession();
  const settingsAudio = session?.audioSettings ?? audioSettings;
  const settingsDisplayName = session?.displayName || me.displayName;
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [pausedNoticeVisible, setPausedNoticeVisible] = useState(false);
  const commandInFlightRef = useRef(false);
  const confirmationInFlightRef = useRef(false);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const pauseChangeInFlightRef = useRef(false);
  const pausedNoticeTimerRef = useRef<number | null>(null);
  const replacementInFlightRef = useRef(false);
  const longestRoadByPlayerId = useMemo(() => getLongestRoadLengths(game), [game]);
  const pending = pendingCommand !== null;
  const isGameOver = game.phase.kind === "finished";
  const showResults = isGameOver && !resultsHidden;
  const drawerIsModal = drawerOpen && !hasRail;
  const chatVisible = feedTab === "chat" && (hasRail || drawerOpen);
  // Server times only: chat counts as read up to the newest message shown while it was on screen.
  const latestChatAt = chat.messages.at(-1)?.sentAt ?? 0;
  const [chatSeenAt, setChatSeenAt] = useState(latestChatAt);
  if (chatVisible && chatSeenAt < latestChatAt) {
    setChatSeenAt(latestChatAt);
  }
  const unreadChatCount = chatVisible
    ? 0
    : chat.messages.filter((message) => !message.isMine && message.sentAt > chatSeenAt).length;

  const showPausedNotice = useCallback(() => {
    setError("");
    setPausedNoticeVisible(true);
    if (pausedNoticeTimerRef.current !== null) {
      window.clearTimeout(pausedNoticeTimerRef.current);
    }
    pausedNoticeTimerRef.current = window.setTimeout(() => {
      pausedNoticeTimerRef.current = null;
      setPausedNoticeVisible(false);
    }, PAUSED_NOTICE_DURATION_MS);
  }, []);

  const restorePlacementFocus = useCallback((mode: BoardTargetMode) => {
    const buildAction = document.querySelector<HTMLButtonElement>(
      `[data-game-footer] [data-action-kind="${mode}"]`,
    );

    if (buildAction && !buildAction.disabled && buildAction.checkVisibility()) {
      buildAction.focus();
      return;
    }

    phaseHeadingRef.current?.focus();
  }, []);

  useEffect(
    () => () => {
      if (pausedNoticeTimerRef.current !== null) {
        window.clearTimeout(pausedNoticeTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!error) {
      return;
    }
    const timeoutId = window.setTimeout(() => setError(""), ERROR_TOAST_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const closeDrawer = () => {
    // Commit first: the toggle sits in the part of the screen that is inert while the drawer is open.
    flushSync(() => setDrawerOpen(false));
    drawerToggleRef.current?.focus();
  };

  const sendCommand: SendCommand = async (command, successMessage) => {
    if (isPaused) {
      showPausedNotice();
      return GAME_PAUSED_REJECTION;
    }
    if (!acquireSingleFlight(commandInFlightRef)) {
      return { code: undefined, message: "" };
    }
    setPendingCommand(command.kind);
    setError("");
    setAnnouncement("");
    try {
      await onCommand(command);
      setAnnouncement(successMessage);
      setBuildSelection(null);
      return null;
    } catch (cause) {
      const rejection = toCommandRejection(cause);
      if (rejection.code === "GAME_PAUSED") {
        showPausedNotice();
      } else if (!isShownBesideControl(rejection)) {
        setError(rejection.message);
      }
      return rejection;
    } finally {
      commandInFlightRef.current = false;
      setPendingCommand(null);
    }
  };

  const playDevelopmentCard = (card: PlayableDevelopmentCardType) => {
    if (isPaused) {
      showPausedNotice();
      return;
    }
    switch (card) {
      case "knight":
        void sendCommand({ kind: "play_knight" }, "Knight played.");
        return;
      case "road-building":
        void sendCommand({ kind: "play_road_building" }, "Road Building played.");
        return;
      case "monopoly":
      case "year-of-plenty":
        setDevelopmentCardChoice(card);
        return;
    }
  };

  const replaceWithBot = async (playerId: string) => {
    if (!acquireSingleFlight(replacementInFlightRef)) {
      return;
    }
    setPendingReplacementId(playerId);
    setError("");
    try {
      await onReplacePlayer(playerId);
      setAnnouncement("A bot took over that seat.");
    } finally {
      replacementInFlightRef.current = false;
      setPendingReplacementId(null);
    }
  };

  const requestConfirmation = (nextConfirmation: GameConfirmation) => {
    setConfirmationError("");
    setConfirmation(nextConfirmation);
  };

  const requestBotReplacement = (playerId: string) => {
    const player = game.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }

    requestConfirmation({ displayName: player.displayName, kind: "replace", playerId });
  };

  const changePauseState = async (shouldPause: boolean) => {
    if (!acquireSingleFlight(pauseChangeInFlightRef)) {
      return;
    }
    setPauseChangePending(true);
    setError("");
    try {
      await onPauseChange(shouldPause);
      setAnnouncement(shouldPause ? "Game paused." : "Game resumed.");
    } catch (cause) {
      setError(getCommandErrorMessage(cause));
    } finally {
      pauseChangeInFlightRef.current = false;
      setPauseChangePending(false);
    }
  };

  const isViewerTurn = activePlayer.id === me.id;
  useAttentionTitle(getAttentionRequest(game, isViewerTurn));
  const phaseCopy = getPhaseCopy(game);
  const latestEvent = events.at(-1)?.text;
  const phaseLiveMessage = [
    phaseTitleText(phaseCopy.title),
    phaseCopy.detail,
    latestEvent ? `Latest move: ${latestEvent}` : null,
  ]
    .filter((part) => part !== null)
    .map((part) => (/[.!?…]$/.test(part) ? part : `${part}.`))
    .join(" ");
  const placementLabel = getPlacementLabel(game, resolveBoardTargetMode(game, buildMode));
  const changeBuildMode = (mode: BoardBuildMode) => {
    if (isPaused) {
      showPausedNotice();
      return;
    }
    setBuildSelection({ actionNumber: game.actionNumber, mode });
  };

  const runConfirmedAction = async () => {
    if (!confirmation || !acquireSingleFlight(confirmationInFlightRef)) {
      return;
    }
    setConfirming(true);
    setConfirmationError("");
    try {
      if (confirmation.kind === "leave") {
        await onLeave();
      } else {
        await replaceWithBot(confirmation.playerId);
      }
      setConfirmation(null);
    } catch (cause) {
      setConfirmationError(
        confirmation.kind === "leave"
          ? toActionableError(cause)
          : "That seat could not be handed to a bot. Try again.",
      );
    } finally {
      confirmationInFlightRef.current = false;
      setConfirming(false);
    }
  };

  return (
    <main className="game-shell" id="main-content">
      <GameAudio
        actionNumber={game.actionNumber}
        activePlayerId={game.activePlayerId}
        events={events}
        phaseKind={game.phase.kind}
        soundEffectsVolume={settingsAudio.soundEffectsVolume}
        tradeOffer={game.tradeOffer}
        viewerPlayerId={me.id}
        viewerResources={me.resources}
        winnerPlayerId={game.winnerPlayerId}
      />
      {/* The results overlay and the table drawer are modal; what they cover leaves the tab order. */}
      <div className="contents" inert={showResults}>
        <HandDockProvider sheetRoot={sheetRoot}>
          <div className="contents" inert={drawerIsModal}>
            <GameHeader
              drawerOpen={drawerOpen}
              drawerToggleRef={drawerToggleRef}
              game={game}
              isHelpOpen={isHelpOpen}
              isHost={isHost}
              isPaused={isPaused}
              onLeave={() => requestConfirmation({ kind: "leave" })}
              onOpenHelp={() => setIsHelpOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onPauseChange={(shouldPause) => void changePauseState(shouldPause)}
              onOpenDrawer={() => setDrawerOpen(true)}
              pauseChangePending={pauseChangePending}
              unreadChatCount={unreadChatCount}
            />

            <PlayerStrip
              activePlayerId={game.activePlayerId}
              botDifficulty={botDifficulty}
              offlineSeatIndexes={offlineSeatIndexes}
              players={game.players}
              turnOrder={game.turnOrder}
              victoryTarget={game.settings.victoryPoints}
              viewerProfileImageUrl={viewerProfileImageUrl}
              winnerPlayerId={game.winnerPlayerId}
            />

            <GameBoard
              buildMode={buildMode}
              game={game}
              longestRoadByPlayerId={longestRoadByPlayerId}
              onCancelBuildMode={() => setBuildSelection(null)}
              onCommand={sendCommand}
              onPlacementExit={restorePlacementFocus}
              pending={pending}
            />

            <div className="game-board-notices">
              {placementLabel ? (
                <div className="game-placement-banner motion-safe:animate-game-pop">
                  <p className="game-ribbon m-0">{placementLabel}</p>
                  {buildMode ? (
                    <Button
                      onClick={() => setBuildSelection(null)}
                      size="game-md"
                      variant="game-secondary"
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {pausedNoticeVisible && isPaused ? (
                <p className="game-toast" role="status">
                  <Icon aria-hidden="true" className="size-5 shrink-0" icon={pauseIcon} />
                  {isHost
                    ? "The game is paused. Resume it from the game menu."
                    : "The game is paused. The host can resume it."}
                </p>
              ) : null}
              {error ? (
                <div className="game-toast game-toast--error" role="alert">
                  <span>{error}</span>
                  <Button
                    aria-label="Dismiss"
                    className="shrink-0"
                    onClick={() => setError("")}
                    size="game-md"
                    variant="game-icon"
                  >
                    <Icon aria-hidden="true" icon={closeIcon} />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="game-sheet-root" ref={setSheetRoot} />

            <footer className="game-footer" data-game-footer>
              <ResourceHand
                actionNumber={game.actionNumber}
                isViewerTurn={isViewerTurn}
                me={me}
                onPlayDevelopmentCard={playDevelopmentCard}
                pending={pending}
                playableDevelopmentCards={game.legalActions.playableDevelopmentCards}
              />

              <CommandDock
                botThinking={botThinking}
                buildMode={buildMode}
                game={game}
                isPaused={isPaused}
                me={me}
                nextActionAt={nextActionAt}
                onBuildMode={changeBuildMode}
                onCommand={sendCommand}
                onPausedAction={showPausedNotice}
                onShowResults={resultsHidden ? () => setResultsHidden(false) : undefined}
                pausedRemainingMs={pausedRemainingMs}
                pending={pending}
                phaseCopy={phaseCopy}
                phaseHeadingRef={phaseHeadingRef}
              />
            </footer>
            {game.tradeOffer ? (
              <ActiveTradeOffer
                disabled={pending}
                game={game}
                isPaused={isPaused}
                me={me}
                onCommand={sendCommand}
                onPausedAction={showPausedNotice}
              />
            ) : null}
            {game.legalActions.discardCount === null ? null : (
              <DiscardPanel
                autoDiscardAt={botThinking ? undefined : nextActionAt}
                count={game.legalActions.discardCount}
                hasTurnTimer={game.settings.turnTimerSeconds > 0}
                isPaused={isPaused}
                me={me}
                onCommand={sendCommand}
                pausedRemainingMs={pausedRemainingMs}
                pending={pending}
              />
            )}
          </div>

          {drawerIsModal ? (
            <div aria-hidden="true" className="game-drawer-scrim" onClick={closeDrawer} />
          ) : null}
          <GameSidebar
            botDifficulty={botDifficulty}
            chat={chat}
            events={events}
            feedTab={feedTab}
            game={game}
            hostSeatIndex={hostSeatIndex}
            isHost={isHost}
            longestRoadByPlayerId={longestRoadByPlayerId}
            modal={drawerIsModal}
            offlineSeatIndexes={offlineSeatIndexes}
            onClose={closeDrawer}
            onFeedTabChange={setFeedTab}
            onReplacePlayer={requestBotReplacement}
            open={drawerOpen}
            pendingReplacementId={pendingReplacementId}
            unreadChatCount={unreadChatCount}
            viewerProfileImageUrl={viewerProfileImageUrl}
          />
        </HandDockProvider>
      </div>

      {developmentCardChoice ? (
        <DevelopmentCardDialog
          bank={game.bank}
          card={developmentCardChoice}
          onClose={() => setDevelopmentCardChoice(null)}
          onPlay={async (command, message) => {
            const rejection = await sendCommand(command, message);
            if (!rejection) {
              setDevelopmentCardChoice(null);
            }
            return rejection;
          }}
          pending={pending}
        />
      ) : null}

      {isHelpOpen ? (
        <GameHelpDialog onClose={() => setIsHelpOpen(false)} settings={game.settings} />
      ) : null}

      <PlayerSettingsDialog
        audioSettings={settingsAudio}
        displayName={settingsDisplayName}
        isPending={session?.pendingAction != null}
        onAudioSettingsChange={session?.onAudioSettingsChange}
        onDisplayNameChange={session?.onDisplayNameChange}
        onOpenChange={setIsSettingsOpen}
        open={isSettingsOpen}
      />

      {confirmation ? (
        <ConfirmationDialog
          busy={confirming || pendingReplacementId !== null}
          confirmLabel={confirmation.kind === "leave" ? "Leave game" : "Hand to a bot"}
          description={
            confirmation.kind === "leave"
              ? "A bot takes your seat, and you can't come back to it. If no crew is left, the Island closes."
              : `${confirmation.displayName} loses this seat right away, and a bot finishes the game for them.`
          }
          error={confirmationError}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void runConfirmedAction()}
          title={
            confirmation.kind === "leave"
              ? "Leave this game?"
              : `Replace ${confirmation.displayName}?`
          }
        />
      ) : null}

      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {phaseLiveMessage}
      </div>
      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {showResults ? (
        <WinOverlay
          botDifficulty={botDifficulty}
          game={game}
          hostSeatIndex={hostSeatIndex}
          longestRoadByPlayerId={longestRoadByPlayerId}
          offlineSeatIndexes={offlineSeatIndexes}
          onLeave={onLeave}
          onRematch={onRematch}
          onViewBoard={() => setResultsHidden(true)}
          viewerProfileImageUrl={viewerProfileImageUrl}
        />
      ) : null}
    </main>
  );
}

function acquireSingleFlight(lock: { current: boolean }): boolean {
  if (lock.current) {
    return false;
  }

  lock.current = true;
  return true;
}

/** The banner over the board while the viewer is choosing a spot. */
function getPlacementLabel(game: PlayerGameView, mode: BoardTargetMode | null): string | null {
  switch (mode) {
    case null:
      return null;
    case "city":
      return "Upgrade a settlement";
    case "robber":
      return "Move the robber";
    case "settlement":
      return game.phase.kind === "setup_settlement"
        ? "Place your settlement"
        : "Place a settlement";
    case "road":
      return game.phase.kind === "road_building"
        ? "Place a free road"
        : game.phase.kind === "setup_road"
          ? "Place your road"
          : "Place a road";
  }
}

/** What should flash in a background tab's title: an offer to answer, cards to drop, or a turn. */
function getAttentionRequest(game: PlayerGameView, isViewerTurn: boolean): AttentionRequest | null {
  const legal = game.legalActions;
  if (game.phase.kind === "finished") {
    return null;
  }
  if (legal.canRespondToTrade && game.tradeOffer) {
    return { key: `trade:${game.tradeOffer.offerActionNumber}`, title: "Trade offer" };
  }
  if (legal.discardCount !== null) {
    return { key: `discard:${game.turnNumber}`, title: "Discard cards" };
  }
  if (isViewerTurn) {
    return { key: `turn:${game.turnNumber}:${game.activePlayerId}`, title: "Your turn" };
  }
  return null;
}
