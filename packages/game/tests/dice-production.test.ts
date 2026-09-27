import { describe, expect, test } from "bun:test";

import {
  applyCommand,
  emptyInventory,
  getBoardTopology,
  getDiceProduction,
  type GameState,
  type ResourceInventory,
} from "../src/index";
import { subtractResources } from "../src/resources";
import type { BuildingState, TileState } from "../src/types";
import { createPlayedGame, playerById, withBoardPieces, withNextRoll } from "./helpers";

const ROLL = 6;
const FULL_BANK: ResourceInventory = { brick: 19, sheep: 19, stone: 19, tree: 19, wheat: 19 };

/**
 * A board whose first two tiles are forests showing a 6 and every other tile is a quiet desert,
 * with the robber on the last tile.
 */
function forestBoard(buildings: BuildingState[]): GameState["board"] {
  const board = createPlayedGame("dice-production").board;
  const tiles = board.tiles.map(
    (tile, index): TileState =>
      index < 2
        ? { ...tile, numberToken: ROLL, terrain: "forest" }
        : { ...tile, numberToken: null, terrain: "desert" },
  );
  return { ...board, buildings, robberTileId: tiles.at(-1)!.id, tiles };
}

/** The corners of one forest that the other forest does not share, so they pay only there. */
function cornersOf(board: GameState["board"], tileIndex: 0 | 1): string[] {
  const topology = getBoardTopology(board.tiles);
  const otherCorners = topology.tileById[board.tiles[1 - tileIndex]!.id]!.vertexKeys;
  return topology.tileById[board.tiles[tileIndex]!.id]!.vertexKeys.filter(
    (vertexKey) => !otherCorners.includes(vertexKey),
  );
}

describe("dice production", () => {
  test("a settlement takes one card and a city two, and both match the roll's payout", () => {
    const empty = forestBoard([]);
    const [first, , third] = cornersOf(empty, 0);
    const board = forestBoard([
      { kind: "settlement", playerId: "player-1", vertexKey: first! },
      { kind: "city", playerId: "player-2", vertexKey: third! },
    ]);

    expect(getDiceProduction(board, ROLL, FULL_BANK)).toEqual([
      { amount: 1, playerId: "player-1", resource: "tree", tileId: board.tiles[0]!.id },
      { amount: 2, playerId: "player-2", resource: "tree", tileId: board.tiles[0]!.id },
    ]);
    expect(getDiceProduction(board, ROLL + 2, FULL_BANK)).toEqual([]);

    // The rules pay exactly what the helper reports.
    const played = createPlayedGame("dice-production");
    const state = withBoardPieces(
      { ...played, board: { ...board, ports: played.board.ports, roads: [] } },
      { "player-1": { settlements: [first!] }, "player-2": { cities: [third!] } },
    );
    const rolled = applyCommand(withNextRoll(state, ROLL), state.activePlayerId, { kind: "roll" });
    const gained = (playerId: string) =>
      subtractResources(
        playerById(rolled, playerId).resources,
        playerById(state, playerId).resources,
      );
    expect(gained("player-1")).toEqual({ ...emptyInventory(), tree: 1 });
    expect(gained("player-2")).toEqual({ ...emptyInventory(), tree: 2 });
  });

  test("the robber's tile pays nobody", () => {
    const [corner] = cornersOf(forestBoard([]), 0);
    const board = forestBoard([{ kind: "city", playerId: "player-1", vertexKey: corner! }]);

    expect(getDiceProduction(board, ROLL, FULL_BANK)).toHaveLength(1);
    expect(
      getDiceProduction({ ...board, robberTileId: board.tiles[0]!.id }, ROLL, FULL_BANK),
    ).toEqual([]);
  });

  test("a short bank pays nobody when several players are owed the resource", () => {
    const [first, , third] = cornersOf(forestBoard([]), 0);
    const board = forestBoard([
      { kind: "city", playerId: "player-1", vertexKey: first! },
      { kind: "settlement", playerId: "player-2", vertexKey: third! },
    ]);

    expect(getDiceProduction(board, ROLL, { ...FULL_BANK, tree: 3 })).toHaveLength(2);
    expect(getDiceProduction(board, ROLL, { ...FULL_BANK, tree: 2 })).toEqual([]);
  });

  test("a lone claimant takes what the bank has left, from their first tiles on", () => {
    const empty = forestBoard([]);
    const board = forestBoard([
      { kind: "settlement", playerId: "player-3", vertexKey: cornersOf(empty, 0)[0]! },
      { kind: "city", playerId: "player-3", vertexKey: cornersOf(empty, 1)[0]! },
    ]);

    expect(getDiceProduction(board, ROLL, { ...FULL_BANK, tree: 2 })).toEqual([
      { amount: 1, playerId: "player-3", resource: "tree", tileId: board.tiles[0]!.id },
      { amount: 1, playerId: "player-3", resource: "tree", tileId: board.tiles[1]!.id },
    ]);
    expect(getDiceProduction(board, ROLL, { ...FULL_BANK, tree: 1 })).toEqual([
      { amount: 1, playerId: "player-3", resource: "tree", tileId: board.tiles[0]!.id },
    ]);
    expect(getDiceProduction(board, ROLL, { ...FULL_BANK, tree: 0 })).toEqual([]);
  });
});
