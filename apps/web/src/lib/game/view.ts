import {
  PLAYER_COLORS,
  getLongestRoadLength,
  type PlayerColor,
  type PlayerGameView,
  type PlayerViewState,
  type PrivatePlayerState,
} from "@settersaga/game";

import { nameFit } from "@/lib/app/name-fit";

/** Parsed views are validated to hold exactly one viewer and a known active player. */
export function getViewerAndActivePlayer(game: PlayerGameView): {
  activePlayer: PlayerViewState;
  me: PrivatePlayerState;
} {
  const me = game.players.find((player): player is PrivatePlayerState => player.isViewer);
  const activePlayer = game.players.find((player) => player.id === game.activePlayerId);
  if (!me || !activePlayer) {
    throw new Error("Validated player view is missing the viewer or the active player.");
  }
  return { activePlayer, me };
}

export function getPlayerColor(player: Pick<PlayerViewState, "seatIndex">): PlayerColor {
  return PLAYER_COLORS[player.seatIndex % PLAYER_COLORS.length] ?? PLAYER_COLORS[0];
}

/** Victory point cards are secret until the game ends, except in the viewer's own hand. */
export function getVictoryPointCardCount(player: PlayerViewState): number {
  return player.isViewer
    ? player.developmentCards.filter((card) => card === "victory-point").length
    : (player.revealedVictoryPointCards ?? 0);
}

export function getDisplayedVictoryPoints(player: PlayerViewState): number {
  return player.victoryPoints + getVictoryPointCardCount(player);
}

export function getLongestRoadLengths(game: PlayerGameView): ReadonlyMap<string, number> {
  return new Map(
    game.players.map((player) => [player.id, getLongestRoadLength(game.board, player.id)]),
  );
}

/**
 * The crew as every HUD list shows it: the players who come after the viewer, in turn order, and
 * the viewer last.
 */
export function getPlayerHudOrder<T extends { id: string; isViewer: boolean }>(
  players: readonly T[],
  turnOrder: readonly string[],
): T[] {
  const viewerId = players.find((player) => player.isViewer)?.id;
  const viewerTurn = viewerId === undefined ? -1 : turnOrder.indexOf(viewerId);
  const turnsAfterViewer = (player: T) => {
    const turn = turnOrder.indexOf(player.id);
    return turn < 0
      ? turnOrder.length
      : (turn - viewerTurn - 1 + turnOrder.length) % turnOrder.length;
  };

  return [...players].sort((left, right) => turnsAfterViewer(left) - turnsAfterViewer(right));
}

/**
 * A player's name where the room is short (the turn card's title, a podium plate): short names
 * whole, long ones by their first word, so it reads "Bartholomew" rather than "Bartholomew Lo…".
 * The player rows and the standings carry the full name.
 */
export function getShortPlayerName(displayName: string): string {
  return nameFit(displayName) === undefined
    ? displayName
    : (displayName.trim().split(/\s+/)[0] ?? displayName);
}
