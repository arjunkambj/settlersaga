import { describe, expect, test } from "bun:test";

import { createDefaultGame, getBoardTopology } from "@settersaga/game";

import { parseGameState, serializeGameState } from "../convex/model/gameState";

const PLAYERS = ["one", "two", "three"].map((id) => ({
  displayName: id,
  id,
  isBot: false,
}));

function serializedGame(): string {
  return JSON.stringify(
    createDefaultGame(PLAYERS, "backend-state-validation", {
      maxPlayers: 3,
      turnTimerSeconds: 0,
    }),
  );
}

describe("stored game-state parsing", () => {
  test("accepts a complete current game state", () => {
    const parsed = parseGameState(serializedGame());
    expect(parsed.version).toBe(4);
    expect(parsed.developmentDeck).toHaveLength(25);
    expect(parsed.longestRoadPlayerId).toBeNull();
    expect(parsed.players.map((player) => player.id)).toEqual(["one", "two", "three"]);
  });

  test("stores only dynamic board state and restores the deterministic board", () => {
    const state = createDefaultGame(PLAYERS, "compact-state-storage", {
      maxPlayers: 3,
      turnTimerSeconds: 0,
    });
    const serialized = serializeGameState(state);
    const stored = JSON.parse(serialized) as {
      state: { board: Record<string, unknown> };
      storageFormat: number;
    };

    expect(stored.storageFormat).toBe(1);
    expect(stored.state.board).toEqual({
      buildings: [],
      roads: [],
      robberTileId: state.board.robberTileId,
    });
    expect(parseGameState(serialized)).toEqual(state);
    expect(serialized.length).toBeLessThan(JSON.stringify(state).length * 0.65);
  });

  test("rejects unknown versions and invalid shapes", () => {
    const unknownVersion = JSON.parse(serializedGame()) as Record<string, unknown>;
    unknownVersion.version = 99;
    expect(() => parseGameState(JSON.stringify(unknownVersion))).toThrow();

    const malformed = createDefaultGame(PLAYERS, "malformed-piece", {
      maxPlayers: 3,
      turnTimerSeconds: 0,
    });
    const vertexKey = getBoardTopology(malformed.board.tiles).vertexKeys[0];
    if (!vertexKey) throw new Error("Test board needs a vertex");
    malformed.board.buildings = [{ kind: "castle" as never, playerId: PLAYERS[0]!.id, vertexKey }];

    const unknownOwner = createDefaultGame(PLAYERS, "unknown-piece-owner", {
      maxPlayers: 3,
      turnTimerSeconds: 0,
    });
    unknownOwner.board.buildings = [{ kind: "settlement", playerId: "missing-player", vertexKey }];

    expect(() => parseGameState(JSON.stringify(malformed))).toThrow();
    expect(() => parseGameState(JSON.stringify(unknownOwner))).toThrow();
    expect(() => serializeGameState(malformed)).toThrow();
  });
});
