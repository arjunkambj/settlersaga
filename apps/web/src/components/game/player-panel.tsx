"use client";

import {
  LARGEST_ARMY_VICTORY_POINTS,
  LONGEST_ROAD_VICTORY_POINTS,
  getPlayedKnightCount,
  type BotDifficulty,
  type PlayerGameView,
} from "@settersaga/game";
import crownIcon from "@iconify-icons/solar/crown-minimalistic-bold";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import {
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import { getPlayerPortraitSrc } from "@/lib/game/hud-portraits";
import {
  getDisplayedVictoryPoints,
  getPlayerColor,
  getPlayerHudOrder,
  getVictoryPointCardCount,
} from "@/lib/game/view";

import { DiceRoll } from "./die-face";
import { PlayerAvatar } from "./player-avatar";

/**
 * One plaque per player, in turn order after the viewer: portrait, name, card and award counts,
 * and points. Every plaque has the same size whatever it shows (styles/game-hud.css). Once the
 * game is won, the winner's plaque carries the ribbon instead of the player on turn.
 */
export function PlayerPanel({
  activePlayerId,
  botDifficulty,
  hostSeatIndex = null,
  isHost,
  largestArmyPlayerId,
  lastDiceRoll,
  longestRoadByPlayerId,
  longestRoadPlayerId,
  offlineSeatIndexes,
  onReplacePlayer,
  pendingReplacementId,
  players,
  turnOrder,
  viewerProfileImageUrl,
  victoryTarget,
  winnerPlayerId = null,
}: {
  activePlayerId: string;
  botDifficulty: BotDifficulty;
  /** Seat of the room's host, marked with a crown. */
  hostSeatIndex?: number | null;
  isHost: boolean;
  largestArmyPlayerId: string | null;
  lastDiceRoll: PlayerGameView["lastDiceRoll"];
  longestRoadByPlayerId: ReadonlyMap<string, number>;
  longestRoadPlayerId: string | null;
  /** Human seats whose connection has gone quiet. */
  offlineSeatIndexes?: ReadonlySet<number>;
  onReplacePlayer(playerId: string): void;
  pendingReplacementId: string | null;
  players: PlayerGameView["players"];
  turnOrder: readonly string[];
  viewerProfileImageUrl: string | null;
  victoryTarget: number;
  winnerPlayerId?: string | null;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const orderedPlayers = useMemo(() => getPlayerHudOrder(players, turnOrder), [players, turnOrder]);
  const isFinished = winnerPlayerId !== null;
  const featuredPlayerId = winnerPlayerId ?? activePlayerId;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const list = listRef.current;
      const featuredPlayer = list?.querySelector<HTMLElement>(
        `[data-player-id="${CSS.escape(featuredPlayerId)}"]`,
      );
      const listBounds = list?.getBoundingClientRect();
      const playerBounds = featuredPlayer?.getBoundingClientRect();
      const isVisible =
        listBounds &&
        playerBounds &&
        playerBounds.top >= listBounds.top &&
        playerBounds.bottom <= listBounds.bottom;
      if (isVisible) {
        return;
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      featuredPlayer?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [featuredPlayerId]);

  return (
    <ol aria-label="Crew" className="game-player-list" ref={listRef}>
      {orderedPlayers.map((player) => {
        const longestRoad = longestRoadByPlayerId.get(player.id) ?? 0;
        const developmentCardCount = player.isViewer
          ? player.developmentCards.length
          : player.developmentCardCount;
        const victoryPointCardCount = getVictoryPointCardCount(player);
        const points = getDisplayedVictoryPoints(player);
        const isActive = !isFinished && player.id === activePlayerId;
        const isWinner = player.id === winnerPlayerId;
        const knightCount = getPlayedKnightCount(player);
        const holdsLongestRoad = player.id === longestRoadPlayerId;
        const holdsLargestArmy = player.id === largestArmyPlayerId;
        const isAway = offlineSeatIndexes?.has(player.seatIndex) === true;
        const isRoomHost = player.seatIndex === hostSeatIndex;
        const replaceLabel = `Hand ${player.displayName}'s seat to a bot`;
        return (
          <li
            aria-current={isActive ? "true" : undefined}
            className={`game-player player-${getPlayerColor(player)}`}
            data-away={isAway || undefined}
            data-player-id={player.id}
            data-winner={isWinner || undefined}
            key={player.id}
          >
            {isActive || isWinner ? (
              <div className="game-player-ribbon motion-safe:animate-game-pop">
                {isWinner ? "Winner" : "Playing"}
                {isActive && !player.isViewer && lastDiceRoll ? (
                  <DiceRoll className="game-player-dice" roll={lastDiceRoll} />
                ) : null}
              </div>
            ) : null}

            <span className="game-player-portrait">
              <PlayerAvatar
                className="game-player-avatar"
                imageSize={64}
                isBot={player.isBot}
                name={player.displayName}
                src={getPlayerPortraitSrc(player, { botDifficulty, viewerProfileImageUrl })}
              />
              {isRoomHost ? (
                <span className="game-host-crown">
                  <Icon aria-hidden="true" icon={crownIcon} />
                  <span className="sr-only">Host</span>
                </span>
              ) : null}
              {isAway ? <span className="game-away-chip">Away</span> : null}
            </span>

            <div className="game-player-body">
              <div className="game-player-name-row">
                <strong className="game-player-name" title={player.displayName}>
                  {player.displayName}
                </strong>
                {player.isViewer ? <span className="game-you-tag">You</span> : null}
                {isHost && !isFinished && !player.isViewer && !player.isBot ? (
                  <Tooltip label={replaceLabel}>
                    <Button
                      aria-label={replaceLabel}
                      className="game-player-replace"
                      disabled={pendingReplacementId !== null}
                      onClick={() => onReplacePlayer(player.id)}
                      size="game-sm"
                      variant="game-icon"
                    >
                      {pendingReplacementId === player.id ? (
                        <Spinner />
                      ) : (
                        <Icon aria-hidden="true" icon={botIcon} />
                      )}
                    </Button>
                  </Tooltip>
                ) : null}
              </div>
              <ul aria-label="Cards and awards" className="game-player-stats">
                <PlayerStat
                  count={player.resourceCount}
                  image={UNKNOWN_RESOURCE_CARD_ASSET_PATH}
                  label={`${player.resourceCount} resource ${plural(player.resourceCount, "card")}`}
                  shape="card"
                />
                <PlayerStat
                  count={developmentCardCount}
                  image={DEVELOPMENT_CARD_BACK_ASSET_PATH}
                  label={`${developmentCardCount} development ${plural(developmentCardCount, "card")}`}
                  shape="card"
                />
                <PlayerStat
                  count={longestRoad}
                  held={holdsLongestRoad}
                  image={AWARD_ASSET_PATHS.longestRoad}
                  label={
                    holdsLongestRoad
                      ? `Longest Road, ${longestRoad} long (+${LONGEST_ROAD_VICTORY_POINTS} VP)`
                      : `Longest road ${longestRoad}`
                  }
                  shape="award"
                />
                <PlayerStat
                  count={knightCount}
                  held={holdsLargestArmy}
                  image={AWARD_ASSET_PATHS.largestArmy}
                  label={
                    holdsLargestArmy
                      ? `Largest Army, ${knightCount} ${plural(knightCount, "knight")} (+${LARGEST_ARMY_VICTORY_POINTS} VP)`
                      : `${knightCount} ${plural(knightCount, "knight")} played`
                  }
                  shape="award"
                />
              </ul>
            </div>

            <p
              aria-label={
                victoryPointCardCount > 0
                  ? `${points} of ${victoryTarget} victory points, ${victoryPointCardCount} from hidden cards`
                  : `${points} of ${victoryTarget} victory points`
              }
              className="game-player-score"
              role="img"
            >
              <span className="game-vp-medal">{points}</span>
              <span className="game-vp-target">of {victoryTarget}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function PlayerStat({
  count,
  held = false,
  image,
  label,
  shape,
}: {
  count: number;
  held?: boolean;
  image: string;
  label: string;
  /** Cards are drawn upright at card proportions; awards are square badges. */
  shape: "award" | "card";
}) {
  return (
    <li className="game-stat" data-held={held || undefined} data-shape={shape} title={label}>
      <Image alt="" draggable={false} height={shape === "card" ? 48 : 32} src={image} width={32} />
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{label}</span>
    </li>
  );
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
