"use client";

import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  getLongestRoadLength,
  RESOURCE_ORDER,
  type GameCommand,
  type PlayableDevelopmentCardType,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
} from "@settersaga/game";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import crownIcon from "@iconify-icons/solar/crown-bold";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import helpIcon from "@iconify-icons/solar/help-bold";
import logoutIcon from "@iconify-icons/solar/logout-2-bold";
import settingsIcon from "@iconify-icons/solar/settings-minimalistic-bold";
import chatIcon from "@iconify-icons/solar/chat-round-line-bold";
import pauseIcon from "@iconify-icons/solar/pause-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import playerIcon from "@iconify-icons/solar/user-rounded-bold";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useOptionalAppSession } from "@/components/app/app-session-context";
import { PlayerSettingsDialog } from "@/components/app/player-settings-dialog";
import { GameAudio } from "@/components/audio/game-audio";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import { WAIT_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import type { BoardTargetMode } from "@/lib/game/board-canvas-model";
import { getTurnControlKind } from "@/lib/game/game-footer-model";
import type { RoomEventView } from "@/lib/game/types";
import { eventActionLabel, getEventTone, groupRoomEvents } from "@/lib/game/event-log-model";
import { getPhaseCopy, getPlayerHudOrder } from "@/lib/game/view";
import type { AudioSettings } from "@/lib/audio-settings";

import { ActionTile } from "./action-tile";
import { DieFace } from "./die-face";
import { DiscardPanel } from "./discard-panel";
import { DevelopmentCardDialog } from "./development-card-dialog";
import { GameBoard, getPlayerTheme, type BuildMode } from "./game-board";
import { BOARD_INSPECTOR_DOCK_ROOT_ID, HandDockProvider } from "./hand-dock";
import { RESOURCE_LABELS } from "./resource-icon";
import { ResourceHand } from "./resource-hand";
import { ActiveTradeOffer, TradeCenter } from "./trade-center";
import { GameHelpDialog } from "./game-help-dialog";
import { useActionCountdown } from "./use-action-countdown";
import { WinOverlay } from "./win-overlay";

type GameConfirmation =
  | { kind: "leave" }
  | { displayName: string; kind: "replace"; playerId: string };
type DevelopmentCardChoice = "monopoly" | "year-of-plenty";

const UTC_EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const LOCAL_EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function GameScreen({
  audioSettings,
  events,
  game,
  isHost,
  isPaused,
  botThinking,
  nextActionAt,
  onCommand,
  onLeave,
  onPauseChange,
  onReplacePlayer,
  viewerProfileImageUrl,
}: {
  audioSettings: AudioSettings;
  events: RoomEventView[];
  game: PlayerGameView;
  isHost: boolean;
  isPaused: boolean;
  botThinking: boolean;
  nextActionAt?: number;
  onCommand(command: GameCommand): Promise<void>;
  onLeave(): Promise<void>;
  onPauseChange(shouldPause: boolean): Promise<void>;
  onReplacePlayer(playerId: string): Promise<void>;
  viewerProfileImageUrl: string | null;
}) {
  const [buildMode, setBuildMode] = useState<BuildMode>(null);
  const [pendingCommand, setPendingCommand] = useState<GameCommand["kind"] | null>(null);
  const [pendingReplacementId, setPendingReplacementId] = useState<string | null>(null);
  const [pauseChangePending, setPauseChangePending] = useState(false);
  const [confirmation, setConfirmation] = useState<GameConfirmation | null>(null);
  const [developmentCardChoice, setDevelopmentCardChoice] = useState<DevelopmentCardChoice | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const session = useOptionalAppSession();
  const settingsAudio = session?.audioSettings ?? audioSettings;
  const settingsDisplayName =
    session?.displayName || game.players.find((player) => player.isViewer)?.displayName || "";
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [pausedNoticeVisible, setPausedNoticeVisible] = useState(false);
  const commandInFlightRef = useRef(false);
  const confirmationInFlightRef = useRef(false);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const pauseChangeInFlightRef = useRef(false);
  const pausedNoticeTimerRef = useRef<number | null>(null);
  const replacementInFlightRef = useRef(false);

  const hidePausedNotice = useCallback(() => {
    if (pausedNoticeTimerRef.current !== null) {
      window.clearTimeout(pausedNoticeTimerRef.current);
      pausedNoticeTimerRef.current = null;
    }
    setPausedNoticeVisible(false);
  }, []);

  const showPausedNotice = useCallback(() => {
    setError("");
    setPausedNoticeVisible(true);
    if (pausedNoticeTimerRef.current !== null) {
      window.clearTimeout(pausedNoticeTimerRef.current);
    }
    pausedNoticeTimerRef.current = window.setTimeout(() => {
      pausedNoticeTimerRef.current = null;
      setPausedNoticeVisible(false);
    }, 3_000);
  }, []);

  const restorePlacementFocus = useCallback((mode: BoardTargetMode) => {
    const buildAction = document.querySelector<HTMLButtonElement>(
      `[data-game-footer] [data-action-kind="${mode}"]`,
    );

    if (buildAction && !buildAction.disabled) {
      buildAction.focus();
      return;
    }

    phaseHeadingRef.current?.focus();
  }, []);

  const me = game.players.find((player): player is PrivatePlayerState => player.isViewer);
  const activePlayer = game.players.find((player) => player.id === game.activePlayerId);
  useEffect(() => {
    setBuildMode(null);
  }, [game.actionNumber, game.phase.kind]);

  useEffect(() => {
    if (!isPaused) {
      hidePausedNotice();
    }
  }, [hidePausedNotice, isPaused]);

  useEffect(
    () => () => {
      if (pausedNoticeTimerRef.current !== null) {
        window.clearTimeout(pausedNoticeTimerRef.current);
      }
    },
    [],
  );

  if (!me || !activePlayer) {
    return <UnavailablePlayerView onLeave={onLeave} />;
  }

  const sendCommand = async (command: GameCommand, successMessage: string) => {
    if (isPaused) {
      showPausedNotice();
      return;
    }
    if (!acquireSingleFlight(commandInFlightRef)) {
      return;
    }
    setPendingCommand(command.kind);
    setError("");
    setAnnouncement("");
    try {
      await onCommand(command);
      setAnnouncement(successMessage);
      setBuildMode(null);
    } catch (cause) {
      if (isGamePausedError(cause)) {
        showPausedNotice();
      } else {
        setError(toGameError(cause));
      }
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
      setAnnouncement("Player control transferred to a bot.");
    } catch {
      setError("That player could not be replaced. Refresh the room and try again.");
    } finally {
      replacementInFlightRef.current = false;
      setPendingReplacementId(null);
    }
  };

  const requestBotReplacement = (playerId: string) => {
    const player = game.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }

    setConfirmation({
      displayName: player.displayName,
      kind: "replace",
      playerId,
    });
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
      setError(toGameError(cause));
    } finally {
      pauseChangeInFlightRef.current = false;
      setPauseChangePending(false);
    }
  };

  const isViewerTurn = activePlayer.id === me.id;
  const phaseCopy = getPhaseCopy(game.phase, isViewerTurn, activePlayer.displayName);
  const latestEvent = events.at(-1)?.text;
  const phaseLiveMessage = `${phaseCopy.title}. ${phaseCopy.detail}${latestEvent ? ` Latest table event: ${latestEvent}.` : ""}`;
  const changeBuildMode = (mode: BuildMode) => {
    if (isPaused) {
      showPausedNotice();
      return;
    }
    setBuildMode(mode);
  };

  const runConfirmedAction = async () => {
    if (!confirmation || !acquireSingleFlight(confirmationInFlightRef)) {
      return;
    }
    setConfirming(true);
    try {
      if (confirmation.kind === "leave") {
        await onLeave();
      } else {
        await replaceWithBot(confirmation.playerId);
      }
      setConfirmation(null);
    } finally {
      confirmationInFlightRef.current = false;
      setConfirming(false);
    }
  };
  const gameHeaderActionClassName = "game-icon-button";

  return (
    <main data-game-shell className="game-shell" id="main-content">
      <GameAudio
        activePlayerId={game.activePlayerId}
        events={events}
        phaseKind={game.phase.kind}
        soundEffectsVolume={settingsAudio.soundEffectsVolume}
        viewerPlayerId={me.id}
        winnerPlayerId={game.winnerPlayerId}
      />
      <div className="game-topbar">
        <p className="sr-only">
          Turn {game.turnNumber}. First to {game.settings.victoryPoints} victory points.
        </p>
        <div>
          {isHost && game.status !== "completed" ? (
            <Button
              aria-label={isPaused ? "Resume game" : "Pause game"}
              aria-pressed={isPaused}
              className={`${gameHeaderActionClassName} game-pause-button`}
              disabled={pauseChangePending}
              data-icon-only
              onClick={() => void changePauseState(!isPaused)}
              size="icon"
              variant="ghost"
            >
              <Icon aria-hidden="true" icon={isPaused ? playIcon : pauseIcon} />
            </Button>
          ) : null}
          <Button
            aria-haspopup="dialog"
            aria-label="Open settings"
            className={`${gameHeaderActionClassName} game-settings-button`}
            data-icon-only
            onClick={() => setIsSettingsOpen(true)}
            size="icon"
            variant="ghost"
          >
            <Icon aria-hidden="true" icon={settingsIcon} />
          </Button>
          <Button
            aria-controls="game-help-dialog"
            aria-expanded={isHelpOpen}
            aria-haspopup="dialog"
            aria-label="Open game help"
            className={`${gameHeaderActionClassName} game-help-button`}
            data-icon-only
            onClick={() => setIsHelpOpen(true)}
            size="icon"
            variant="ghost"
          >
            <Icon aria-hidden="true" icon={helpIcon} />
          </Button>
          <Button
            aria-label="Leave game"
            className={`${gameHeaderActionClassName} player-menu-button`}
            data-icon-only
            onClick={() => setConfirmation({ kind: "leave" })}
            size="icon"
            variant="destructive"
          >
            <Icon aria-hidden="true" icon={logoutIcon} />
          </Button>
        </div>
      </div>

      <HandDockProvider>
        <aside aria-label="Table status" className="game-rail">
          <div className="game-rail__panels">
            <EventLog events={events} players={game.players} />
            <BankPanel bank={game.bank} developmentCardSupply={game.developmentCardSupply} />
          </div>

          <PlayerStrip
            activePlayerId={game.activePlayerId}
            board={game.board}
            isHost={isHost}
            largestArmyPlayerId={game.largestArmyPlayerId}
            lastDiceRoll={game.lastDiceRoll}
            longestRoadPlayerId={game.longestRoadPlayerId}
            onReplacePlayer={requestBotReplacement}
            pendingReplacementId={pendingReplacementId}
            players={game.players}
            viewerProfileImageUrl={viewerProfileImageUrl}
            victoryTarget={game.settings.victoryPoints}
          />
        </aside>

        <div className="board-inspector-dock" id={BOARD_INSPECTOR_DOCK_ROOT_ID} />

        <GameBoard
          buildMode={buildMode}
          game={game}
          onCancelBuildMode={() => setBuildMode(null)}
          onCommand={(command, message) => void sendCommand(command, message)}
          onPlacementExit={restorePlacementFocus}
          pending={pendingCommand !== null}
        />

        <footer className="game-footer">
          <ResourceHand
            actionNumber={game.actionNumber}
            me={me}
            notice={
              pausedNoticeVisible ? (
                <div
                  aria-atomic="true"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm"
                  role="status"
                >
                  <Icon aria-hidden="true" icon={pauseIcon} />
                  <span>
                    {isHost
                      ? "The game is paused. Use the play button in the header to resume."
                      : "The game is paused. The host can resume it from the header."}
                  </span>
                </div>
              ) : null
            }
            onPlayDevelopmentCard={playDevelopmentCard}
            pending={pendingCommand !== null}
            playableDevelopmentCards={game.legalActions.playableDevelopmentCards}
          />

          <div className="game-footer__actions">
            <section aria-labelledby="phase-title" className="phase-card">
              <span aria-hidden="true" className="phase-card__icon">
                <Icon icon={playerIcon} />
              </span>
              <div className="flex-1">
                <h1 id="phase-title" ref={phaseHeadingRef} tabIndex={-1}>
                  {phaseCopy.title}
                </h1>
                <span className="sr-only">{phaseCopy.detail}</span>
              </div>
              {isViewerTurn && game.lastDiceRoll ? (
                <CompactDiceResult
                  className="turn-summary-dice"
                  roll={game.lastDiceRoll}
                  showTotal
                />
              ) : null}
            </section>
            {game.legalActions.discardCount === null ? (
              <TurnClock
                botThinking={botThinking}
                isPaused={isPaused}
                nextActionAt={nextActionAt}
              />
            ) : null}
            <ActionDock
              buildMode={buildMode}
              game={game}
              isPaused={isPaused}
              me={me}
              onBuildMode={changeBuildMode}
              onCommand={(command, message) => void sendCommand(command, message)}
              onPausedAction={showPausedNotice}
              pending={pendingCommand !== null}
            />
            <TurnControl
              game={game}
              onCommand={(command, message) => void sendCommand(command, message)}
              pending={pendingCommand !== null}
            />
          </div>
        </footer>
        {game.tradeOffer ? (
          <ActiveTradeOffer
            disabled={pendingCommand !== null}
            game={game}
            isPaused={isPaused}
            me={me}
            onCommand={(command, message) => void sendCommand(command, message)}
            onPausedAction={showPausedNotice}
          />
        ) : null}
        {game.legalActions.discardCount === null ? null : (
          <DiscardPanel
            count={game.legalActions.discardCount}
            isPaused={isPaused}
            me={me}
            nextActionAt={nextActionAt}
            onCommand={(command, message) => void sendCommand(command, message)}
            pending={pendingCommand !== null}
          />
        )}
        {developmentCardChoice ? (
          <DevelopmentCardDialog
            bank={game.bank}
            card={developmentCardChoice}
            onClose={() => setDevelopmentCardChoice(null)}
            onPlay={(command, message) => {
              setDevelopmentCardChoice(null);
              void sendCommand(command, message);
            }}
            pending={pendingCommand !== null}
          />
        ) : null}
      </HandDockProvider>

      {isHelpOpen ? <GameHelpDialog onClose={() => setIsHelpOpen(false)} /> : null}

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
          confirmLabel={confirmation.kind === "leave" ? "Leave Game" : "Use Bot"}
          description={
            confirmation.kind === "leave"
              ? "You cannot reclaim this seat after leaving. A bot will take over, or the game will close if no human players remain."
              : `${confirmation.displayName} will immediately lose control of this seat, and a bot will finish the game for them.`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void runConfirmedAction()}
          title={confirmation.kind === "leave" ? "Leave this game?" : "Replace this player?"}
        />
      ) : null}

      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {phaseLiveMessage}
      </div>
      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {error ? (
        <div
          aria-atomic="true"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {game.status === "completed" ? (
        <WinOverlay game={game} onLeave={onLeave} viewerProfileImageUrl={viewerProfileImageUrl} />
      ) : null}
    </main>
  );
}

