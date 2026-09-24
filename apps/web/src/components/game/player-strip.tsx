import type { BotDifficulty, PlayerGameView } from "@settersaga/game";
import Image from "next/image";

import {
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import { getPlayerPortraitSrc } from "@/lib/game/hud-portraits";
import { getDisplayedVictoryPoints, getPlayerColor, getPlayerHudOrder } from "@/lib/game/view";

import { PlayerAvatar } from "./player-avatar";

/**
 * The crew at a glance below the rail breakpoint, in the same order as the drawer's plaques:
 * portrait, name and points, with the player whose turn it is raised. The crew column beside
 * the board (lg) also shows card counts; the full plaques live in the table drawer.
 */
export function PlayerStrip({
  activePlayerId,
  botDifficulty,
  offlineSeatIndexes,
  players,
  turnOrder,
  victoryTarget,
  viewerProfileImageUrl,
  winnerPlayerId,
}: {
  activePlayerId: string;
  botDifficulty: BotDifficulty;
  offlineSeatIndexes: ReadonlySet<number>;
  players: PlayerGameView["players"];
  turnOrder: readonly string[];
  victoryTarget: number;
  viewerProfileImageUrl: string | null;
  /** Once someone has won, nobody is on turn any more. */
  winnerPlayerId: string | null;
}) {
  return (
    <ol aria-label="Crew" className="game-player-strip">
      {getPlayerHudOrder(players, turnOrder).map((player) => {
        const theme = getPlayerColor(player);
        const isActive = winnerPlayerId === null && player.id === activePlayerId;
        const isAway = offlineSeatIndexes.has(player.seatIndex);
        const points = getDisplayedVictoryPoints(player);
        const developmentCardCount = player.isViewer
          ? player.developmentCards.length
          : player.developmentCardCount;
        return (
          <li
            aria-current={isActive ? "true" : undefined}
            className={`game-strip-player player-${theme}`}
            data-away={isAway || undefined}
            key={player.id}
          >
            <PlayerAvatar
              className="game-strip-avatar"
              imageSize={48}
              isBot={player.isBot}
              name={player.displayName}
              src={getPlayerPortraitSrc(player, { botDifficulty, viewerProfileImageUrl })}
            />
            <span aria-hidden="true" className="game-strip-name">
              {player.isViewer ? "You" : player.displayName}
            </span>
            <span aria-hidden="true" className="game-strip-stats">
              <StripStat count={player.resourceCount} image={UNKNOWN_RESOURCE_CARD_ASSET_PATH} />
              <StripStat count={developmentCardCount} image={DEVELOPMENT_CARD_BACK_ASSET_PATH} />
            </span>
            <span aria-hidden="true" className="game-strip-points">
              {points}
            </span>
            <span className="sr-only">
              {[
                player.isViewer ? `${player.displayName} (you)` : player.displayName,
                `${points} of ${victoryTarget} victory points`,
                `${player.resourceCount} resource ${player.resourceCount === 1 ? "card" : "cards"}`,
                `${developmentCardCount} development ${developmentCardCount === 1 ? "card" : "cards"}`,
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

function StripStat({ count, image }: { count: number; image: string }) {
  return (
    <span className="game-strip-stat">
      <Image alt="" draggable={false} height={768} sizes="1rem" src={image} width={512} />
      {count}
    </span>
  );
}
