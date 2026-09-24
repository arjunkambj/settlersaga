import { describe, expect, test } from "bun:test";

import {
  BUILD_COSTS,
  applyCommand,
  assertGameState,
  createDefaultGame,
  getBoardTopology,
  getLongestRoadLength,
  type GameState,
} from "../src/index";
import { reconcileLongestRoadAward } from "../src/longest-road";
import type { BoardState } from "../src/types";
import {
  findRoadPath,
  makePlayers,
  surroundings,
  withBoardPieces,
  withHand,
  type RoadPath,
} from "./helpers";

const PLAYERS = makePlayers(3);
const FIRST_ID = PLAYERS[0]!.id;
const SECOND_ID = PLAYERS[1]!.id;
const THIRD_ID = PLAYERS[2]!.id;

function withRoads(game: GameState, roads: Readonly<Record<string, readonly string[]>>) {
  return reconcileLongestRoadAward({
    ...game,
    board: {
      ...game.board,
      roads: Object.entries(roads).flatMap(([playerId, edgeKeys]) =>
        edgeKeys.map((edgeKey) => ({ edgeKey, playerId })),
      ),
    },
  });
}

describe("longest road length", () => {
  test("counts the longest continuous trail instead of every owned road", () => {
    const game = createDefaultGame(PLAYERS, "longest-road-branch");
    const topology = getBoardTopology(game.board.tiles);
    const branchVertexKey = topology.vertexKeys.find(
      (vertexKey) => topology.vertexEdges[vertexKey]!.length === 3,
    )!;
    const branched = withRoads(game, { [FIRST_ID]: topology.vertexEdges[branchVertexKey]! });

    expect(getLongestRoadLength(branched.board, FIRST_ID)).toBe(2);
    expect(getLongestRoadLength(branched.board, SECOND_ID)).toBe(0);
  });

  test("stops a route at another player's building", () => {
    const game = createDefaultGame(PLAYERS, "longest-road-blocked");
    const road = findRoadPath(getBoardTopology(game.board.tiles), 5);
    const board: BoardState = {
      ...game.board,
      buildings: [{ kind: "settlement", playerId: SECOND_ID, vertexKey: road.vertexKeys[2]! }],
      roads: road.edgeKeys.map((edgeKey) => ({ edgeKey, playerId: FIRST_ID })),
    };

    expect(getLongestRoadLength(board, FIRST_ID)).toBe(3);
  });
});

describe("longest road award", () => {
  test("awards two victory points to the first player with five continuous roads", () => {
    const game = createDefaultGame(PLAYERS, "longest-road-award");
    const road = findRoadPath(getBoardTopology(game.board.tiles), 5);
    const awarded = withRoads(game, { [FIRST_ID]: road.edgeKeys });

    expect(awarded.longestRoadPlayerId).toBe(FIRST_ID);
    expect(awarded.players[0]!.victoryPoints).toBe(2);
  });

  test("removes the award when an opponent settlement breaks the route below five", () => {
    const game = createDefaultGame(PLAYERS, "longest-road-award-blocked");
    const road = findRoadPath(getBoardTopology(game.board.tiles), 5);
    const awarded = withRoads(game, { [FIRST_ID]: road.edgeKeys });
    const blocked = reconcileLongestRoadAward({
      ...awarded,
      board: {
        ...awarded.board,
        buildings: [{ kind: "settlement", playerId: SECOND_ID, vertexKey: road.vertexKeys[2]! }],
      },
    });

    expect(blocked.longestRoadPlayerId).toBeNull();
    expect(blocked.players[0]!.victoryPoints).toBe(0);
  });

  test("keeps the award with its current holder when another player ties its length", () => {
    const game = createDefaultGame(PLAYERS, "longest-road-award-tie");
    const topology = getBoardTopology(game.board.tiles);
    const firstRoad = findRoadPath(topology, 5);
    const secondRoad = findRoadPath(topology, 5, new Set(firstRoad.vertexKeys));
    const awarded = withRoads(game, { [FIRST_ID]: firstRoad.edgeKeys });
    const tied = reconcileLongestRoadAward({
      ...awarded,
      board: {
        ...awarded.board,
        roads: [
          ...awarded.board.roads,
          ...secondRoad.edgeKeys.map((edgeKey) => ({ edgeKey, playerId: SECOND_ID })),
        ],
      },
    });

    expect(tied.longestRoadPlayerId).toBe(FIRST_ID);
    expect(tied.players[0]!.victoryPoints).toBe(2);
    expect(tied.players[1]!.victoryPoints).toBe(0);
  });

  test("the fifth road immediately completes the game when its award reaches the target", () => {
    const game = createDefaultGame(PLAYERS, "longest-road-winning-road", { victoryPoints: 4 });
    const topology = getBoardTopology(game.board.tiles);
    const road = findRoadPath(topology, 5);
    const blocked = surroundings(topology, road.vertexKeys);
    const secondFiller = findRoadPath(topology, 2, blocked);
    const thirdFiller = findRoadPath(
      topology,
      2,
      new Set([...blocked, ...surroundings(topology, secondFiller.vertexKeys)]),
    );
    const ready: GameState = {
      ...withHand(
        withBoardPieces(game, {
          [FIRST_ID]: {
            roads: road.edgeKeys.slice(0, 4),
            settlements: [road.vertexKeys[0]!, road.vertexKeys[4]!],
          },
          [SECOND_ID]: fillerPieces(secondFiller),
          [THIRD_ID]: fillerPieces(thirdFiller),
        }),
        FIRST_ID,
        BUILD_COSTS.road,
      ),
      activePlayerId: FIRST_ID,
      phase: { kind: "build_and_trade" },
      turnNumber: 1,
    };
    assertGameState(ready);

    const completed = applyCommand(ready, FIRST_ID, {
      edgeKey: road.edgeKeys[4]!,
      kind: "place_road",
    });

    expect(completed.longestRoadPlayerId).toBe(FIRST_ID);
    expect(completed.players[0]!.victoryPoints).toBe(4);
    expect(completed.phase.kind).toBe("finished");
    expect(completed.winnerPlayerId).toBe(FIRST_ID);
    assertGameState(completed);
  });
});