function PlayerStrip({
  activePlayerId,
  board,
  isHost,
  largestArmyPlayerId,
  lastDiceRoll,
  longestRoadPlayerId,
  onReplacePlayer,
  pendingReplacementId,
  players,
  viewerProfileImageUrl,
  victoryTarget,
}: {
  activePlayerId: string;
  board: PlayerGameView["board"];
  isHost: boolean;
  largestArmyPlayerId: string | null;
  lastDiceRoll: PlayerGameView["lastDiceRoll"];
  longestRoadPlayerId: string | null;
  onReplacePlayer(playerId: string): void;
  pendingReplacementId: string | null;
  players: PlayerGameView["players"];
  viewerProfileImageUrl: string | null;
  victoryTarget: number;
}) {
  const stripRef = useRef<HTMLOListElement>(null);
  const orderedPlayers = useMemo(() => getPlayerHudOrder(players), [players]);
  const tableStats = useMemo(() => {
    return new Map(players.map((player) => [player.id, getLongestRoadLength(board, player.id)]));
  }, [board, players]);
  const hasSideDice = Boolean(
    lastDiceRoll && players.some((player) => player.id === activePlayerId && !player.isViewer),
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const activePlayer = [
        ...(stripRef.current?.querySelectorAll<HTMLElement>("[data-player-id]") ?? []),
      ].find((element) => element.dataset.playerId === activePlayerId);
      const stripBounds = stripRef.current?.getBoundingClientRect();
      const playerBounds = activePlayer?.getBoundingClientRect();
      const isVisible =
        stripBounds &&
        playerBounds &&
        playerBounds.left >= stripBounds.left &&
        playerBounds.right <= stripBounds.right &&
        playerBounds.top >= stripBounds.top &&
        playerBounds.bottom <= stripBounds.bottom;
      if (isVisible) {
        return;
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      activePlayer?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [activePlayerId]);

  return (
    <ol
      className={`player-strip${hasSideDice ? " has-active-dice" : ""}`}
      aria-label="Players"
      ref={stripRef}
    >
      {orderedPlayers.map((player) => {
        const theme = getPlayerTheme(player);
        const longestRoad = tableStats.get(player.id) ?? 0;
        const developmentCardCount = player.isViewer
          ? player.developmentCards.length
          : player.developmentCardCount;
        const hiddenVictoryPointCount = player.isViewer
          ? player.developmentCards.filter((card) => card === "victory-point").length
          : 0;
        const displayedVictoryPoints = player.victoryPoints + hiddenVictoryPointCount;
        const isActive = player.id === activePlayerId;
        const knightCount = player.playedDevelopmentCards.filter(
          (card) => card === "knight",
        ).length;
        const holdsLongestRoad = player.id === longestRoadPlayerId;
        const holdsLargestArmy = player.id === largestArmyPlayerId;
        const victoryPercent = Math.min(
          100,
          Math.round((displayedVictoryPoints / Math.max(victoryTarget, 1)) * 100),
        );
        const avatarSrc =
          player.isViewer && viewerProfileImageUrl
            ? viewerProfileImageUrl
            : getPlayerPortraitPath(theme);
        return (
          <li
            aria-current={isActive ? "true" : undefined}
            className={`player-summary player-${theme}${isActive ? " is-active" : ""}${player.isViewer ? " is-viewer" : ""}${isActive && !player.isViewer && lastDiceRoll ? " has-side-dice" : ""}`}
            data-player-id={player.id}
            key={player.id}
          >
            {isActive && !player.isViewer && lastDiceRoll ? (
              <CompactDiceResult className="player-side-dice" roll={lastDiceRoll} />
            ) : null}
            <span
              className={player.isBot ? "player-avatar is-bot" : "player-avatar is-human"}
              aria-hidden="true"
            >
              <span className="player-avatar-fallback">
                {player.isBot ? (
                  <Icon aria-hidden="true" icon={botIcon} />
                ) : (
                  getPlayerInitials(player.displayName)
                )}
              </span>
              <Image
                alt=""
                className="player-avatar-image"
                draggable={false}
                height={256}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
                src={avatarSrc}
                unoptimized
                width={256}
              />
            </span>
            <div className="player-body">
              <div className="player-identity-line">
                <strong title={player.displayName}>
                  {player.displayName}
                  {player.isViewer ? <span className="sr-only"> (you)</span> : null}
                </strong>
                {player.isViewer ? (
                  <span className="player-chip is-you" aria-hidden="true">
                    You
                  </span>
                ) : null}
                {player.isBot && !/\bbot\b/i.test(player.displayName) ? (
                  <span className="player-chip is-bot" aria-hidden="true">
                    Bot
                  </span>
                ) : null}
                {isActive ? <span className="player-chip is-turn">Turn</span> : null}
                <span
                  aria-label={
                    hiddenVictoryPointCount > 0
                      ? `${displayedVictoryPoints} of ${victoryTarget} victory points, including ${hiddenVictoryPointCount} from hidden victory point cards`
                      : `${displayedVictoryPoints} of ${victoryTarget} victory points`
                  }
                  className="player-stat player-victory-stat"
                >
                  <Icon aria-hidden="true" icon={crownIcon} />
                  <span className="player-victory-score" aria-hidden="true">
                    <strong>{displayedVictoryPoints}</strong>
                    <small>/{victoryTarget}</small>
                  </span>
                </span>
              </div>
              <div aria-label="Cards and awards" className="player-table-supply" role="group">
                <span
                  aria-label={`${player.resourceCount} resource cards`}
                  className="player-table-fact player-card-fact player-resource-card-fact"
                  title={`${player.resourceCount} resource cards`}
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    height={768}
                    sizes="2.25rem"
                    src={UNKNOWN_RESOURCE_CARD_ASSET_PATH}
                    width={512}
                  />
                  <strong>{player.resourceCount}</strong>
                  <small aria-hidden="true">Cards</small>
                </span>
                <span
                  aria-label={`${developmentCardCount} development cards`}
                  className="player-table-fact player-card-fact"
                  title={`${developmentCardCount} development cards`}
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    height={768}
                    sizes="2.25rem"
                    src={DEVELOPMENT_CARD_BACK_ASSET_PATH}
                    width={512}
                  />
                  <strong>{developmentCardCount}</strong>
                  <small aria-hidden="true">Dev</small>
                </span>
                <span
                  aria-label={
                    holdsLongestRoad
                      ? `Longest Road held, length ${longestRoad}`
                      : `Longest road length ${longestRoad}`
                  }
                  className={`player-table-fact player-award-fact${holdsLongestRoad ? " is-held" : ""}`}
                  data-empty={longestRoad === 0 ? "true" : undefined}
                  title={holdsLongestRoad ? "Longest Road" : `Road length ${longestRoad}`}
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    height={512}
                    sizes="2.5rem"
                    src={AWARD_ASSET_PATHS.longestRoad}
                    width={512}
                  />
                  <strong>{longestRoad}</strong>
                  <small aria-hidden="true">Road</small>
                </span>
                <span
                  aria-label={
                    holdsLargestArmy
                      ? `Largest Army held, ${knightCount} knights played`
                      : `${knightCount} knights played toward Largest Army`
                  }
                  className={`player-table-fact player-award-fact${holdsLargestArmy ? " is-held" : ""}`}
                  data-empty={knightCount === 0 ? "true" : undefined}
                  title={holdsLargestArmy ? "Largest Army" : `${knightCount} knights`}
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    height={512}
                    sizes="2.5rem"
                    src={AWARD_ASSET_PATHS.largestArmy}
                    width={512}
                  />
                  <strong>{knightCount}</strong>
                  <small aria-hidden="true">Army</small>
                </span>
              </div>
              <span
                aria-hidden="true"
                className="player-victory-bar"
                style={{ "--player-vp": `${victoryPercent}%` } as CSSProperties}
              >
                <i />
              </span>
            </div>
            {isHost && !player.isViewer && !player.isBot ? (
              <Button
                aria-label={`Replace ${player.displayName} with a bot`}
                className="player-replace"
                disabled={pendingReplacementId !== null}
                onClick={() => onReplacePlayer(player.id)}
                variant="secondary"
              >
                <Icon aria-hidden="true" icon={botIcon} />
                <span>{pendingReplacementId === player.id ? "Replacing…" : "Use Bot"}</span>
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function CompactDiceResult({
  className,
  roll,
  showTotal = false,
}: {
  className: string;
  roll: NonNullable<PlayerGameView["lastDiceRoll"]>;
  showTotal?: boolean;
}) {
  return (
    <div
      className={className}
      aria-label={`${roll.first} and ${roll.second}, total ${roll.sum}`}
      role="group"
    >
      <span aria-hidden="true" className="die-pair">
        <DieFace tone="ivory" value={roll.first} />
        <DieFace tone="ember" value={roll.second} />
      </span>
      {showTotal ? (
        <strong aria-hidden="true" className="compact-dice-total">
          {roll.sum}
        </strong>
      ) : null}
    </div>
  );
}

function BankPanel({
  bank,
  developmentCardSupply,
}: {
  bank: ResourceInventory | null;
  developmentCardSupply: number;
}) {
  return (
    <section aria-label="Resource market" className="side-card bank-card">
      <ul className="bank-grid">
        {RESOURCE_ORDER.map((resource) => (
          <li
            aria-label={`${RESOURCE_LABELS[resource]}: ${bank ? bank[resource] : "unknown"}`}
            className="resource-card-face"
            key={resource}
          >
            <span aria-hidden="true" className="resource-card-art">
              <Image
                alt=""
                className="resource-card-image"
                draggable={false}
                height={768}
                sizes="3.5rem"
                src={RESOURCE_CARD_ASSET_PATHS[resource]}
                width={512}
              />
            </span>
            <strong aria-hidden="true" className="resource-card-count">
              {bank ? bank[resource] : "?"}
            </strong>
          </li>
        ))}
        <li
          aria-label={`Development cards: ${developmentCardSupply}`}
          className="resource-card-face"
        >
          <span aria-hidden="true" className="resource-card-art">
            <Image
              alt=""
              className="resource-card-image"
              draggable={false}
              height={768}
              sizes="3.5rem"
              src={DEVELOPMENT_CARD_BACK_ASSET_PATH}
              width={512}
            />
          </span>
          <strong aria-hidden="true" className="resource-card-count">
            {developmentCardSupply}
          </strong>
        </li>
      </ul>
    </section>
  );
}

function EventLog({
  events,
  players,
}: {
  events: RoomEventView[];
  players: PlayerGameView["players"];
}) {
  const [showLocalTime, setShowLocalTime] = useState(false);
  const [pinnedToLatest, setPinnedToLatest] = useState(true);
  const [hasUnseen, setHasUnseen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const lastSequence = events.at(-1)?.sequence ?? 0;
  const groups = useMemo(() => groupRoomEvents(events), [events]);
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  useEffect(() => {
    setShowLocalTime(true);
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) {
        return;
      }
      if (pinnedToLatest) {
        list.scrollTop = list.scrollHeight;
        setHasUnseen(false);
        return;
      }
      setHasUnseen(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [lastSequence, pinnedToLatest]);

  const timeFormatter = showLocalTime ? LOCAL_EVENT_TIME_FORMATTER : UTC_EVENT_TIME_FORMATTER;

  return (
    <section className="side-card event-card" aria-labelledby="events-title">
      <div className="side-card-title">
        <h2 id="events-title">Game Log</h2>
        <Icon aria-hidden="true" icon={chatIcon} />
      </div>
      <ol
        className="event-list"
        onScroll={(event) => {
          const list = event.currentTarget;
          const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
          setPinnedToLatest(atBottom);
          if (atBottom) {
            setHasUnseen(false);
          }
        }}
        ref={listRef}
      >
        {groups.length > 0 ? (
          groups.map((group, groupIndex) => {
            const actor = playersById.get(group.actorPlayerId);
            const theme = actor ? getPlayerTheme(actor) : undefined;
            const actorName = actor?.displayName ?? "Table";
            const latest = group.events.at(-1);
            const isLatestGroup = groupIndex === groups.length - 1;
            return (
              <li
                className={`event-group${theme ? ` player-${theme}` : ""}${actor?.isViewer ? " is-viewer" : ""}${isLatestGroup ? " is-latest" : ""}`}
                key={group.key}
              >
                <span aria-hidden="true" className="event-group-dot" />
                <div className="event-group-body">
                  <div className="event-group-head">
                    <strong>{actorName}</strong>
                    {latest ? (
                      <time dateTime={new Date(latest.createdAt).toISOString()}>
                        {timeFormatter.format(latest.createdAt)}
                      </time>
                    ) : null}
                  </div>
                  <ol className="event-actions">
                    {group.events.map((item) => (
                      <li data-tone={getEventTone(item.kind)} key={item.sequence}>
                        <p>{eventActionLabel(item.text, actor?.displayName)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </li>
            );
          })
        ) : (
          <li className="event-empty">
            <p>No moves yet.</p>
          </li>
        )}
      </ol>
      {hasUnseen ? (
        <Button
          className="event-jump"
          onClick={() => setPinnedToLatest(true)}
          size="sm"
          variant="secondary"
        >
          Latest
        </Button>
      ) : null}
    </section>
  );
}

function ActionDock({
  buildMode,
  game,
  isPaused,
  me,
  onBuildMode,
  onCommand,
  onPausedAction,
  pending,
}: {
  buildMode: BuildMode;
  game: PlayerGameView;
  isPaused: boolean;
  me: PrivatePlayerState;
  onBuildMode(mode: BuildMode): void;
  onCommand(command: GameCommand, message: string): void;
  onPausedAction(): void;
  pending: boolean;
}) {
  const legal = game.legalActions;
  if (!legal.isRequiredActor) {
    return (
      <BuildingActionsDock
        buildMode={buildMode}
        disabledReasonOverride="Wait for your turn"
        game={game}
        isPaused={isPaused}
        me={me}
        onBuildMode={onBuildMode}
        onCommand={onCommand}
        onPausedAction={onPausedAction}
        pending={pending}
      />
    );
  }

  if (legal.discardCount !== null) {
    return (
      <BuildingActionsDock
        buildMode={buildMode}
        disabledReasonOverride={`Return ${legal.discardCount} resource ${
          legal.discardCount === 1 ? "card" : "cards"
        } from your hand`}
        game={game}
        isPaused={isPaused}
        me={me}
        onBuildMode={onBuildMode}
        onCommand={onCommand}
        onPausedAction={onPausedAction}
        pending={pending}
      />
    );
  }

  if (game.phase.kind === "steal") {
    return (
      <section className="action-dock" aria-label="Choose a player to steal from">
        <div className="action-heading">
          <strong>Choose a Neighbor</strong>
          <span>The stolen resource is selected at random.</span>
        </div>
        <div className="action-group">
          {legal.victimPlayerIds.map((playerId) => {
            const player = game.players.find((candidate) => candidate.id === playerId);
            return (
              <Button
                className="action-button"
                disabled={pending}
                key={playerId}
                onClick={() =>
                  onCommand({ kind: "steal", victimPlayerId: playerId }, "Resource stolen.")
                }
                variant="secondary"
              >
                <Icon aria-hidden="true" icon={playerIcon} /> {player?.displayName ?? "Neighbor"}
              </Button>
            );
          })}
        </div>
      </section>
    );
  }

  if (game.phase.kind === "move_robber") {
    return (
      <BuildingActionsDock
        buildMode={buildMode}
        disabledReasonOverride="Move the robber on the board"
        game={game}
        isPaused={isPaused}
        me={me}
        onBuildMode={onBuildMode}
        onCommand={onCommand}
        onPausedAction={onPausedAction}
        pending={pending}
      />
    );
  }

  if (legal.canRoll) {
    return (
      <BuildingActionsDock
        buildMode={buildMode}
        disabledReasonOverride="Roll the dice first"
        game={game}
        isPaused={isPaused}
        me={me}
        onBuildMode={onBuildMode}
        onCommand={onCommand}
        onPausedAction={onPausedAction}
        pending={pending}
      />
    );
  }

  if (game.phase.kind !== "build_and_trade") {
    return (
      <BuildingActionsDock
        buildMode={buildMode}
        disabledReasonOverride="Choose a highlighted board target"
        game={game}
        isPaused={isPaused}
        me={me}
        onBuildMode={onBuildMode}
        onCommand={onCommand}
        onPausedAction={onPausedAction}
        pending={pending}
      />
    );
  }

  return (
    <BuildingActionsDock
      buildMode={buildMode}
      game={game}
      isPaused={isPaused}
      me={me}
      onBuildMode={onBuildMode}
      onCommand={onCommand}
      onPausedAction={onPausedAction}
      pending={pending}
    />
  );
}

function BuildingActionsDock({
  buildMode,
  disabledReasonOverride,
  game,
  isPaused,
  me,
  onBuildMode,
  onCommand,
  onPausedAction,
  pending,
}: {
  buildMode: BuildMode;
  disabledReasonOverride?: string;
  game: PlayerGameView;
  isPaused: boolean;
  me: PrivatePlayerState;
  onBuildMode(mode: BuildMode): void;
  onCommand(command: GameCommand, message: string): void;
  onPausedAction(): void;
  pending: boolean;
}) {
  const legal = game.legalActions;
  const roadDisabledReason =
    disabledReasonOverride ??
    getBuildDisabledReason({
      cost: BUILD_COSTS.road,
      legalTargetCount: legal.roadEdgeKeys.length,
      pending,
      pieceLabel: "road",
      piecePlural: "roads",
      piecesRemaining: me.piecesRemaining.roads,
      resources: me.resources,
    });
  const settlementDisabledReason =
    disabledReasonOverride ??
    getBuildDisabledReason({
      cost: BUILD_COSTS.settlement,
      legalTargetCount: legal.settlementVertexKeys.length,
      pending,
      pieceLabel: "settlement",
      piecePlural: "settlements",
      piecesRemaining: me.piecesRemaining.settlements,
      resources: me.resources,
    });
  const cityDisabledReason =
    disabledReasonOverride ??
    getBuildDisabledReason({
      cost: BUILD_COSTS.city,
      legalTargetCount: legal.cityVertexKeys.length,
      pending,
      pieceLabel: "city",
      piecePlural: "cities",
      piecesRemaining: me.piecesRemaining.cities,
      resources: me.resources,
    });
  const developmentCardDisabledReason =
    disabledReasonOverride ??
    getDevelopmentCardDisabledReason({
      canBuy: legal.canBuyDevelopmentCard,
      pending,
      resources: me.resources,
      supply: game.developmentCardSupply,
    });
  return (
    <section aria-labelledby="building-actions-title" className="action-dock">
      <div className="action-heading sr-only">
        <strong id="building-actions-title">Build & Trade</strong>
        <span>
          {disabledReasonOverride ??
            "Buy a card, trade, or select a piece and choose a glowing target."}
        </span>
      </div>
      <TradeCenter
        disabled={pending || disabledReasonOverride !== undefined}
        game={game}
        isPaused={isPaused}
        me={me}
        onCommand={onCommand}
        onPausedAction={onPausedAction}
      />
      <div className="action-group build-actions">
        <DevelopmentCardAction
          disabledReason={developmentCardDisabledReason}
          onClick={() => onCommand({ kind: "buy_development_card" }, "Development card purchased.")}
          supply={game.developmentCardSupply}
        />
        <BuildAction
          active={buildMode === "road"}
          asset="road"
          count={me.piecesRemaining.roads}
          cost={BUILD_COSTS.road}
          disabledReason={roadDisabledReason}
          label="Road"
          onClick={() => onBuildMode(buildMode === "road" ? null : "road")}
        />
        <BuildAction
          active={buildMode === "settlement"}
          asset="settlement"
          count={me.piecesRemaining.settlements}
          cost={BUILD_COSTS.settlement}
          disabledReason={settlementDisabledReason}
          label="Settlement"
          onClick={() => onBuildMode(buildMode === "settlement" ? null : "settlement")}
        />
        <BuildAction
          active={buildMode === "city"}
          asset="city"
          count={me.piecesRemaining.cities}
          cost={BUILD_COSTS.city}
          disabledReason={cityDisabledReason}
          label="City"
          onClick={() => onBuildMode(buildMode === "city" ? null : "city")}
        />
      </div>
    </section>
  );
}

function TurnControl({
  game,
  onCommand,
  pending,
}: {
  game: PlayerGameView;
  onCommand(command: GameCommand, message: string): void;
  pending: boolean;
}) {
  const legal = game.legalActions;
  const controlKind = getTurnControlKind({
    canRoll: legal.canRoll,
    isRequiredActor: legal.isRequiredActor,
    phaseKind: game.phase.kind,
  });
  const turnControlClassName = "turn-control";

  if (controlKind === "roll") {
    return (
      <section className={turnControlClassName} aria-label="Turn control">
        <div aria-label="Dice ready to roll" className="roll-preview-card" role="img">
          <DieFace tone="ivory" value={1} />
          <DieFace tone="ember" value={5} />
        </div>
        <Button disabled={pending} onClick={() => onCommand({ kind: "roll" }, "Dice rolled.")}>
          <span className="inline-flex items-center gap-2">
            {pending ? (
              <>
                <Spinner data-icon="inline-start" /> Rolling…
              </>
            ) : (
              "Roll Dice"
            )}
          </span>
        </Button>
      </section>
    );
  }

  if (controlKind === "end_turn") {
    return (
      <section className={`${turnControlClassName} is-end-turn`} aria-label="Turn control">
        <Button
          aria-label="End Turn"
          disabled={pending || !legal.canEndTurn}
          onClick={() => onCommand({ kind: "end_turn" }, "Turn ended.")}
        >
          <span className="inline-flex items-center gap-2">
            {pending ? (
              <>
                <Spinner data-icon="inline-start" /> Ending…
              </>
            ) : (
              "End Turn"
            )}
          </span>
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="Turn control" className={`${turnControlClassName} is-unavailable`}>
      {controlKind === "waiting" ? (
        <>
          <Image
            alt=""
            className="turn-control-state-icon"
            draggable={false}
            height={256}
            src={WAIT_ICON_ASSET_PATH}
            width={256}
          />
          <span>Waiting</span>
        </>
      ) : (
        <span className="turn-control-required-copy">
          <span>Finish</span>
          <span>action</span>
        </span>
      )}
    </section>
  );
}

function UnavailablePlayerView({ onLeave }: { onLeave(): Promise<void> }) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveInFlightRef = useRef(false);

  const leave = async () => {
    if (!acquireSingleFlight(leaveInFlightRef)) {
      return;
    }
    setLeaving(true);
    try {
      await onLeave();
      setShowConfirmation(false);
    } finally {
      leaveInFlightRef.current = false;
      setLeaving(false);
    }
  };

  return (
    <>
      <main
        className="flex min-h-dvh items-center justify-center bg-background p-6"
        id="main-content"
      >
        <section className="notice-card">
          <h1>Player View Unavailable</h1>
          <p>Your private seat could not be matched to this game. Refresh to reconnect.</p>
          <Button onClick={() => setShowConfirmation(true)} variant="secondary">
            Leave Game
          </Button>
        </section>
      </main>
      {showConfirmation ? (
        <ConfirmationDialog
          busy={leaving}
          confirmLabel="Leave Game"
          description="You cannot reclaim this seat after leaving. A bot will take over, or the game will close if no human players remain."
          onCancel={() => setShowConfirmation(false)}
          onConfirm={() => void leave()}
          title="Leave this game?"
        />
      ) : null}
    </>
  );
}

function DevelopmentCardAction({
  disabledReason,
  onClick,
  onPress,
  supply,
}: {
  disabledReason: string | null;
  onClick?(): void;
  onPress?(): void;
  supply: number;
}) {
  const handlePress = onClick ?? onPress ?? (() => {});
  const descriptionId = "buy-development-card-description";
  const costResources = getCostResources(DEVELOPMENT_CARD_COST);

  return (
    <>
      <ActionTile
        ariaDescribedBy={descriptionId}
        ariaLabel={disabledReason ? "Buy development card unavailable" : "Buy development card"}
        art={
          <Image
            alt=""
            className="action-art"
            draggable={false}
            height={512}
            loading="eager"
            sizes="4rem"
            src={DEVELOPMENT_CARD_BACK_ASSET_PATH}
            width={512}
          />
        }
        count={supply}
        kind="development-card"
        onClick={handlePress}
        title="Dev Card"
        unavailable={disabledReason !== null}
      />
      <span className="sr-only" id={descriptionId}>
        {supply} development {supply === 1 ? "card" : "cards"} remaining. Cost:{" "}
        {costResources
          .map((resource) => `${DEVELOPMENT_CARD_COST[resource]} ${RESOURCE_LABELS[resource]}`)
          .join(", ")}
        .{disabledReason ? ` ${disabledReason}.` : ""}
      </span>
    </>
  );
}

function BuildAction({
  active,
  asset,
  count,
  cost,
  disabledReason,
  label,
  onClick,
  onPress,
}: {
  active: boolean;
  asset: "city" | "road" | "settlement";
  count: number;
  cost: Readonly<ResourceInventory>;
  disabledReason: string | null;
  label: string;
  onClick?(): void;
  onPress?(): void;
}) {
  const handlePress = onClick ?? onPress ?? (() => {});
  const descriptionId = `build-${asset}-description`;
  const costResources = getCostResources(cost);

  return (
    <>
      <ActionTile
        ariaDescribedBy={descriptionId}
        ariaLabel={
          disabledReason
            ? `Build ${label} unavailable`
            : active
              ? `Cancel ${label.toLowerCase()} placement`
              : `Build ${label}`
        }
        art={
          <Image
            alt=""
            className="action-art action-card-art"
            draggable={false}
            height={768}
            loading="eager"
            sizes="4rem"
            src={ACTION_CARD_ASSET_PATHS[asset]}
            width={512}
          />
        }
        count={count}
        kind={asset}
        onClick={handlePress}
        pressed={active}
        title={label}
        unavailable={disabledReason !== null}
      />
      <span className="sr-only" id={descriptionId}>
        {count} {count === 1 ? `${label.toLowerCase()} piece` : `${label.toLowerCase()} pieces`}{" "}
        remaining. Cost:{" "}
        {costResources
          .map((resource) => `${cost[resource]} ${RESOURCE_LABELS[resource]}`)
          .join(", ")}
        .{disabledReason ? ` ${disabledReason}.` : ""}
      </span>
    </>
  );
}

function getCostResources(cost: Readonly<ResourceInventory>) {
  return RESOURCE_ORDER.filter((resource) => cost[resource] > 0);
}

function getPlayerInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function getBuildDisabledReason({
  cost,
  legalTargetCount,
  pending,
  pieceLabel,
  piecePlural,
  piecesRemaining,
  resources,
}: {
  cost: Readonly<ResourceInventory>;
  legalTargetCount: number;
  pending: boolean;
  pieceLabel: string;
  piecePlural: string;
  piecesRemaining: number;
  resources: Readonly<ResourceInventory>;
}): string | null {
  if (pending) {
    return "Action in progress…";
  }
  if (piecesRemaining <= 0) {
    return `No ${piecePlural} remaining`;
  }

  const missingResourcesReason = getMissingResourcesReason(cost, resources);
  if (missingResourcesReason) {
    return missingResourcesReason;
  }
  if (legalTargetCount === 0) {
    return `No legal ${pieceLabel} location`;
  }
  return null;
}

function getDevelopmentCardDisabledReason({
  canBuy,
  pending,
  resources,
  supply,
}: {
  canBuy: boolean;
  pending: boolean;
  resources: Readonly<ResourceInventory>;
  supply: number;
}): string | null {
  if (pending) {
    return "Action in progress…";
  }
  if (supply <= 0) {
    return "No development cards remaining";
  }
  return (
    getMissingResourcesReason(DEVELOPMENT_CARD_COST, resources) ??
    (canBuy ? null : "Unavailable right now")
  );
}

function getMissingResourcesReason(
  cost: Readonly<ResourceInventory>,
  resources: Readonly<ResourceInventory>,
): string | null {
  const missingResources = RESOURCE_ORDER.flatMap((resource) => {
    const missingCount = Math.max(0, cost[resource] - resources[resource]);
    return missingCount > 0 ? [`${missingCount} ${RESOURCE_LABELS[resource]}`] : [];
  });
  return missingResources.length > 0 ? `Need ${missingResources.join(", ")}` : null;
}

function TurnClock({
  botThinking,
  isPaused,
  nextActionAt,
}: {
  botThinking: boolean;
  isPaused: boolean;
  nextActionAt?: number;
}) {
  const { isExpired, seconds } = useActionCountdown({ isPaused, nextActionAt });

  if (!isPaused && !nextActionAt) {
    return null;
  }

  const status = isPaused
    ? "Paused"
    : isExpired
      ? botThinking
        ? "Bot acting"
        : "Advancing"
      : botThinking
        ? "Bot thinking"
        : "Turn time";
  return (
    <div
      aria-label={
        isPaused
          ? seconds === null
            ? "Turn paused"
            : `Turn paused, ${seconds} seconds remaining`
          : isExpired
            ? botThinking
              ? "Bot acting"
              : "Turn expired, advancing"
            : seconds === null
              ? `${status}, timer starting`
              : `${status}, ${seconds} seconds remaining`
      }
      aria-live="off"
      className={`turn-clock${botThinking ? " is-bot" : ""}${isPaused ? " is-paused" : ""}${isExpired ? " is-expired" : ""}`}
      role="timer"
    >
      <strong>{isExpired ? "…" : seconds === null ? "—" : `${seconds}s`}</strong>
    </div>
  );
}

function toGameError(cause: unknown): string {
  const rawMessage = cause instanceof Error ? cause.message : "The action could not be completed.";
  const normalizedMessage = rawMessage.toLowerCase();
  if (normalizedMessage.includes("action number") || normalizedMessage.includes("stale")) {
    return "The game moved ahead before this action arrived. Review the refreshed board and try again.";
  }
  if (normalizedMessage.includes("deadline")) {
    return "That action arrived after the timer expired. The game is advancing automatically.";
  }
  if (normalizedMessage.includes("resources")) {
    return "You do not have the resources required for that action. Review your hand and try again.";
  }
  if (normalizedMessage.includes("phase") || normalizedMessage.includes("required actor")) {
    return "That action is no longer available. Review the current turn instruction and try again.";
  }
  return "The game rejected that action. Review the highlighted legal choices and try again.";
}

function isGamePausedError(cause: unknown): boolean {
  return cause instanceof Error && cause.message.toLowerCase().includes("game is paused");
}

function acquireSingleFlight(lock: { current: boolean }): boolean {
  if (lock.current) {
    return false;
  }

  lock.current = true;
  return true;
}
