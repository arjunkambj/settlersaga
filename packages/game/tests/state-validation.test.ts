import { describe, expect, test } from "bun:test";

import {
  AVAILABLE_GAME_MAPS,
  GameDataValidationError,
  applyCommand,
  assertGameState,
  assertPlayerGameView,
  chooseAutomatedCommand,
  emptyInventory,
  getBoardTopology,
  toPlayerView,
  type GamePlayerInput,
  type PlayerGameView,
} from "../src/index";
import {
  createGame,
  createPlayedGame,
  makePlayers,
  opponentsOf,
  withDevelopmentCard,
  withHand,
} from "./helpers";

const PLAYERS = makePlayers(4).map((player, index): GamePlayerInput =>
  index === 0 ? { displayName: player.displayName, id: player.id, isBot: false } : player,
);

function expectInvalidState(state: unknown) {
  expect(() => assertGameState(state)).toThrow(GameDataValidationError);
}

function expectInvalidView(view: unknown) {
  expect(() => assertPlayerGameView(view)).toThrow(GameDataValidationError);
}

describe("serialized game-state validation", () => {
  test("accepts canonical game state and every player view", () => {
    const state = createGame("state-validation", {}, PLAYERS);

    expect(() => assertGameState(state)).not.toThrow();
    for (const player of state.players) {
      expect(() => assertPlayerGameView(toPlayerView(state, player.id))).not.toThrow();
    }
  });

  test("keeps the deck private while exposing the viewer hand and public counts", () => {
    const state = createGame("state-validation", {}, PLAYERS);
    const view = toPlayerView(state, state.players[0]!.id);

    expect("developmentDeck" in view).toBe(false);
    expect(view.developmentCardSupply).toBe(state.developmentDeck.length);
    expect(view.players[0]!.isViewer && view.players[0]!.developmentCards).toEqual([]);
    expect(!view.players[1]!.isViewer && view.players[1]!.developmentCardCount).toBe(0);
    expect(!view.players[1]!.isViewer && view.players[1]!.revealedVictoryPointCards).toBeNull();
    expect(view.legalActions.canBuyDevelopmentCard).toBe(false);
  });

  test("reveals opponents' victory point cards only after the game is complete", () => {
    const state = withDevelopmentCard(
      createGame("state-validation", {}, PLAYERS),
      PLAYERS[1]!.id,
      "victory-point",
    );
    const activeView = toPlayerView(state, state.players[0]!.id);
    expect(
      !activeView.players[1]!.isViewer && activeView.players[1]!.revealedVictoryPointCards,
    ).toBeNull();

    const completedView = toPlayerView(
      { ...state, phase: { kind: "finished" }, winnerPlayerId: state.players[1]!.id },
      state.players[0]!.id,
    );
    expect(
      !completedView.players[1]!.isViewer && completedView.players[1]!.revealedVictoryPointCards,
    ).toBe(1);
    expect(() => assertPlayerGameView(completedView)).not.toThrow();
  });

  test("exposes played development cards as public conserved history", () => {
    const state = createGame("state-validation", {}, PLAYERS);
    state.developmentDeck.splice(state.developmentDeck.indexOf("knight"), 1);
    state.players[0]!.playedDevelopmentCards = ["knight"];

    expect(() => assertGameState(state)).not.toThrow();
    const view = toPlayerView(state, state.players[1]!.id);
    expect(view.players[0]!.playedDevelopmentCards).toEqual(["knight"]);
    expect(() => assertPlayerGameView(view)).not.toThrow();
  });

  test("stocks the bank and deck from each map's definition", () => {
    for (const map of AVAILABLE_GAME_MAPS) {
      const players = makePlayers(map.playerCounts.at(-1)!);
      const state = createGame(`validation-${map.id}`, { map: map.id }, players);
      const deckCounts = Object.fromEntries(
        Object.keys(map.developmentCardCounts).map((card) => [
          card,
          state.developmentDeck.filter((candidate) => candidate === card).length,
        ]),
      );

      expect(Object.values(state.bank)).toEqual(
        Object.values(state.bank).map(() => map.bankResourceCount),
      );
      expect(deckCounts).toEqual(map.developmentCardCounts);
      expect(() => assertGameState(state)).not.toThrow();
      expect(() => assertPlayerGameView(toPlayerView(state, players[0]!.id))).not.toThrow();
    }
  });

  test("accepts populated boards and views throughout setup and the first roll", () => {
    let state = createGame("state-validation", {}, PLAYERS);

    while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
      const actorPlayerId = state.activePlayerId;
      state = applyCommand(state, actorPlayerId, chooseAutomatedCommand(state, actorPlayerId));
      assertGameState(state);
      assertPlayerGameView(toPlayerView(state, actorPlayerId));
    }

    state = applyCommand(state, state.activePlayerId, { kind: "roll" });
    expect(() => assertGameState(state)).not.toThrow();
    expect(() => assertPlayerGameView(toPlayerView(state, state.activePlayerId))).not.toThrow();
  });

  test("rejects malformed, duplicate, unknown-owner, and unknown-vertex buildings", () => {
    const state = createGame("state-validation", {}, PLAYERS);
    const [firstVertexKey, secondVertexKey] = getBoardTopology(state.board.tiles).vertexKeys;
    const withBuildings = (buildings: unknown[]) => ({
      ...state,
      board: { ...state.board, buildings },
    });

    for (const buildings of [
      [{ kind: "castle", playerId: PLAYERS[0]!.id, vertexKey: firstVertexKey }],
      [
        { kind: "settlement", playerId: PLAYERS[0]!.id, vertexKey: firstVertexKey },
        { kind: "city", playerId: PLAYERS[1]!.id, vertexKey: firstVertexKey },
      ],
      [{ kind: "settlement", playerId: "missing-player", vertexKey: secondVertexKey }],
      [{ kind: "settlement", playerId: PLAYERS[0]!.id, vertexKey: "vertex:missing" }],
    ]) {
      expectInvalidState(withBuildings(buildings));
    }
  });

  test("rejects negative resources, fractional pieces, and players without a valid seat type", () => {
    const state = createGame("state-validation", {}, PLAYERS);
    const withPlayer = (index: number, changes: Record<string, unknown>) => ({
      ...state,
      players: state.players.map((player, playerIndex) =>
        playerIndex === index ? { ...player, ...changes } : player,
      ),
    });

    expectInvalidState(withPlayer(0, { resources: { ...emptyInventory(), brick: -1 } }));
    expectInvalidState(
      withPlayer(0, { piecesRemaining: { ...state.players[0]!.piecesRemaining, cities: 1.5 } }),
    );
    expectInvalidState(withPlayer(0, { botDifficulty: "hard" }));
    expectInvalidState(withPlayer(1, { botDifficulty: undefined }));
  });

  test("rejects unknown, missing, or duplicated development cards", () => {
    const state = createGame("state-validation", {}, PLAYERS);
    const firstCard = state.developmentDeck[0]!;
    const differentCardIndex = state.developmentDeck.findIndex((card) => card !== firstCard);

    for (const developmentDeck of [
      ["unknown-card", ...state.developmentDeck.slice(1)],
      state.developmentDeck.slice(1),
      state.developmentDeck.with(differentCardIndex, firstCard),
    ]) {
      expectInvalidState({ ...state, developmentDeck });
    }
  });

  test("rejects board pieces, scores, and resources that break conservation", () => {
    const state = createGame("state-validation", {}, PLAYERS);
    const vertexKey = getBoardTopology(state.board.tiles).vertexKeys[0]!;

    expectInvalidState({
      ...state,
      board: {
        ...state.board,
        buildings: [{ kind: "city", playerId: state.players[0]!.id, vertexKey }],
      },
    });
    expectInvalidState({
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, resources: { ...player.resources, wheat: player.resources.wheat + 1 } }
          : player,
      ),
    });
  });

  test("rejects contradictory phases, offers, dice and settings", () => {
    const played = createPlayedGame("contradictions", {}, PLAYERS);
    const active = played.activePlayerId;
    const opponent = opponentsOf(played, active)[0]!;
    const setup = createGame("contradictions", {}, PLAYERS);
    const offer = {
      acceptedPlayerIds: [],
      give: { ...emptyInventory(), brick: 1 },
      offerActionNumber: played.actionNumber,
      proposerPlayerId: active,
      recipientPlayerIds: [opponent],
      rejectedPlayerIds: [],
      want: { ...emptyInventory(), wheat: 1 },
    };
    const trading = withHand(withHand(played, active, { brick: 1 }), opponent, {});
    const desert = played.board.tiles.find((tile) => tile.terrain === "desert")!;
    const producer = played.board.tiles.find((tile) => tile.numberToken !== null)!;
    const withTile = (tileId: string, numberToken: unknown) => ({
      ...played,
      board: {
        ...played.board,
        tiles: played.board.tiles.map((tile) =>
          tile.id === tileId ? { ...tile, numberToken } : tile,
        ),
      },
    });

    expect(() => assertGameState({ ...trading, tradeOffer: offer })).not.toThrow();
    for (const contradiction of [
      { ...played, winnerPlayerId: active },
      { ...played, phase: { kind: "finished" } },
      { ...setup, phase: { kind: "setup_settlement", setupIndex: 99 } },
      { ...setup, activePlayerId: setup.turnOrder[1] },
      { ...setup, phase: { kind: "roll" } },
      { ...played, phase: { kind: "discard", pending: [{ count: 0, playerId: active }] } },
      { ...played, phase: { kind: "discard", pending: [{ count: 9, playerId: active }] } },
      {
        ...played,
        phase: { eligibleVictimIds: [], kind: "steal", resumePhase: "build_and_trade" },
      },
      {
        ...played,
        phase: { eligibleVictimIds: [active], kind: "steal", resumePhase: "build_and_trade" },
      },
      {
        ...played,
        phase: { kind: "road_building", remainingRoads: 3, resumePhase: "build_and_trade" },
      },
      { ...trading, phase: { kind: "roll" }, tradeOffer: offer },
      { ...trading, tradeOffer: { ...offer, recipientPlayerIds: [active] } },
      { ...trading, tradeOffer: { ...offer, rejectedPlayerIds: [opponent] } },
      { ...trading, tradeOffer: { ...offer, acceptedPlayerIds: [opponent] } },
      { ...trading, tradeOffer: { ...offer, want: offer.give } },
      { ...withHand(trading, active, {}), tradeOffer: offer },
      {
        ...played,
        balancedDiceBag: [
          { first: 6, second: 6, sum: 12 },
          { first: 6, second: 6, sum: 12 },
        ],
      },
      {
        ...played,
        balancedDiceBag: [{ first: 1, second: 2, sum: 3 }],
        settings: { ...played.settings, balancedDice: false },
      },
      { ...played, settings: { ...played.settings, victoryPoints: 1 } },
      { ...played, settings: { ...played.settings, discardLimit: 0 } },
      withTile(producer.id, 7),
      withTile(desert.id, 8),
    ]) {
      expectInvalidState(contradiction);
    }
  });

  test("rejects views that misidentify the viewer or leak private data", () => {
    const state = createPlayedGame("view-privacy", { hideBankCards: true }, PLAYERS);
    const viewer = state.players[0]!.id;
    const view = toPlayerView(state, viewer);
    const opponentIndex = 1;
    const withOpponent = (changes: Record<string, unknown>): unknown => ({
      ...view,
      players: view.players.map((player, index) =>
        index === opponentIndex ? { ...player, ...changes } : player,
      ),
    });
    const leaks: unknown[] = [
      { ...view, viewerPlayerId: "missing-player" },
      withOpponent({ resources: emptyInventory() }),
      withOpponent({ developmentCards: ["knight"] }),
      withOpponent({ revealedVictoryPointCards: 0 }),
      { ...view, bank: state.bank },
      { ...view, developmentDeck: state.developmentDeck },
      {
        ...view,
        players: view.players.map((player): PlayerGameView["players"][number] =>
          player.isViewer ? { ...player, resourceCount: player.resourceCount + 1 } : player,
        ),
      },
    ];

    expect(() => assertPlayerGameView(view)).not.toThrow();
    for (const leak of leaks) {
      expectInvalidView(leak);
    }
  });
});