function fillerPieces(path: RoadPath) {
  return { roads: path.edgeKeys, settlements: [path.vertexKeys[0]!, path.vertexKeys.at(-1)!] };
}

/**
 * The third player holds Longest Road with a six-road trail. The first player can settle on the
 * trail's middle vertex, cutting it into two three-road halves.
 */
function brokenTrailScenario(seed: string, victoryPoints: number) {
  const game = createDefaultGame(PLAYERS, seed, { victoryPoints });
  const topology = getBoardTopology(game.board.tiles);
  const trail = findRoadPath(
    topology,
    6,
    new Set(),
    ({ vertexKeys }) => topology.vertexEdges[vertexKeys[3]!]!.length === 3,
  );
  const breakVertexKey = trail.vertexKeys[3]!;
  const spurEdgeKey = topology.vertexEdges[breakVertexKey]!.find(
    (edgeKey) => !trail.edgeKeys.includes(edgeKey),
  )!;
  const blocked = surroundings(topology, trail.vertexKeys);

  return { blocked, breakVertexKey, game, spurEdgeKey, topology, trail };
}

describe("longest road changing hands", () => {
  test("a player handed Longest Road on an opponent's turn wins when their turn starts", () => {
    const { blocked, breakVertexKey, game, spurEdgeKey, topology, trail } = brokenTrailScenario(
      "passive-longest-road",
      5,
    );
    const breakerRoad = findRoadPath(topology, 3, blocked);
    const challengerRoad = findRoadPath(
      topology,
      5,
      new Set([...blocked, ...surroundings(topology, breakerRoad.vertexKeys)]),
    );
    const ready: GameState = {
      ...withHand(
        withBoardPieces(game, {
          [FIRST_ID]: {
            roads: [...breakerRoad.edgeKeys.slice(0, 2), spurEdgeKey],
            settlements: [breakerRoad.vertexKeys[0]!, breakerRoad.vertexKeys[2]!],
          },
          [SECOND_ID]: {
            cities: [challengerRoad.vertexKeys[5]!],
            roads: challengerRoad.edgeKeys,
            settlements: [challengerRoad.vertexKeys[0]!],
          },
          [THIRD_ID]: {
            roads: trail.edgeKeys,
            settlements: [trail.vertexKeys[0]!, trail.vertexKeys[6]!],
          },
        }),
        FIRST_ID,
        BUILD_COSTS.settlement,
      ),
      activePlayerId: FIRST_ID,
      phase: { kind: "build_and_trade" },
      turnNumber: 1,
      turnOrder: [FIRST_ID, SECOND_ID, THIRD_ID],
    };
    assertGameState(ready);
    expect(ready.longestRoadPlayerId).toBe(THIRD_ID);

    const broken = applyCommand(ready, FIRST_ID, {
      kind: "place_settlement",
      vertexKey: breakVertexKey,
    });
    assertGameState(broken);
    expect(broken.longestRoadPlayerId).toBe(SECOND_ID);
    expect(broken.players[1]!.victoryPoints).toBe(5);
    expect(broken.phase.kind).toBe("build_and_trade");
    expect(broken.winnerPlayerId).toBeNull();

    const nextTurn = applyCommand(broken, FIRST_ID, { kind: "end_turn" });
    assertGameState(nextTurn);
    expect(nextTurn.activePlayerId).toBe(SECOND_ID);
    expect(nextTurn.phase.kind).toBe("finished");
    expect(nextTurn.winnerPlayerId).toBe(SECOND_ID);
  });

  test("breaking the holder's trail sets the award aside when the others tie", () => {
    const { blocked, breakVertexKey, game, spurEdgeKey, topology, trail } = brokenTrailScenario(
      "longest-road-tie-after-break",
      10,
    );
    const firstRoad = findRoadPath(topology, 5, blocked);
    const secondRoad = findRoadPath(
      topology,
      5,
      new Set([...blocked, ...surroundings(topology, firstRoad.vertexKeys)]),
    );
    const ready: GameState = {
      ...withHand(
        withBoardPieces(game, {
          [FIRST_ID]: {
            roads: [...firstRoad.edgeKeys, spurEdgeKey],
            settlements: [firstRoad.vertexKeys[0]!, firstRoad.vertexKeys[5]!],
          },
          [SECOND_ID]: fillerPieces(secondRoad),
          [THIRD_ID]: fillerPieces(trail),
        }),
        FIRST_ID,
        BUILD_COSTS.settlement,
      ),
      activePlayerId: FIRST_ID,
      phase: { kind: "build_and_trade" },
      turnNumber: 1,
    };
    assertGameState(ready);
    expect(ready.longestRoadPlayerId).toBe(THIRD_ID);

    const broken = applyCommand(ready, FIRST_ID, {
      kind: "place_settlement",
      vertexKey: breakVertexKey,
    });

    expect(broken.longestRoadPlayerId).toBeNull();
    expect(broken.players.map((player) => player.victoryPoints)).toEqual([3, 2, 2]);
    assertGameState(broken);
  });
});
