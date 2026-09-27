"use client";

import {
  LARGEST_ARMY_MINIMUM_KNIGHTS,
  LARGEST_ARMY_VICTORY_POINTS,
  LONGEST_ROAD_MINIMUM_LENGTH,
  LONGEST_ROAD_VICTORY_POINTS,
  getPlayedKnightCount,
  type BotDifficulty,
  type PlayerGameView,
} from "@settersaga/game";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import crownIcon from "@iconify-icons/solar/crown-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { nameFit } from "@/lib/app/name-fit";
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

import { PlayerAvatar } from "./player-avatar";

/**
 * Who leads on points: the players tied for the most, unless everyone is tied (then nobody leads).
 * Also how far ahead of the next player the lead is.
 */
export function getPointsLead(points: readonly number[]): { leadBy: number; top: number | null } {
  const sorted = [...points].sort((left, right) => right - left);
  const [top = 0, second = 0] = sorted;
  if (sorted.length < 2 || sorted.every((value) => value === top)) {
    return { leadBy: 0, top: null };
  }
  return { leadBy: top - second, top };
}

/**
 * One row per player, in turn order after the viewer: portrait, name with its tags, a quiet line
 * of card and award counts, and points. Every row has the same structure and height whatever it
 * shows (styles/game-hud.css). The player on turn gets a stronger seat tint and a seat-color rim;
 * once the game is won, the winner's row carries a "Winner" pill.
 */
