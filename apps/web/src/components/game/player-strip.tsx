import {
  LARGEST_ARMY_VICTORY_POINTS,
  LONGEST_ROAD_VICTORY_POINTS,
  type BotDifficulty,
  type PlayerGameView,
} from "@settersaga/game";
import Image from "next/image";

import { Tooltip } from "@/components/ui/tooltip";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import {
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import { nameFit } from "@/lib/app/name-fit";
import { getPlayerPortraitSrc } from "@/lib/game/hud-portraits";
import { getDisplayedVictoryPoints, getPlayerColor, getPlayerHudOrder } from "@/lib/game/view";

import { PlayerAvatar } from "./player-avatar";
import { getPointsLead } from "./player-panel";

/**
 * The crew at a glance below the rail breakpoint, in the same order as the drawer's rows:
 * portrait, name and points. The player on turn gets a stronger seat tint and a gold line, as
 * their row in the rail gets its rim. Nothing sits on a portrait: an away player's portrait
 * greys and "Away" follows the name, and where the pills are too narrow for names the viewer's
 * pill says "You" under its points. A held Longest Road or Largest Army shows as a small gold
 * award chip. The leader's points are solid gold and the rest a quiet gold chip, as on the rows.
 * The crew column beside the board (lg) also shows card counts, each with a tooltip; the full
 * rows live in the drawer.
 */
export function PlayerStrip({
  activePlayerId,
  botDifficulty,
  largestArmyPlayerId = null,
  longestRoadPlayerId = null,
  offlineSeatIndexes,
  players,
  turnOrder,
  victoryTarget,
  viewerProfileImageUrl,
  winnerPlayerId,
}: {
  activePlayerId: string;
  botDifficulty: BotDifficulty;
  largestArmyPlayerId?: string | null;
  longestRoadPlayerId?: string | null;
  offlineSeatIndexes: ReadonlySet<number>;
  players: PlayerGameView["players"];
  turnOrder: readonly string[];
  victoryTarget: number;
  viewerProfileImageUrl: string | null;
  /** Once someone has won, nobody is on turn any more. */
  winnerPlayerId: string | null;
}) {
  const orderedPlayers = getPlayerHudOrder(players, turnOrder);
  const pointsLead = getPointsLead(
    orderedPlayers.map((player) => getDisplayedVictoryPoints(player)),
  );
  return (
    <ol aria-label="Crew" className="game-player-strip">
      {orderedPlayers.map((player) => {
        const theme = getPlayerColor(player);
        const isActive = winnerPlayerId === null && player.id === activePlayerId;
        const isAway = offlineSeatIndexes.has(player.seatIndex);
        const points = getDisplayedVictoryPoints(player);
        const developmentCardCount = player.isViewer
          ? player.developmentCards.length
          : player.developmentCardCount;
        const awards = [
          player.id === longestRoadPlayerId
            ? {
                image: AWARD_ASSET_PATHS.longestRoad,
                label: `Holds Longest Road, worth ${LONGEST_ROAD_VICTORY_POINTS} points`,
                name: "Longest Road",
              }
            : null,
          player.id === largestArmyPlayerId
            ? {
                image: AWARD_ASSET_PATHS.largestArmy,
                label: `Holds Largest Army, worth ${LARGEST_ARMY_VICTORY_POINTS} points`,
                name: "Largest Army",
              }
            : null,
        ].filter((award) => award !== null);
        return (
          <li
            aria-current={isActive ? "true" : undefined}
            className={`game-strip-player player-${theme}`}
            data-away={isAway || undefined}
            data-leader={(pointsLead.top !== null && points === pointsLead.top) || undefined}
            data-viewer={player.isViewer || undefined}
            key={player.id}
          >
            <span className="game-strip-portrait">
              <PlayerAvatar
                className="game-strip-avatar"
                imageSize={48}
                isBot={player.isBot}
                name={player.displayName}
                src={getPlayerPortraitSrc(player, { botDifficulty, viewerProfileImageUrl })}
              />
            </span>
            <span aria-hidden="true" className="game-strip-name-row">
              <span
                className="game-strip-name"
                data-name-fit={player.isViewer ? undefined : nameFit(player.displayName)}
              >
                {player.isViewer ? "You" : player.displayName}
              </span>
              {isAway ? <span className="game-strip-away">Away</span> : null}
            </span>
            <span aria-hidden="true" className="game-strip-stats">
              <StripStat
                count={player.resourceCount}
                image={UNKNOWN_RESOURCE_CARD_ASSET_PATH}
                label={`${player.resourceCount} ${player.resourceCount === 1 ? "card" : "cards"} in hand`}
              />
              <StripStat
                count={developmentCardCount}
                image={DEVELOPMENT_CARD_BACK_ASSET_PATH}
                label={`${developmentCardCount} development ${developmentCardCount === 1 ? "card" : "cards"}`}
              />
            </span>
            <span aria-hidden="true" className="game-strip-end">
              <span className="game-strip-points">
                {points}
                <span className="game-strip-vp">VP</span>
              </span>
              {awards.length > 0 || player.isViewer ? (
                <span className="game-strip-extras">
                  {awards.map((award) => (
                    <Tooltip key={award.name} label={award.label} side="bottom">
                      <span className="game-strip-award">
                        <Image
                          alt=""
                          draggable={false}
                          height={32}
                          sizes="1.25rem"
                          src={award.image}
                          width={32}
                        />
                      </span>
                    </Tooltip>
                  ))}
                  {player.isViewer ? <span className="game-strip-you">You</span> : null}
                </span>
              ) : null}
            </span>
            <span className="sr-only">
              {[
                player.isViewer ? `${player.displayName} (you)` : player.displayName,
                `${points} of ${victoryTarget} victory points`,
                `${player.resourceCount} ${player.resourceCount === 1 ? "card" : "cards"} in hand`,
                `${developmentCardCount} development ${developmentCardCount === 1 ? "card" : "cards"}`,
                ...awards.map((award) => `holds ${award.name}`),
                isActive ? "playing now" : null,
                isAway ? "away" : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A card count, named by a tooltip (the row's sr-only line reads it to screen readers). */
function StripStat({ count, image, label }: { count: number; image: string; label: string }) {
  return (
    <Tooltip label={label} side="left">
      <span className="game-strip-stat">
        <Image alt="" draggable={false} height={768} sizes="1rem" src={image} width={512} />
        {count}
      </span>
    </Tooltip>
  );
}
