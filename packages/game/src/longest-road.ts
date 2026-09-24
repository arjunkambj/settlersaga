import { getBoardTopology } from "./topology";
import type { BoardState, GameState, PlayerId } from "./types";

export const LONGEST_ROAD_MINIMUM_LENGTH = 5;
export const LONGEST_ROAD_VICTORY_POINTS = 2;

export function getLongestRoadLength(board: BoardState, playerId: PlayerId): number {
  const topology = getBoardTopology(board.tiles);
  const playerRoadEdgeKeys = new Set(
    board.roads.filter((road) => road.playerId === playerId).map((road) => road.edgeKey),
  );

  if (playerRoadEdgeKeys.size === 0) {
    return 0;
  }

  const blockedVertexKeys = new Set(
    board.buildings
      .filter((building) => building.playerId !== playerId)
      .map((building) => building.vertexKey),
  );

  const visit = (vertexKey: string, usedEdgeKeys: Set<string>): number => {
    if (usedEdgeKeys.size > 0 && blockedVertexKeys.has(vertexKey)) {
      return usedEdgeKeys.size;
    }

    let longestLength = usedEdgeKeys.size;

    for (const edgeKey of topology.vertexEdges[vertexKey]!) {
      if (!playerRoadEdgeKeys.has(edgeKey) || usedEdgeKeys.has(edgeKey)) {
        continue;
      }

      const [firstVertexKey, secondVertexKey] = topology.edgeVertices[edgeKey]!;
      const nextVertexKey = firstVertexKey === vertexKey ? secondVertexKey : firstVertexKey;
      usedEdgeKeys.add(edgeKey);
      longestLength = Math.max(longestLength, visit(nextVertexKey, usedEdgeKeys));
      usedEdgeKeys.delete(edgeKey);
    }

    return longestLength;
  };

  const endpointKeys = new Set(
    [...playerRoadEdgeKeys].flatMap((edgeKey) => topology.edgeVertices[edgeKey]!),
  );

  let longestLength = 0;
  for (const vertexKey of endpointKeys) {
    longestLength = Math.max(longestLength, visit(vertexKey, new Set()));
  }

  return longestLength;
}

export function getLongestRoadPlayerId(
  board: BoardState,
  playerIds: readonly PlayerId[],
  currentPlayerId: PlayerId | null,
): PlayerId | null {
  const lengths = playerIds.map((playerId) => ({
    length: getLongestRoadLength(board, playerId),
    playerId,
  }));
  const longestLength = Math.max(0, ...lengths.map(({ length }) => length));

  if (longestLength < LONGEST_ROAD_MINIMUM_LENGTH) {
    return null;
  }

  const leaders = lengths
    .filter(({ length }) => length === longestLength)
    .map(({ playerId }) => playerId);

  if (currentPlayerId && leaders.includes(currentPlayerId)) {
    return currentPlayerId;
  }

  return leaders.length === 1 ? leaders[0]! : null;
}

export function reconcileLongestRoadAward(state: GameState): GameState {
  const longestRoadPlayerId = getLongestRoadPlayerId(
    state.board,
    state.players.map(({ id }) => id),
    state.longestRoadPlayerId,
  );

  if (longestRoadPlayerId === state.longestRoadPlayerId) {
    return state;
  }

  return {
    ...state,
    longestRoadPlayerId,
    players: state.players.map((player) => ({
      ...player,
      victoryPoints:
        player.victoryPoints -
        (player.id === state.longestRoadPlayerId ? LONGEST_ROAD_VICTORY_POINTS : 0) +
        (player.id === longestRoadPlayerId ? LONGEST_ROAD_VICTORY_POINTS : 0),
    })),
  };
}
