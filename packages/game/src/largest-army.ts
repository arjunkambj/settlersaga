import type { GameState, PlayerId, PlayerState } from "./types";

export const LARGEST_ARMY_MINIMUM_KNIGHTS = 3;
export const LARGEST_ARMY_VICTORY_POINTS = 2;

export function getPlayedKnightCount(player: Pick<PlayerState, "playedDevelopmentCards">) {
  return player.playedDevelopmentCards.filter((card) => card === "knight").length;
}

export function getLargestArmyPlayerId(
  players: readonly Pick<PlayerState, "id" | "playedDevelopmentCards" | "seatIndex">[],
  currentHolderId: PlayerId | null,
): PlayerId | null {
  const currentHolder = players.find((player) => player.id === currentHolderId);
  const currentCount = currentHolder ? getPlayedKnightCount(currentHolder) : 0;
  const challenger = [...players]
    .filter((player) => getPlayedKnightCount(player) >= LARGEST_ARMY_MINIMUM_KNIGHTS)
    .sort(
      (first, second) =>
        getPlayedKnightCount(second) - getPlayedKnightCount(first) ||
        first.seatIndex - second.seatIndex,
    )[0];

  if (!challenger) {
    return null;
  }
  if (currentHolder && currentCount >= getPlayedKnightCount(challenger)) {
    return currentHolder.id;
  }
  return challenger.id;
}

export function reconcileLargestArmyAward(state: GameState): GameState {
  const largestArmyPlayerId = getLargestArmyPlayerId(state.players, state.largestArmyPlayerId);
  if (largestArmyPlayerId === state.largestArmyPlayerId) {
    return state;
  }

  return {
    ...state,
    largestArmyPlayerId,
    players: state.players.map((player) => ({
      ...player,
      victoryPoints:
        player.victoryPoints +
        (player.id === largestArmyPlayerId ? LARGEST_ARMY_VICTORY_POINTS : 0) -
        (player.id === state.largestArmyPlayerId ? LARGEST_ARMY_VICTORY_POINTS : 0),
    })),
  };
}