export function PlayerPanel({
  activePlayerId,
  botDifficulty,
  hostSeatIndex = null,
  isHost,
  largestArmyPlayerId,
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
  /** Seat of the room's host, marked with a small crown. */
  hostSeatIndex?: number | null;
  isHost: boolean;
  largestArmyPlayerId: string | null;
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
  const pointsLead = getPointsLead(
    orderedPlayers.map((player) => getDisplayedVictoryPoints(player)),
  );

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
        const replaceLabel = `Let a bot take over ${player.displayName}'s seat`;
        const isLeader = pointsLead.top !== null && points === pointsLead.top;
        const toWin = Math.max(0, victoryTarget - points);
        const standing =
          pointsLead.top === null
            ? "Tied for the lead"
            : isLeader
              ? pointsLead.leadBy > 0
                ? `Leads by ${pointsLead.leadBy}`
                : "Tied for the lead"
              : `${pointsLead.top - points} behind the leader`;
        const scoreLabel = `${points} victory ${plural(points, "point")}${
          victoryPointCardCount > 0 ? `, ${victoryPointCardCount} from secret cards` : ""
        }. ${standing}${isFinished ? "." : `, ${toWin} more to win.`}`;
        return (
          <li
            aria-current={isActive ? "true" : undefined}
            className={`game-player player-${getPlayerColor(player)}`}
            data-away={isAway || undefined}
            data-leader={isLeader || undefined}
            data-player-id={player.id}
            data-winner={isWinner || undefined}
            key={player.id}
          >
            <span className="game-player-portrait">
              <PlayerAvatar
                className="game-player-avatar"
                imageSize={48}
                isBot={player.isBot}
                name={player.displayName}
                src={getPlayerPortraitSrc(player, { botDifficulty, viewerProfileImageUrl })}
              />
            </span>

            <div className="game-player-name-row">
              <strong
                className="game-player-name"
                data-name-fit={nameFit(player.displayName)}
                title={player.displayName}
              >
                {player.displayName}
              </strong>
              {isRoomHost ? (
                <Tooltip label="Host of this game" side="top">
                  <span aria-label="Host" className="game-host-crown" role="img">
                    <Icon aria-hidden="true" icon={crownIcon} />
                  </span>
                </Tooltip>
              ) : null}
              {player.isViewer ? <span className="game-player-flag game-you-tag">You</span> : null}
              {player.isBot ? <span className="game-player-flag">Bot</span> : null}
              {isAway ? (
                <span className="game-player-flag" data-tone="away">
                  Away
                </span>
              ) : null}
              {/* Only for the host, on another human's seat: the bot button hands the seat to a
                  bot. It shows on away seats; on the others it waits behind hover or focus, so it
                  never reads as a bot marker. */}
              {isHost && !isFinished && !player.isViewer && !player.isBot ? (
                <Tooltip label={replaceLabel}>
                  <Button
                    aria-label={replaceLabel}
                    className="game-player-replace"
                    disabled={pendingReplacementId !== null}
                    onClick={() => onReplacePlayer(player.id)}
                    size="game-sm"
                    variant="game-secondary"
                  >
                    {pendingReplacementId === player.id ? (
                      <Spinner />
                    ) : (
                      <Icon aria-hidden="true" icon={botIcon} />
                    )}
                    <span aria-hidden="true" className="game-player-replace-label">
                      Use bot
                    </span>
                  </Button>
                </Tooltip>
              ) : null}
            </div>

            <ul aria-label="Cards and awards" className="game-player-stats">
              <PlayerStat
                count={player.resourceCount}
                image={UNKNOWN_RESOURCE_CARD_ASSET_PATH}
                label={`${player.resourceCount} ${plural(player.resourceCount, "card")} in hand`}
                shape="card"
              />
              <PlayerStat
                count={developmentCardCount}
                image={DEVELOPMENT_CARD_BACK_ASSET_PATH}
                label={`${developmentCardCount} development ${plural(developmentCardCount, "card")}`}
                shape="card"
              />
              <PlayerStat
                award={holdsLongestRoad ? LONGEST_ROAD_VICTORY_POINTS : null}
                count={longestRoad}
                label={
                  holdsLongestRoad
                    ? `Holds Longest Road with a road of ${longestRoad}, worth ${LONGEST_ROAD_VICTORY_POINTS} points`
                    : `Longest road: ${longestRoad}. A road of ${LONGEST_ROAD_MINIMUM_LENGTH} or more can take Longest Road (${LONGEST_ROAD_VICTORY_POINTS} points)`
                }
                shape="award"
                word="Road"
              />
              <PlayerStat
                award={holdsLargestArmy ? LARGEST_ARMY_VICTORY_POINTS : null}
                count={knightCount}
                label={
                  holdsLargestArmy
                    ? `Holds Largest Army with ${knightCount} ${plural(knightCount, "knight")}, worth ${LARGEST_ARMY_VICTORY_POINTS} points`
                    : `${knightCount} ${plural(knightCount, "knight")} played. ${LARGEST_ARMY_MINIMUM_KNIGHTS} or more can take Largest Army (${LARGEST_ARMY_VICTORY_POINTS} points)`
                }
                shape="award"
                word="Army"
              />
            </ul>

            <Tooltip label={scoreLabel} side="left">
              <p aria-label={scoreLabel} className="game-player-score" role="img">
                <span className="game-vp-number">{points}</span>
                <span className="game-vp-label">VP</span>
              </p>
            </Tooltip>

            {isWinner ? <span className="game-player-status">Winner</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A quiet count: cards by their card-back icon, the awards by a short word ("Road 5", "Army 2").
 * An award the player holds turns into a gold chip with its points.
 */
function PlayerStat({
  award = null,
  count,
  image,
  label,
  shape,
  word,
}: {
  /** Points the award is worth, when this player holds it. */
  award?: number | null;
  count: number;
  /** The card-back icon for a card count. */
  image?: string;
  label: string;
  /** Cards are drawn upright at card proportions; awards are named in words. */
  shape: "award" | "card";
  /** The award's short name, shown before its count. */
  word?: string;
}) {
  return (
    <Tooltip label={label} side="top">
      <li className="game-stat" data-held={award !== null || undefined} data-shape={shape}>
        {image ? <Image alt="" draggable={false} height={48} src={image} width={32} /> : null}
        {word ? (
          <span aria-hidden="true" className="game-stat-word">
            {word}
          </span>
        ) : null}
        <span aria-hidden="true">{count}</span>
        {award !== null ? (
          <span aria-hidden="true" className="game-stat-bonus">
            +{award}
          </span>
        ) : null}
        <span className="sr-only">{label}</span>
      </li>
    </Tooltip>
  );
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
