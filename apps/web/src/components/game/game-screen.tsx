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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const gameHeaderActionClassName =
    "inline-flex size-9 items-center justify-center rounded-full border-0 bg-card/90 text-muted-foreground hover:bg-card hover:text-foreground shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

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
      <div className="absolute z-30 top-[max(0.4rem,env(safe-area-inset-top))] left-[max(0.45rem,env(safe-area-inset-left))] flex items-center gap-2 pointer-events-none max-[1100px]:relative max-[1100px]:inset-auto max-[1100px]:w-full max-[1100px]:justify-between max-[1100px]:flex-wrap max-[1100px]:pointer-events-auto [&>*]:pointer-events-auto">
        <p className="sr-only">
          Turn {game.turnNumber}. First to {game.settings.victoryPoints} victory points.
        </p>
        <div className="flex items-center gap-1.5">
          {isHost && game.status !== "completed" ? (
            <Button
              aria-label={isPaused ? "Resume game" : "Pause game"}
              aria-pressed={isPaused}
              className={gameHeaderActionClassName}
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
            className={gameHeaderActionClassName}
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
            className={gameHeaderActionClassName}
            data-icon-only
            onClick={() => setIsHelpOpen(true)}
            size="icon"
            variant="ghost"
          >
            <Icon aria-hidden="true" icon={helpIcon} />
          </Button>
          <Button
            aria-label="Leave game"
            className="inline-flex size-9 items-center justify-center rounded-full border-0 bg-destructive text-destructive-foreground hover:bg-destructive/80 shadow-sm transition-all"
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
        <aside
          aria-label="Table status"
          className="absolute z-30 top-[max(0.4rem,env(safe-area-inset-top))] right-[max(0.45rem,env(safe-area-inset-right))] bottom-[max(0.4rem,env(safe-area-inset-bottom))] flex flex-col w-[clamp(350px,27.5vw,430px)] min-h-0 gap-2 pointer-events-none max-[1100px]:relative max-[1100px]:inset-auto max-[1100px]:w-full max-[1100px]:pointer-events-auto [&>*]:pointer-events-auto"
        >
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            <EventLog
              events={events}
              players={game.players}
              viewerPlayerId={me.id}
              viewerProfileImageUrl={viewerProfileImageUrl}
            />
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

        <div
          className="absolute z-40 left-[max(0.45rem,env(safe-area-inset-left))] bottom-[calc(8.25rem+max(0.4rem,env(safe-area-inset-bottom)))] block w-[min(17rem,42%)] pointer-events-none max-[1100px]:relative max-[1100px]:inset-auto max-[1100px]:w-[min(17rem,60%)] max-[1100px]:pointer-events-auto"
          id={BOARD_INSPECTOR_DOCK_ROOT_ID}
        />

        <GameBoard
          buildMode={buildMode}
          game={game}
          onCancelBuildMode={() => setBuildMode(null)}
          onCommand={(command, message) => void sendCommand(command, message)}
          onPlacementExit={restorePlacementFocus}
          pending={pendingCommand !== null}
        />

        <footer className="absolute z-30 right-[calc(clamp(350px,27.5vw,430px)+max(0.45rem,env(safe-area-inset-right))+0.5rem)] bottom-[max(0.4rem,env(safe-area-inset-bottom))] left-[max(0.45rem,env(safe-area-inset-left))] grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pointer-events-none max-[1100px]:relative max-[1100px]:inset-auto max-[1100px]:w-full max-[1100px]:grid-cols-1 max-[1100px]:pointer-events-auto [&>*]:pointer-events-auto">
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

          <div className="grid grid-cols-[max-content_minmax(5.8rem,auto)] max-[1100px]:grid-cols-[minmax(0,1fr)_auto] gap-1.5 pointer-events-none [&>*]:pointer-events-auto">
            <section
              aria-labelledby="phase-title"
              className="flex min-w-[16rem] items-center gap-2.5 px-3 py-2 rounded-2xl bg-card/90 shadow-lg border border-white/10 text-card-foreground"
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/20 text-primary"
              >
                <Icon className="size-4" icon={playerIcon} />
              </span>
              <div className="flex-1 min-w-0">
                <h1
                  className="m-0 text-sm font-bold truncate text-foreground"
                  id="phase-title"
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                >
                  {phaseCopy.title}
                </h1>
                <span className="sr-only">{phaseCopy.detail}</span>
              </div>
              {isViewerTurn && game.lastDiceRoll ? (
                <CompactDiceResult
                  className="flex items-center gap-1.5"
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
      className="flex flex-col w-full min-w-0 shrink-0 max-h-[50%] gap-1.5 p-0 m-0 overflow-y-auto list-none [scrollbar-width:thin]"
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
        const avatarSrc =
          player.isViewer && viewerProfileImageUrl
            ? viewerProfileImageUrl
            : getPlayerPortraitPath(theme);
        return (
          <li
            aria-current={isActive ? "true" : undefined}
            className={`relative flex items-center justify-between gap-3 p-3 min-h-[90px] rounded-2xl shadow-md border border-white/10 transition-all player-${theme} ${
              isActive ? "bg-card/90 shadow-xl ring-1 ring-white/20" : "bg-card/90"
            }`}
            data-player-id={player.id}
            key={player.id}
          >
            {isActive && !player.isViewer && lastDiceRoll ? (
              <CompactDiceResult
                className="absolute right-2 -top-2 flex gap-1 z-20"
                roll={lastDiceRoll}
              />
            ) : null}

            {/* Left: Avatar + Player Name */}
            <div className="flex flex-col items-center justify-center w-14 shrink-0 min-w-0">
              <span
                className="relative grid size-11.5 place-items-center rounded-full border-2 border-[var(--player-color,var(--primary))] bg-background/60 overflow-hidden shadow-inner shrink-0"
                aria-hidden="true"
              >
                <span className="absolute text-xs font-black text-foreground">
                  {player.isBot ? (
                    <Icon aria-hidden="true" className="size-4" icon={botIcon} />
                  ) : (
                    getPlayerInitials(player.displayName)
                  )}
                </span>
                <Image
                  alt=""
                  className="relative size-full object-cover"
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
              <strong
                className="truncate max-w-full text-center text-[0.7rem] font-bold text-foreground tracking-tight leading-tight mt-1"
                title={player.displayName}
              >
                {player.displayName}
              </strong>
            </div>

            {/* Middle: 4 Stat Cards with floating white badges and labels */}
            <div
              aria-label="Cards and awards"
              className="flex items-end justify-around flex-1 min-w-0 gap-1.5 px-0.5"
              role="group"
            >
              {/* Resources */}
              <div className="flex flex-col items-center justify-end gap-1 min-w-0">
                <div
                  aria-label={`${player.resourceCount} resource cards`}
                  className="relative w-8 aspect-[2/3] rounded overflow-visible cursor-default transition-transform hover:scale-105"
                  title={`${player.resourceCount} resource cards`}
                >
                  <Image
                    alt=""
                    className="size-full rounded object-contain"
                    draggable={false}
                    height={768}
                    sizes="3.5rem"
                    src={UNKNOWN_RESOURCE_CARD_ASSET_PATH}
                    width={512}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 z-10 grid size-4.5 place-items-center rounded-full bg-white text-zinc-950 text-[0.6rem] font-black shadow-sm tabular-nums pointer-events-none"
                  >
                    {player.resourceCount}
                  </span>
                </div>
                <span className="text-[0.58rem] font-medium text-muted-foreground whitespace-nowrap leading-none mt-0.5">
                  Resources
                </span>
              </div>

              {/* Dev Cards */}
              <div className="flex flex-col items-center justify-end gap-1 min-w-0">
                <div
                  aria-label={`${developmentCardCount} development cards`}
                  className="relative w-8 aspect-[2/3] rounded overflow-visible cursor-default transition-transform hover:scale-105"
                  title={`${developmentCardCount} development cards`}
                >
                  <Image
                    alt=""
                    className="size-full rounded object-contain"
                    draggable={false}
                    height={768}
                    sizes="3.5rem"
                    src={DEVELOPMENT_CARD_BACK_ASSET_PATH}
                    width={512}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 z-10 grid size-4.5 place-items-center rounded-full bg-white text-zinc-950 text-[0.6rem] font-black shadow-sm tabular-nums pointer-events-none"
                  >
                    {developmentCardCount}
                  </span>
                </div>
                <span className="text-[0.58rem] font-medium text-muted-foreground whitespace-nowrap leading-none mt-0.5">
                  Dev cards
                </span>
              </div>

              {/* Road */}
              <div className="flex flex-col items-center justify-end gap-1 min-w-0">
                <div
                  aria-label={
                    holdsLongestRoad
                      ? `Longest Road held, length ${longestRoad}`
                      : `Longest road length ${longestRoad}`
                  }
                  className={`relative size-8 grid place-items-center rounded overflow-visible cursor-default transition-transform hover:scale-105 ${
                    holdsLongestRoad ? "ring-2 ring-primary/60 rounded-full" : ""
                  }`}
                  data-empty={longestRoad === 0 ? "true" : undefined}
                  title={holdsLongestRoad ? "Longest Road (+2 VP)" : `Road length ${longestRoad}`}
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="size-7 object-contain"
                    draggable={false}
                    height={512}
                    sizes="2.5rem"
                    src={AWARD_ASSET_PATHS.longestRoad}
                    width={512}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 z-10 grid size-4.5 place-items-center rounded-full bg-white text-zinc-950 text-[0.6rem] font-black shadow-sm tabular-nums pointer-events-none"
                  >
                    {longestRoad}
                  </span>
                </div>
                <span className="text-[0.58rem] font-medium text-muted-foreground whitespace-nowrap leading-none mt-0.5">
                  Road
                </span>
              </div>

              {/* Army */}
              <div className="flex flex-col items-center justify-end gap-1 min-w-0">
                <div
                  aria-label={
                    holdsLargestArmy
                      ? `Largest Army held, ${knightCount} knights played`
                      : `${knightCount} knights played toward Largest Army`
                  }
                  className={`relative size-8 grid place-items-center rounded overflow-visible cursor-default transition-transform hover:scale-105 ${
                    holdsLargestArmy ? "ring-2 ring-primary/60 rounded-full" : ""
                  }`}
                  data-empty={knightCount === 0 ? "true" : undefined}
                  title={
                    holdsLargestArmy ? "Largest Army (+2 VP)" : `${knightCount} knights played`
                  }
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="size-7 object-contain"
                    draggable={false}
                    height={512}
                    sizes="2.5rem"
                    src={AWARD_ASSET_PATHS.largestArmy}
                    width={512}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 z-10 grid size-4.5 place-items-center rounded-full bg-white text-zinc-950 text-[0.6rem] font-black shadow-sm tabular-nums pointer-events-none"
                  >
                    {knightCount}
                  </span>
                </div>
                <span className="text-[0.58rem] font-medium text-muted-foreground whitespace-nowrap leading-none mt-0.5">
                  Army
                </span>
              </div>
            </div>

            {/* Right: Divider + Victory Points */}
            <div className="flex items-center gap-3 shrink-0 pl-1">
              <div className="w-[1px] h-11 bg-white/15 shrink-0" aria-hidden="true" />
              <div
                aria-label={
                  hiddenVictoryPointCount > 0
                    ? `${displayedVictoryPoints} of ${victoryTarget} victory points, including ${hiddenVictoryPointCount} from hidden victory point cards`
                    : `${displayedVictoryPoints} of ${victoryTarget} victory points`
                }
                className="flex flex-col items-center justify-center min-w-[3.25rem] shrink-0"
              >
                <div className="inline-flex items-baseline gap-1 text-foreground">
                  <Icon
                    aria-hidden="true"
                    className="size-3.5 text-primary self-center shrink-0"
                    icon={crownIcon}
                  />
                  <strong className="text-sm font-black tabular-nums tracking-tight leading-none">
                    {displayedVictoryPoints}
                  </strong>
                  <small className="text-[0.62rem] font-bold text-muted-foreground leading-none">
                    /{victoryTarget}
                  </small>
                </div>
                <span className="text-[0.52rem] font-black tracking-widest uppercase text-muted-foreground/80 mt-1 leading-none">
                  Victory
                </span>
              </div>
            </div>

            {isHost && !player.isViewer && !player.isBot ? (
              <Button
                aria-label={`Replace ${player.displayName} with a bot`}
                className="absolute -bottom-2 right-2 h-5 px-2 text-[0.55rem] rounded-full gap-1 z-10"
                disabled={pendingReplacementId !== null}
                onClick={() => onReplacePlayer(player.id)}
                size="sm"
                variant="secondary"
              >
                <Icon aria-hidden="true" className="size-2.5" icon={botIcon} />
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
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <DieFace tone="ivory" value={roll.first} />
        <DieFace tone="ember" value={roll.second} />
      </span>
      {showTotal ? (
        <strong
          aria-hidden="true"
          className="min-w-5 text-sm font-black tabular-nums text-center text-foreground"
        >
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
    <section
      aria-label="Resource market"
      className="shrink-0 p-2 rounded-2xl bg-card/90 shadow-md border border-white/10"
    >
      <ul className="flex flex-nowrap gap-1.5 p-0 m-0 list-none">
        {RESOURCE_ORDER.map((resource) => (
          <li
            aria-label={`${RESOURCE_LABELS[resource]}: ${bank ? bank[resource] : "unknown"}`}
            className="relative grid flex-1 min-w-0 aspect-[2/3] rounded-lg"
            key={resource}
          >
            <span aria-hidden="true" className="block size-full rounded-lg overflow-hidden">
              <Image
                alt=""
                className="size-full object-contain"
                draggable={false}
                height={768}
                sizes="3.5rem"
                src={RESOURCE_CARD_ASSET_PATHS[resource]}
                width={512}
              />
            </span>
            <strong
              aria-hidden="true"
              className="absolute -top-1 -right-1 z-10 grid min-w-4 h-4 place-items-center px-1 rounded-full bg-primary text-primary-foreground text-[0.58rem] font-black tabular-nums shadow-sm"
            >
              {bank ? bank[resource] : "?"}
            </strong>
          </li>
        ))}
        <li
          aria-label={`Development cards: ${developmentCardSupply}`}
          className="relative grid flex-1 min-w-0 aspect-[2/3] rounded-lg"
        >
          <span aria-hidden="true" className="block size-full rounded-lg overflow-hidden">
            <Image
              alt=""
              className="size-full object-contain"
              draggable={false}
              height={768}
              sizes="3.5rem"
              src={DEVELOPMENT_CARD_BACK_ASSET_PATH}
              width={512}
            />
          </span>
          <strong
            aria-hidden="true"
            className="absolute -top-1 -right-1 z-10 grid min-w-4 h-4 place-items-center px-1 rounded-full bg-primary text-primary-foreground text-[0.58rem] font-black tabular-nums shadow-sm"
          >
            {developmentCardSupply}
          </strong>
        </li>
      </ul>
    </section>
  );
}

function getEventActionIcon(kind: string, text: string): string {
  const lower = text.toLowerCase();
  if (kind === "roll" || lower.includes("roll")) return "🎲";
  if (kind === "place_settlement" || lower.includes("settlement")) return "🏠";
  if (kind === "place_road" || lower.includes("road")) return "🛣️";
  if (kind === "build_city" || lower.includes("city")) return "🏰";
  if (
    kind === "buy_development_card" ||
    lower.includes("development card") ||
    lower.includes("dev card")
  )
    return "📜";
  if (kind === "play_knight" || lower.includes("knight")) return "⚔️";
  if (
    kind === "move_robber" ||
    kind === "move_robber_and_steal" ||
    kind === "steal" ||
    lower.includes("robber") ||
    lower.includes("stole")
  )
    return "🕵️";
  if (kind.startsWith("trade") || lower.includes("trade")) return "🔄";
  if (lower.includes("monopoly")) return "👑";
  if (lower.includes("resource") || lower.includes("harvest") || lower.includes("received"))
    return "🌾";
  return "•";
}

function EventLog({
  events,
  players,
  viewerPlayerId,
  viewerProfileImageUrl,
}: {
  events: RoomEventView[];
  players: PlayerGameView["players"];
  viewerPlayerId?: string;
  viewerProfileImageUrl?: string | null;
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
    <section
      className="relative flex flex-col min-h-0 flex-1 p-2.5 rounded-2xl bg-card/90 shadow-md border border-white/10"
      aria-labelledby="events-title"
    >
      {/* Header with live activity indicator */}
      <div className="flex items-center justify-between gap-2 mb-2 px-1 text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="size-2 rounded-full bg-emerald-400 animate-pulse shadow-sm"
            aria-hidden="true"
          />
          <h2
            className="m-0 text-xs font-black tracking-wider uppercase text-foreground/80"
            id="events-title"
          >
            Game Log
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.58rem] font-bold px-1.5 py-0.5 rounded-full bg-background/50 text-muted-foreground/80 tabular-nums">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          <Icon aria-hidden="true" className="size-4 text-primary" icon={chatIcon} />
        </div>
      </div>

      {/* Scrollable chat messages feed */}
      <ol
        className="flex flex-col flex-1 min-h-0 gap-1.5 p-0.5 m-0 overflow-y-auto list-none [scrollbar-width:thin] text-xs"
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
            const isViewer = actor?.id === viewerPlayerId;
            const isLatestGroup = groupIndex === groups.length - 1;
            const avatarSrc =
              isViewer && viewerProfileImageUrl
                ? viewerProfileImageUrl
                : theme
                  ? getPlayerPortraitPath(theme)
                  : undefined;
            return (
              <li
                className={`relative flex flex-col gap-1 p-2 rounded-xl border transition-all ${
                  isViewer
                    ? "bg-primary/[0.08] border-primary/25"
                    : "bg-background/40 border-white/5"
                }${theme ? ` player-${theme}` : ""}`}
                key={group.key}
              >
                {/* Header: Avatar + Name + You Badge + Timestamp */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="relative grid size-5 place-items-center rounded-full border border-[var(--player-color,var(--primary))] bg-background/80 overflow-hidden shadow-inner shrink-0"
                      aria-hidden="true"
                    >
                      <span className="absolute text-[0.5rem] font-black text-foreground">
                        {actor?.isBot ? (
                          <Icon aria-hidden="true" className="size-2.5" icon={botIcon} />
                        ) : (
                          getPlayerInitials(actorName)
                        )}
                      </span>
                      {avatarSrc ? (
                        <Image
                          alt=""
                          className="relative size-full object-cover"
                          draggable={false}
                          height={48}
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                          src={avatarSrc}
                          unoptimized
                          width={48}
                        />
                      ) : null}
                    </span>
                    <strong className="truncate text-[0.72rem] font-bold text-[var(--player-color,var(--foreground))]">
                      {actorName}
                    </strong>
                    {isViewer ? (
                      <span className="inline-flex items-center h-3 px-1 rounded-full bg-accent/20 text-[0.45rem] font-black uppercase tracking-wider text-accent shrink-0">
                        You
                      </span>
                    ) : null}
                  </div>
                  {latest ? (
                    <time
                      className="shrink-0 text-[0.58rem] font-mono tabular-nums text-muted-foreground/60"
                      dateTime={new Date(latest.createdAt).toISOString()}
                    >
                      {timeFormatter.format(latest.createdAt)}
                    </time>
                  ) : null}
                </div>

                {/* Event action lines */}
                <ol className="flex flex-col gap-0.5 p-0 m-0 list-none pl-6">
                  {group.events.map((item) => {
                    const actionText = eventActionLabel(item.text, actor?.displayName);
                    const icon = getEventActionIcon(item.kind, actionText);
                    return (
                      <li
                        className={`flex items-baseline gap-1.5 text-[0.72rem] leading-snug ${
                          isLatestGroup ? "text-foreground font-medium" : "text-muted-foreground"
                        }`}
                        data-tone={getEventTone(item.kind)}
                        key={item.sequence}
                      >
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[0.68rem] opacity-80 select-none"
                        >
                          {icon}
                        </span>
                        <p className="m-0 break-words">{actionText}</p>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })
        ) : (
          <li className="py-4 text-center text-xs text-muted-foreground/70 italic">
            <p>No moves yet.</p>
          </li>
        )}
      </ol>
      {hasUnseen ? (
        <Button
          className="absolute bottom-3 left-1/2 -translate-x-1/2 min-w-20 shadow-lg text-xs rounded-full gap-1"
          onClick={() => setPinnedToLatest(true)}
          size="sm"
          variant="secondary"
        >
          <span>↓ Latest</span>
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
      <section
        className="flex flex-nowrap items-center gap-2 p-2 rounded-2xl bg-card/90 shadow-md border border-white/10"
        aria-label="Choose a player to steal from"
      >
        <div className="grid gap-0.5">
          <strong className="text-xs font-black uppercase text-foreground">
            Choose a Neighbor
          </strong>
          <span className="text-[0.65rem] text-muted-foreground">
            The stolen resource is selected at random.
          </span>
        </div>
        <div className="flex flex-nowrap items-stretch gap-1">
          {legal.victimPlayerIds.map((playerId) => {
            const player = game.players.find((candidate) => candidate.id === playerId);
            return (
              <Button
                className="h-8 px-2.5 rounded-lg text-xs gap-1.5"
                disabled={pending}
                key={playerId}
                onClick={() =>
                  onCommand({ kind: "steal", victimPlayerId: playerId }, "Resource stolen.")
                }
                variant="secondary"
              >
                <Icon aria-hidden="true" className="size-3.5" icon={playerIcon} />{" "}
                {player?.displayName ?? "Neighbor"}
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
    <section
      aria-labelledby="building-actions-title"
      className="flex flex-nowrap items-center gap-1.5 px-2 py-1.5 pt-2 rounded-2xl bg-card/90 shadow-md border border-white/10"
    >
      <div className="sr-only">
        <strong id="building-actions-title">Build & Trade</strong>
        <span>
          {disabledReasonOverride ??
            "Buy a card, trade, or select a piece and choose a glowing target."}
        </span>
      </div>
      <div className="flex flex-nowrap items-stretch gap-1.5 pt-1.5 pb-0.5 px-0.5">
        <TradeCenter
          disabled={pending || disabledReasonOverride !== undefined}
          game={game}
          isPaused={isPaused}
          me={me}
          onCommand={onCommand}
          onPausedAction={onPausedAction}
        />
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

  if (controlKind === "roll") {
    return (
      <section
        className="group grid min-w-[5.8rem] content-center justify-items-center gap-2 p-2 rounded-2xl bg-card/90 shadow-md border border-white/10 select-none"
        aria-label="Turn control"
      >
        <div
          aria-label="Dice ready to roll"
          className="flex items-center justify-center gap-2 py-0.5"
          role="img"
        >
          <span className="inline-block transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105 drop-shadow-sm">
            <DieFace tone="ivory" value={1} />
          </span>
          <span className="inline-block transition-transform duration-200 group-hover:rotate-6 group-hover:scale-105 drop-shadow-sm">
            <DieFace tone="ember" value={5} />
          </span>
        </div>
        <Button
          className="w-full h-8 px-2 rounded-full font-black text-xs tracking-tight shadow-sm hover:brightness-105 active:scale-[0.97] transition-all duration-150"
          disabled={pending}
          onClick={() => onCommand({ kind: "roll" }, "Dice rolled.")}
        >
          <span className="inline-flex items-center gap-1.5">
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
      <section
        className="group grid min-w-[5.8rem] content-center justify-items-center gap-2 p-2 rounded-2xl bg-card/90 shadow-md border border-white/10 select-none"
        aria-label="Turn control"
      >
        <Button
          aria-label="End Turn"
          className="w-full h-full min-h-12 px-2 rounded-xl font-black text-xs tracking-tight shadow-sm hover:brightness-105 active:scale-[0.97] transition-all duration-150"
          disabled={pending || !legal.canEndTurn}
          onClick={() => onCommand({ kind: "end_turn" }, "Turn ended.")}
        >
          <span className="inline-flex items-center gap-1.5">
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
    <section
      aria-label="Turn control"
      className="grid min-w-[5.8rem] content-center justify-items-center gap-1 p-2 rounded-2xl bg-card/90 shadow-md border border-white/10 text-muted-foreground/70 text-xs font-bold text-center select-none"
    >
      {controlKind === "waiting" ? (
        <>
          <Image
            alt=""
            className="size-8 object-contain opacity-75"
            draggable={false}
            height={256}
            src={WAIT_ICON_ASSET_PATH}
            width={256}
          />
          <span className="text-[0.68rem] font-bold text-muted-foreground">Waiting</span>
        </>
      ) : (
        <span className="grid gap-0.5 text-[0.72rem] font-extrabold text-foreground leading-tight">
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
        <section className="grid max-w-md gap-3 p-6 rounded-2xl bg-card border border-border shadow-xl text-card-foreground">
          <h1 className="m-0 text-xl font-extrabold text-foreground">Player View Unavailable</h1>
          <p className="m-0 text-sm text-muted-foreground">
            Your private seat could not be matched to this game. Refresh to reconnect.
          </p>
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
            className="size-full rounded object-contain"
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
            className="size-full rounded object-contain"
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
      className={`flex min-w-[4.8rem] items-center justify-center gap-1 px-3 py-1.5 rounded-2xl bg-card/90 shadow-md border border-white/10 text-xs font-mono tabular-nums ${
        isExpired || isPaused
          ? "text-destructive"
          : botThinking
            ? "text-primary"
            : "text-foreground"
      }`}
      role="timer"
    >
      <strong className="font-extrabold">
        {isExpired ? "…" : seconds === null ? "—" : `${seconds}s`}
      </strong>
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
