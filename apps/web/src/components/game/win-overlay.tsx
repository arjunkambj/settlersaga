"use client";

import {
  getPlayedKnightCount,
  LARGEST_ARMY_VICTORY_POINTS,
  LONGEST_ROAD_VICTORY_POINTS,
  type BotDifficulty,
  type PlayerGameView,
  type PlayerViewState,
} from "@settersaga/game";
import eyeIcon from "@iconify-icons/solar/eye-bold";
import leaveIcon from "@iconify-icons/solar/logout-2-bold";
import restartIcon from "@iconify-icons/solar/restart-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_ASSET_PATHS,
} from "@/constants/game/card-assets";
import { VICTORY_FLOURISH_ASSET_PATH } from "@/constants/game/ui-assets";
import { toActionableError } from "@/lib/app/action-errors";
import { nameFit } from "@/lib/app/name-fit";
import { getPlayerPortraitSrc, type PortraitSources } from "@/lib/game/hud-portraits";
import {
  getDisplayedVictoryPoints,
  getPlayerColor,
  getShortPlayerName,
  getVictoryPointCardCount,
} from "@/lib/game/view";

import { PlayerAvatar } from "./player-avatar";

const RESULTS_SCENE_PATH = "/shared-assets/coastal-island-kingdom-supercell.png";
const DEFEAT_FLOURISH_ASSET_PATH = "/game-assets/results/defeat-flourish.png";
const PODIUM_ASSET_PATH = "/game-assets/results/podium.png";

type PendingAction = "leave" | "rematch";

interface Standing {
  place: number;
  player: PlayerViewState;
  score: number;
}

