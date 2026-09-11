import { describe, expect, test } from "bun:test";

import {
  GameDataValidationError,
  DEVELOPMENT_CARD_DECK,
  applyCommand,
  assertGameState,
  assertPlayerGameView,
  chooseAutomatedCommand,
  createDefaultGame,
  emptyInventory,
  getBoardTopology,
  getRequiredPlayerIds,
  isGameState,
  isPlayerGameView,
  toPlayerView,
  type GameState,
  type ResourceInventory,
} from "../src/index";

const PLAYERS = Array.from({ length: 4 }, (_, index) => ({
  displayName: `Player ${index + 1}`,
  id: `player-${index + 1}`,
  isBot: index !== 0,
}));

function createGame(): GameState {
  return createDefaultGame(PLAYERS, "state-validation", {
    maxPlayers: 4,
    turnTimerSeconds: 0,
  });
}

describe("serialized game-state validation", () => {
  test("accepts canonical game state and every player view", () => {
    const state = createGame();

    expect(isGameState(state)).toBe(true);
    expect(() => assertGameState(state)).not.toThrow();

    for (const player of state.players) {
      const view = toPlayerView(state, player.id);
      expect(isPlayerGameView(view)).toBe(true);
      expect(() => assertPlayerGameView(view)).not.toThrow();
    }
  });

  test("keeps the deck private while exposing the viewer hand and public counts", () => {
    const state = createGame();
    const view = toPlayerView(state, state.players[0]!.id);

    expect(state.players[0]!.developmentCards).toEqual([]);
    expect("developmentDeck" in view).toBe(false);
    expect(view.developmentCardSupply).toBe(DEVELOPMENT_CARD_DECK.length);
    expect(view.players[0]!.isViewer && view.players[0]!.developmentCards).toEqual([]);
    expect(!view.players[1]!.isViewer && view.players[1]!.developmentCardCount).toBe(0);
    expect(!view.players[1]!.isViewer && view.players[1]!.revealedVictoryPointCards).toBeNull();
    expect(view.legalActions.canBuyDevelopmentCard).toBe(false);
  });

  test("reveals opponents' victory point cards only after the game is complete", () => {
    const state = createGame();
    const victoryPointIndex = state.developmentDeck.indexOf("victory-point");
    if (victoryPointIndex < 0) throw new Error("Development deck needs a victory point card");
    const [victoryPointCard] = state.developmentDeck.splice(victoryPointIndex, 1);
    if (!victoryPointCard) throw new Error("Victory point card could not be drawn");
    state.players[1]!.developmentCards.push(victoryPointCard);

    const activeView = toPlayerView(state, state.players[0]!.id);
    expect(
      !activeView.players[1]!.isViewer && activeView.players[1]!.revealedVictoryPointCards,
    ).toBeNull();

    const completedView = toPlayerView(
      {
        ...state,
        phase: { kind: "finished" },
        status: "completed",
        winnerPlayerId: state.players[1]!.id,
      },
      state.players[0]!.id,
    );
    expect(
      !completedView.players[1]!.isViewer && completedView.players[1]!.revealedVictoryPointCards,
    ).toBe(1);
    expect(() => assertPlayerGameView(completedView)).not.toThrow();
  });

  test("exposes played development cards as public conserved history", () => {
    const state = createGame();
    const knightIndex = state.developmentDeck.indexOf("knight");
    if (knightIndex < 0) throw new Error("Development deck needs a knight");

    state.developmentDeck.splice(knightIndex, 1);
    state.players[0]!.playedDevelopmentCards = ["knight"];

    expect(() => assertGameState(state)).not.toThrow();
    const view = toPlayerView(state, state.players[1]!.id);
    expect(view.players[0]!.playedDevelopmentCards).toEqual(["knight"]);
    expect(() => assertPlayerGameView(view)).not.toThrow();
  });

  test("accepts every supported board size", () => {
    for (const [map, playerCount] of [
      ["base", 4],
      ["extended-6", 6],
      ["extended-8", 8],
    ] as const) {
      const players = Array.from({ length: playerCount }, (_, index) => ({
        displayName: `Player ${index + 1}`,
        id: `${map}-player-${index + 1}`,
        isBot: true,
      }));
      const state = createDefaultGame(players, `validation-${map}`, {
        map,
        maxPlayers: playerCount,
      });

      expect(() => assertGameState(state)).not.toThrow();
      expect(() => assertPlayerGameView(toPlayerView(state, players[0]!.id))).not.toThrow();
    }
  });

  test("accepts populated boards and views throughout setup and the first roll", () => {
    let state = createGame();

    while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
      const actorPlayerId = getRequiredPlayerIds(state)[0];
      if (!actorPlayerId) throw new Error("Setup needs an actor");
      state = applyCommand(state, actorPlayerId, chooseAutomatedCommand(state, actorPlayerId));
      assertGameState(state);
      assertPlayerGameView(toPlayerView(state, actorPlayerId));
    }

    const actorPlayerId = getRequiredPlayerIds(state)[0];
    if (!actorPlayerId) throw new Error("The first roll needs an actor");
    state = applyCommand(state, actorPlayerId, { kind: "roll" });
    expect(() => assertGameState(state)).not.toThrow();
    expect(() => assertPlayerGameView(toPlayerView(state, actorPlayerId))).not.toThrow();
  });

  test("rejects malformed, duplicate, unknown-owner, and unknown-vertex buildings", () => {
    const state = createGame();
    const [firstVertexKey, secondVertexKey] = getBoardTopology(state.board.tiles).vertexKeys;
    if (!firstVertexKey || !secondVertexKey) throw new Error("Test board needs two vertices");

    const malformed = structuredClone(state);
    malformed.board.buildings = [
      { kind: "castle" as never, playerId: PLAYERS[0]!.id, vertexKey: firstVertexKey },
    ];

    const duplicate = structuredClone(state);
    duplicate.board.buildings = [
      { kind: "settlement", playerId: PLAYERS[0]!.id, vertexKey: firstVertexKey },
      { kind: "city", playerId: PLAYERS[1]!.id, vertexKey: firstVertexKey },
    ];

    const unknownOwner = structuredClone(state);
    unknownOwner.board.buildings = [
      { kind: "settlement", playerId: "missing-player", vertexKey: secondVertexKey },
    ];

    const unknownVertex = structuredClone(state);
    unknownVertex.board.buildings = [
      {
        kind: "settlement",
        playerId: PLAYERS[0]!.id,
        vertexKey: "vertex:missing",
      },
    ];

    for (const candidate of [malformed, duplicate, unknownOwner, unknownVertex]) {
      expect(isGameState(candidate)).toBe(false);
      expect(() => assertGameState(candidate)).toThrow(GameDataValidationError);
    }
  });

  test("rejects invalid viewer ownership and unknown legal-action locations", () => {
    const state = createGame();
    const view = toPlayerView(state, state.players[0]!.id);

    const wrongViewer = structuredClone(view);
    wrongViewer.viewerPlayerId = "missing-player";

    const unknownRoad = structuredClone(view);
    unknownRoad.legalActions.roadEdgeKeys = ["edge:missing"];

    const leakedResources = structuredClone(view) as typeof view & {
      players: ((typeof view.players)[number] & { resources?: ResourceInventory })[];
    };
    leakedResources.players[1]!.resources = emptyInventory();

    const wrongResourceCount = structuredClone(view);
    wrongResourceCount.players[0]!.resourceCount += 1;

    const wrongDevelopmentSupply = structuredClone(view);
    wrongDevelopmentSupply.developmentCardSupply -= 1;

    const leakedDevelopmentCards = structuredClone(view) as typeof view & {
      players: ((typeof view.players)[number] & { developmentCards?: string[] })[];
    };
    leakedDevelopmentCards.players[1]!.developmentCards = ["knight"];

    expect(isPlayerGameView(wrongViewer)).toBe(false);
    expect(isPlayerGameView(unknownRoad)).toBe(false);
    expect(isPlayerGameView(leakedResources)).toBe(false);
    expect(isPlayerGameView(wrongResourceCount)).toBe(false);
    expect(isPlayerGameView(wrongDevelopmentSupply)).toBe(false);
    expect(isPlayerGameView(leakedDevelopmentCards)).toBe(false);
    expect(() => assertPlayerGameView(wrongViewer)).toThrow(GameDataValidationError);
    expect(() => assertPlayerGameView(unknownRoad)).toThrow(GameDataValidationError);
  });

  test("rejects negative resources and fractional remaining pieces", () => {
    const negativeResource = createGame();
    negativeResource.players[0]!.resources.brick = -1;

    const fractionalPiece = createGame();
    fractionalPiece.players[0]!.piecesRemaining.cities = 1.5;

    expect(isGameState(negativeResource)).toBe(false);
    expect(isGameState(fractionalPiece)).toBe(false);
  });

  test("rejects unknown, missing, or duplicated development cards", () => {
    const unknownCard = createGame();
    unknownCard.developmentDeck[0] = "unknown-card" as never;

    const missingCard = createGame();
    missingCard.developmentDeck.pop();

    const duplicatedCard = createGame();
    const firstCard = duplicatedCard.developmentDeck[0];
    const differentCardIndex = duplicatedCard.developmentDeck.findIndex(
      (card) => card !== firstCard,
    );
    if (!firstCard || differentCardIndex < 0) {
      throw new Error("Development deck needs at least two card types");
    }
    duplicatedCard.developmentDeck[differentCardIndex] = firstCard;

    expect(isGameState(unknownCard)).toBe(false);
    expect(isGameState(missingCard)).toBe(false);
    expect(isGameState(duplicatedCard)).toBe(false);
  });

  test("rejects board pieces, scores, and resources that break conservation", () => {
    const injectedCity = createGame();
    const vertexKey = getBoardTopology(injectedCity.board.tiles).vertexKeys[0];
    if (!vertexKey) throw new Error("Test board needs a vertex");
    injectedCity.board.buildings = [
      { kind: "city", playerId: injectedCity.players[0]!.id, vertexKey },
    ];

    const inventedResource = createGame();
    inventedResource.players[0]!.resources.wheat += 1;

    expect(isGameState(injectedCity)).toBe(false);
    expect(isGameState(inventedResource)).toBe(false);
  });
});
