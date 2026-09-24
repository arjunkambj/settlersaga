import { describe, expect, test } from "bun:test";

import { createDefaultGame, getBoardTopology } from "@settersaga/game";

import { parseGameState, serializeGameState } from "../convex/model/storage";

const PLAYERS = ["one", "two", "three"].map((id) => ({
  displayName: id,
  id,
  isBot: false as const,
}));

function createGame(seed: string) {
  return createDefaultGame(PLAYERS, seed, { maxPlayers: 3, turnTimerSeconds: 0 });
}

describe("stored game state", () => {
  test("stores only the pieces on the board and restores the generated board", () => {
    const state = createGame("compact-state-storage");
    const serialized = serializeGameState(state);
    const stored = JSON.parse(serialized) as { board: Record<string, unknown> };

    expect(stored.board).toEqual({
      buildings: [],
      roads: [],
      robberTileId: state.board.robberTileId,
    });
    expect(parseGameState(serialized)).toEqual(state);
    expect(serialized.length).toBeLessThan(JSON.stringify(state).length * 0.65);
  });

  test("refuses to store a state that fails validation", () => {
    const state = createGame("malformed-piece");
    const vertexKey = getBoardTopology(state.board.tiles).vertexKeys[0];
    if (!vertexKey) throw new Error("Test board needs a vertex");
    state.board.buildings = [{ kind: "castle" as never, playerId: "one", vertexKey }];

    expect(() => serializeGameState(state)).toThrow();
  });
});