export function WinOverlay({
  botDifficulty,
  game,
  hostSeatIndex,
  longestRoadByPlayerId,
  offlineSeatIndexes,
  onLeave,
  onRematch,
  onViewBoard,
  viewerProfileImageUrl,
}: {
  botDifficulty: BotDifficulty;
  game: PlayerGameView;
  hostSeatIndex: number | null;
  longestRoadByPlayerId: ReadonlyMap<string, number>;
  offlineSeatIndexes: ReadonlySet<number>;
  onLeave(): Promise<void>;
  onRematch(): Promise<void>;
  onViewBoard(): void;
  viewerProfileImageUrl: string | null;
}) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const portraits: PortraitSources = { botDifficulty, viewerProfileImageUrl };
  const standings = getStandings(game);
  const [leader] = standings;
  const winner = leader.player.id === game.winnerPlayerId ? leader : undefined;
  const isViewerWin = winner?.player.isViewer === true;
  const copy = getResultCopy({
    isViewerWin,
    turns: game.turnNumber,
    victoryTarget: game.settings.victoryPoints,
    winner,
  });

  const viewer = game.players.find((player) => player.isViewer);
  const host = game.players.find((player) => player.seatIndex === hostSeatIndex);
  // The server lets the host start a rematch, or anyone once the host has gone quiet.
  const canRematch =
    hostSeatIndex !== null &&
    (viewer?.seatIndex === hostSeatIndex || offlineSeatIndexes.has(hostSeatIndex));
  const isLastHuman = game.players.every((player) => player.isViewer || player.isBot);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  // The main action takes focus when the results open, so Enter plays again (or views the
  // board). Its ring shows only when the player was already moving by keyboard, not on a screen
  // that simply appeared.
  useEffect(() => {
    const active = document.activeElement;
    const byKeyboard = active instanceof HTMLElement && active.matches(":focus-visible");
    primaryActionRef.current?.focus({ focusVisible: byKeyboard });
  }, [canRematch]);

  const run = async (action: PendingAction, work: () => Promise<void>) => {
    if (pendingAction) {
      return;
    }
    setPendingAction(action);
    setActionError("");
    try {
      await work();
    } catch (cause) {
      setActionError(toActionableError(cause));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section
      aria-describedby="win-headline win-detail"
      aria-labelledby="win-title"
      aria-modal="true"
      className="game-results fixed inset-0 z-40"
      role="dialog"
    >
      <div aria-hidden="true" className="game-results-scene">
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={RESULTS_SCENE_PATH}
        />
      </div>

      <div className="game-menu-panel game-dialog-panel game-results-panel motion-safe:animate-game-pop">
        <div className="game-results-body game-scroll-fade p-5 sm:p-6">
          <header className="grid justify-items-center text-center">
            <Image
              alt=""
              className="h-20 w-auto sm:h-24 [@media(height<52rem)]:h-16"
              draggable={false}
              height={512}
              priority
              src={isViewerWin ? VICTORY_FLOURISH_ASSET_PATH : DEFEAT_FLOURISH_ASSET_PATH}
              width={1536}
            />
            <h2 className="game-eyebrow mt-1 text-base tracking-[0.12em]" id="win-title">
              {copy.ribbon}
            </h2>
            <p
              className="game-title mt-2 mb-0 max-w-full text-2xl leading-tight text-balance sm:text-3xl"
              id="win-headline"
            >
              {copy.headline}
            </p>
            <p
              className="mt-1 mb-0 text-sm font-semibold text-muted-foreground sm:text-base"
              id="win-detail"
            >
              {copy.detail}
            </p>
          </header>

          <div className="grid items-center gap-5 md:grid-cols-2">
            <div aria-hidden="true" className="game-podium">
              <Image
                alt=""
                className="game-podium-art"
                draggable={false}
                height={640}
                priority
                sizes="(min-width: 48rem) 25rem, 90vw"
                src={PODIUM_ASSET_PATH}
                width={1024}
              />
              {standings.slice(0, 3).map(({ place, player }) => (
                <div
                  className={`game-podium-spot player-${getPlayerColor(player)} motion-safe:animate-game-pop`}
                  data-place={place}
                  key={player.id}
                >
                  <PlayerAvatar
                    className="game-podium-avatar"
                    imageSize={128}
                    isBot={player.isBot}
                    name={player.displayName}
                    src={getPlayerPortraitSrc(player, portraits)}
                  />
                  <span className="game-medal game-podium-medal" data-place={place}>
                    {place}
                  </span>
                  <span
                    className="game-podium-name"
                    data-name-fit={
                      player.isViewer ? undefined : nameFit(getShortPlayerName(player.displayName))
                    }
                  >
                    {player.isViewer ? "You" : getShortPlayerName(player.displayName)}
                  </span>
                </div>
              ))}
            </div>

            <ol aria-label="Final standings" className="game-standings">
              {standings.map(({ place, player, score }) => {
                const tags = getStandingTags(player, {
                  isAway: offlineSeatIndexes.has(player.seatIndex),
                  isHost: player.seatIndex === hostSeatIndex,
                  isWinner: player.id === game.winnerPlayerId,
                });
                return (
                  <li
                    className={`game-standing player-${getPlayerColor(player)}`}
                    data-winner={player.id === game.winnerPlayerId || undefined}
                    key={player.id}
                  >
                    <span className="game-medal" data-place={place}>
                      <span className="sr-only">Place </span>
                      {place}
                    </span>
                    <PlayerAvatar
                      className="game-standing-avatar"
                      imageSize={48}
                      isBot={player.isBot}
                      name={player.displayName}
                      src={getPlayerPortraitSrc(player, portraits)}
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <strong
                        className="game-standing-name"
                        data-name-fit={nameFit(player.displayName)}
                      >
                        {player.displayName}
                      </strong>
                      <span className="game-standing-meta">{tags || "Player"}</span>
                    </span>
                    <span className="game-standing-score">
                      {score}
                      <small>VP</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <section aria-labelledby="win-scoring-title" className="grid gap-3">
            <h3 className="game-results-heading" id="win-scoring-title">
              {leader.player.isViewer
                ? "How you scored"
                : `How ${leader.player.displayName} scored`}
            </h3>
            <ul className="game-score-tiles">
              {getPointSources(game, leader.player, longestRoadByPlayerId).map((source) => (
                <li
                  className="game-score-tile"
                  data-zero={source.points === 0 || undefined}
                  key={source.label}
                >
                  <span className="game-score-art">
                    <Image
                      alt=""
                      draggable={false}
                      height={source.shape === "card" ? 96 : 64}
                      src={source.asset}
                      width={64}
                    />
                    <b className="game-score-points">+{source.points}</b>
                  </span>
                  <span className="game-score-label">{source.label}</span>
                  <span className="game-score-detail">{source.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="game-results-actions px-5 py-4 sm:px-6">
          <LiveMessage message={confirmingLeave ? "" : actionError} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Button
              disabled={pendingAction !== null}
              onClick={() => setConfirmingLeave(true)}
              size="game-lg"
              variant="game-danger"
            >
              <Icon aria-hidden="true" icon={leaveIcon} />
              Leave
            </Button>
            <Button
              disabled={pendingAction !== null}
              onClick={onViewBoard}
              ref={canRematch ? undefined : primaryActionRef}
              size="game-lg"
              variant="game-secondary"
            >
              <Icon aria-hidden="true" icon={eyeIcon} />
              View board
            </Button>
            {canRematch ? (
              <Button
                className="col-span-2 sm:col-span-1"
                disabled={pendingAction !== null}
                onClick={() => void run("rematch", onRematch)}
                ref={primaryActionRef}
                size="game-lg"
                variant="game-gold"
              >
                {pendingAction === "rematch" ? (
                  <Spinner />
                ) : (
                  <Icon aria-hidden="true" icon={restartIcon} />
                )}
                {pendingAction === "rematch" ? "Starting…" : "Play again"}
              </Button>
            ) : (
              <p aria-live="polite" className="game-results-waiting col-span-2 sm:col-span-1">
                <Spinner />
                <span className="line-clamp-2">
                  Waiting for {host?.displayName ?? "the host"} to start a rematch…
                </span>
              </p>
            )}
          </div>
        </footer>
      </div>

      {confirmingLeave ? (
        <ConfirmationDialog
          busy={pendingAction === "leave"}
          confirmLabel="Leave"
          description={
            isLastHuman
              ? "You’re the last one here, so the game closes."
              : "A bot takes your seat for the next game."
          }
          error={actionError}
          onCancel={() => {
            setConfirmingLeave(false);
            setActionError("");
          }}
          onConfirm={() => void run("leave", onLeave)}
          title="Leave this game?"
        />
      ) : null}
    </section>
  );
}

/** Winner first, then by points, then by turn order; places run 1, 2, 3… */
function getStandings(game: PlayerGameView): Standing[] {
  const turn = (player: PlayerViewState) => game.turnOrder.indexOf(player.id);
  const isWinner = (player: PlayerViewState) => Number(player.id === game.winnerPlayerId);
  return game.players
    .map((player) => ({ player, score: getDisplayedVictoryPoints(player) }))
    .sort(
      (left, right) =>
        isWinner(right.player) - isWinner(left.player) ||
        right.score - left.score ||
        turn(left.player) - turn(right.player),
    )
    .map((standing, index) => ({ ...standing, place: index + 1 }));
}

function getResultCopy({
  isViewerWin,
  turns,
  victoryTarget,
  winner,
}: {
  isViewerWin: boolean;
  turns: number;
  victoryTarget: number;
  winner: Standing | undefined;
}): { detail: string; headline: string; ribbon: string } {
  if (!winner) {
    return {
      detail: `No one reached ${victoryTarget} points.`,
      headline: "No winner this time",
      ribbon: "Game over",
    };
  }

  if (isViewerWin) {
    return {
      detail: `${winner.score} points in ${turns} turns. Nicely played.`,
      headline: "The island is yours",
      ribbon: "You won",
    };
  }

  return {
    detail: `${winner.player.displayName} reached ${winner.score} points in ${turns} turns.`,
    headline: `${winner.player.displayName} takes the island`,
    ribbon: "Game over",
  };
}

function getStandingTags(
  player: PlayerViewState,
  { isAway, isHost, isWinner }: { isAway: boolean; isHost: boolean; isWinner: boolean },
): string {
  return [
    isWinner ? "Winner" : null,
    player.isViewer ? "You" : null,
    isHost ? "Host" : null,
    player.isBot ? "Bot" : null,
    isAway ? "Away" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

interface PointSource {
  asset: string;
  detail: string;
  label: string;
  points: number;
  shape: "award" | "card";
}

function getPointSources(
  game: PlayerGameView,
  player: PlayerViewState,
  longestRoadByPlayerId: ReadonlyMap<string, number>,
): PointSource[] {
  let settlements = 0;
  let cities = 0;
  for (const building of game.board.buildings) {
    if (building.playerId !== player.id) {
      continue;
    }
    if (building.kind === "city") {
      cities += 1;
    } else {
      settlements += 1;
    }
  }

  const victoryPointCards = getVictoryPointCardCount(player);
  const knights = getPlayedKnightCount(player);
  const roadLength = longestRoadByPlayerId.get(player.id) ?? 0;

  return [
    {
      asset: ACTION_CARD_ASSET_PATHS.settlement,
      detail: `${settlements} built`,
      label: "Settlements",
      points: settlements,
      shape: "card",
    },
    {
      asset: ACTION_CARD_ASSET_PATHS.city,
      detail: `${cities} built`,
      label: "Cities",
      points: cities * 2,
      shape: "card",
    },
    {
      asset: AWARD_ASSET_PATHS.longestRoad,
      detail: `Road length: ${roadLength}`,
      label: "Longest Road",
      points: game.longestRoadPlayerId === player.id ? LONGEST_ROAD_VICTORY_POINTS : 0,
      shape: "award",
    },
    {
      asset: AWARD_ASSET_PATHS.largestArmy,
      detail: `${knights} ${knights === 1 ? "knight" : "knights"}`,
      label: "Largest Army",
      points: game.largestArmyPlayerId === player.id ? LARGEST_ARMY_VICTORY_POINTS : 0,
      shape: "award",
    },
    {
      asset: DEVELOPMENT_CARD_ASSET_PATHS["victory-point"],
      detail: `${victoryPointCards} ${victoryPointCards === 1 ? "card" : "cards"}`,
      label: "VP cards",
      points: victoryPointCards,
      shape: "card",
    },
  ];
}
