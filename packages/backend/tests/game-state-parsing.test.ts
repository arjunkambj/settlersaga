import { describe, expect, test } from "bun:test";

import {
  createDefaultGame,
  getBoardTopology,
  type DevelopmentCardType,
  type ResourceInventory,
} from "@settersaga/game";

import { parseGameState, serializeGameState } from "../convex/model/gameState";

const PLAYERS = ["one", "two", "three"].map((id) => ({
  displayName: id,
  id,
  isBot: false,
}));

const LEGACY_DEVELOPMENT_DECK: DevelopmentCardType[] = [
  ...Array.from({ length: 13 }, () => "knight" as const),
  ...Array.from({ length: 2 }, () => "monopoly" as const),
  ...Array.from({ length: 2 }, () => "road-building" as const),
  ...Array.from({ length: 5 }, () => "victory-point" as const),
  ...Array.from({ length: 2 }, () => "year-of-plenty" as const),
];

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

  test("upgrades version 3 public counters and played knights", () => {
    const stored = JSON.parse(serializedGame()) as Record<string, unknown> & {
      players: Record<string, unknown>[];
    };
    stored.version = 3;
    delete stored.developmentCardPlayedThisTurn;
    delete stored.developmentCardsBoughtThisTurn;
    delete stored.largestArmyPlayerId;
    for (const player of stored.players) {
      delete player.playedDevelopmentCards;
      player.playedKnights = 0;
    }

    const parsed = parseGameState(JSON.stringify(stored));

    expect(parsed.longestRoadPlayerId).toBeNull();
    expect(parsed.players.every((player) => player.playedDevelopmentCards.length === 0)).toBe(true);
  });

  test("preserves valid version 1 cards without changing conserved resources", () => {
    const oldState = JSON.parse(serializedGame()) as Record<string, unknown> & {
      players: Record<string, unknown>[];
    };
    oldState.version = 1;
    oldState.developmentDeck = LEGACY_DEVELOPMENT_DECK;
    oldState.victoryPoints = 10;
    oldState.players[0]!.developmentCards = ["knight"];
    const resourcesBefore = structuredClone(oldState.players[0]!.resources) as ResourceInventory;
    const bankBefore = structuredClone(oldState.bank) as ResourceInventory;

    const parsed = parseGameState(JSON.stringify(oldState));
    expect(parsed.version).toBe(4);
    expect(parsed.developmentDeck).toEqual(LEGACY_DEVELOPMENT_DECK);
    expect("victoryPoints" in parsed).toBe(false);
    expect(parsed.players[0]!.developmentCards).toEqual(["knight"]);
    expect(parsed.players[0]!.resources).toEqual(resourcesBefore);
    expect(parsed.bank).toEqual(bankBefore);
  });

  test("reconstructs a version 1 deck when only player hands were stored", () => {
    const oldState = JSON.parse(serializedGame()) as Record<string, unknown> & {
      bank: Record<string, number>;
      players: (Record<string, unknown> & { resources: Record<string, number> })[];
    };
    oldState.version = 1;
    delete oldState.developmentDeck;
    oldState.players[0]!.developmentCards = ["knight"];
    oldState.bank.sheep = 0;
    oldState.players[1]!.resources.sheep = 19;

    const parsed = parseGameState(JSON.stringify(oldState));
    expect(parsed.bank.sheep).toBe(0);
    expect(parsed.players[1]!.resources.sheep).toBe(19);
    expect(parsed.players[0]!.developmentCards).toEqual(["knight"]);
    expect(parsed.developmentDeck).toHaveLength(24);
    expect(parsed.developmentDeck.filter((card) => card === "knight")).toHaveLength(13);
  });

  test("gives clean version 2 games a deterministic development deck", () => {
    const oldState = JSON.parse(serializedGame()) as Record<string, unknown> & {
      players: Record<string, unknown>[];
    };
    oldState.version = 2;
    delete oldState.developmentDeck;
    for (const player of oldState.players) {
      delete player.developmentCards;
    }

    const firstParse = parseGameState(JSON.stringify(oldState));
    const secondParse = parseGameState(JSON.stringify(oldState));

    expect(firstParse.version).toBe(4);
    expect(firstParse.developmentDeck).toHaveLength(25);
    expect(firstParse.developmentDeck).toEqual(secondParse.developmentDeck);
    expect(firstParse.players.every((player) => player.developmentCards.length === 0)).toBe(true);
  });

  test("rejects unknown versions and development fields mislabeled as version 2", () => {
    const unknownVersion = JSON.parse(serializedGame()) as Record<string, unknown>;
    unknownVersion.version = 99;

    const mislabeledLegacy = JSON.parse(serializedGame()) as Record<string, unknown> & {
      players: Record<string, unknown>[];
    };
    mislabeledLegacy.version = 2;

    expect(() => parseGameState(JSON.stringify(unknownVersion))).toThrow();
    expect(() => parseGameState(JSON.stringify(mislabeledLegacy))).toThrow();
  });

  test("rejects unknown version 1 cards and invalid deck counts", () => {
    const unknownCard = JSON.parse(serializedGame()) as Record<string, unknown> & {
      players: Record<string, unknown>[];
    };
    unknownCard.version = 1;
    unknownCard.players[0]!.developmentCards = ["unknown-card"];

    const invalidDeck = JSON.parse(serializedGame()) as Record<string, unknown>;
    invalidDeck.version = 1;
    invalidDeck.developmentDeck = [];

    expect(() => parseGameState(JSON.stringify(unknownCard))).toThrow();
    expect(() => parseGameState(JSON.stringify(invalidDeck))).toThrow();
  });

  test("still rejects malformed and unknown-owner board pieces", () => {
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
