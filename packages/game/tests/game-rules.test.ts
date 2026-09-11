import { describe, expect, test } from "bun:test";

import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  DEVELOPMENT_CARD_DECK,
  GameRuleError,
  RESOURCE_TYPES,
  SUPERHERO_BOT_NAMES,
  applyCommand,
  assertGameState,
  chooseAutomatedCommand,
  createDefaultGame,
  distributeResourcesForRoll,
  emptyInventory,
  getBoardTopology,
  getLegalActions,
  getRequiredPlayerIds,
  mapSupportsPlayerCount,
  toPlayerView,
  type DevelopmentCardType,
  type GameState,
  type ResourceInventory,
} from "../src/index";

const PLAYERS = Array.from({ length: 4 }, (_, index) => ({
  botDifficulty: "hard" as const,
  displayName: SUPERHERO_BOT_NAMES[index]!,
  id: `player-${index + 1}`,
  isBot: true,
}));

function createGame(seed: string) {
  return createDefaultGame(PLAYERS, seed, {
    maxPlayers: 4,
    turnTimerSeconds: 0,
    victoryPoints: 10,
  });
}

function cityReadyState(ownerId = PLAYERS[0]!.id): { state: GameState; vertexKey: string } {
  const state = createGame("city-upgrade");
  const vertexKey = getBoardTopology(state.board.tiles).vertexKeys[0]!;
  const resources = { ...BUILD_COSTS.city };

  return {
    state: {
      ...state,
      activePlayerId: PLAYERS[0]!.id,
      bank: RESOURCE_TYPES.reduce<ResourceInventory>(
        (bank, resource) => {
          bank[resource] -= resources[resource];
          return bank;
        },
        { ...state.bank },
      ),
      board: {
        ...state.board,
        buildings: [{ kind: "settlement", playerId: ownerId, vertexKey }],
      },
      phase: { kind: "build_and_trade" },
      players: state.players.map((player) =>
        player.id === PLAYERS[0]!.id
          ? {
              ...player,
              piecesRemaining: { ...player.piecesRemaining, settlements: 4 },
              resources,
              victoryPoints: ownerId === player.id ? 1 : 0,
            }
          : player.id === ownerId
            ? {
                ...player,
                piecesRemaining: { ...player.piecesRemaining, settlements: 4 },
                victoryPoints: 1,
              }
            : player,
      ),
      turnNumber: 1,
    },
    vertexKey,
  };
}

function developmentCardReadyState(seed = "development-card-purchase"): GameState {
  const state = createGame(seed);
  return {
    ...state,
    activePlayerId: PLAYERS[0]!.id,
    bank: RESOURCE_TYPES.reduce<ResourceInventory>(
      (bank, resource) => {
        bank[resource] -= DEVELOPMENT_CARD_COST[resource];
        return bank;
      },
      { ...state.bank },
    ),
    phase: { kind: "build_and_trade" },
    players: state.players.map((player) =>
      player.id === PLAYERS[0]!.id
        ? { ...player, resources: { ...DEVELOPMENT_CARD_COST } }
        : player,
    ),
    turnNumber: 1,
  };
}

function giveDevelopmentCard(
  state: GameState,
  playerId: string,
  card: DevelopmentCardType,
): GameState {
  const developmentDeck = [...state.developmentDeck];
  const cardIndex = developmentDeck.indexOf(card);
  if (cardIndex < 0) throw new Error(`Development deck needs a ${card} card`);
  developmentDeck.splice(cardIndex, 1);

  return {
    ...state,
    developmentDeck,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, developmentCards: [...player.developmentCards, card] }
        : player,
    ),
  };
}

function expectRuleError(action: () => unknown, code: GameRuleError["code"]) {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(GameRuleError);
    expect((error as GameRuleError).code).toBe(code);
  }
}

function expectConservedState(state: GameState) {
  const occupiedVertices = new Set<string>();
  for (const building of state.board.buildings) {
    expect(occupiedVertices.has(building.vertexKey)).toBe(false);
    occupiedVertices.add(building.vertexKey);
  }

  const occupiedEdges = new Set<string>();
  for (const road of state.board.roads) {
    expect(occupiedEdges.has(road.edgeKey)).toBe(false);
    occupiedEdges.add(road.edgeKey);
  }

  for (const player of state.players) {
    const buildings = state.board.buildings.filter((building) => building.playerId === player.id);
    const settlementCount = buildings.filter((building) => building.kind === "settlement").length;
    const cityCount = buildings.filter((building) => building.kind === "city").length;
    const roadCount = state.board.roads.filter((road) => road.playerId === player.id).length;

    expect(player.piecesRemaining.settlements + settlementCount).toBe(5);
    expect(player.piecesRemaining.cities + cityCount).toBe(4);
    expect(player.piecesRemaining.roads + roadCount).toBe(15);
    expect(player.victoryPoints).toBe(
      settlementCount +
        cityCount * 2 +
        (state.largestArmyPlayerId === player.id ? 2 : 0) +
        (state.longestRoadPlayerId === player.id ? 2 : 0),
    );
  }

  for (const resource of RESOURCE_TYPES) {
    const playerCards = state.players.reduce(
      (total, player) => total + player.resources[resource],
      0,
    );
    expect(state.bank[resource] + playerCards).toBe(19);
  }

  expect(
    [
      ...state.developmentDeck,
      ...state.players.flatMap((player) => player.developmentCards),
      ...state.players.flatMap((player) => player.playedDevelopmentCards),
    ].toSorted(),
  ).toEqual([...DEVELOPMENT_CARD_DECK].toSorted());
}

describe("opening setup", () => {
  test("does not allow a roll while any player is missing opening placements", () => {
    const created = createGame("incomplete-opening-roll");
    const firstPlayerId = created.activePlayerId;
    const settlementVertexKey = getLegalActions(created, firstPlayerId).settlementVertexKeys[0];
    if (!settlementVertexKey) throw new Error("Opening setup needs a settlement location");

    const withSettlement = applyCommand(created, firstPlayerId, {
      kind: "place_settlement",
      vertexKey: settlementVertexKey,
    });
    const roadEdgeKey = getLegalActions(withSettlement, firstPlayerId).roadEdgeKeys[0];
    if (!roadEdgeKey) throw new Error("Opening setup needs a road location");

    const partialSetup = applyCommand(withSettlement, firstPlayerId, {
      edgeKey: roadEdgeKey,
      kind: "place_road",
    });
    const inconsistentRollState: GameState = {
      ...partialSetup,
      activePlayerId: firstPlayerId,
      phase: { kind: "roll" },
    };

    expect(getLegalActions(inconsistentRollState, firstPlayerId).canRoll).toBe(false);
    expectRuleError(
      () => applyCommand(inconsistentRollState, firstPlayerId, { kind: "roll" }),
      "INVALID_PHASE",
    );
  });

  test("allows the first roll only after every player completes opening setup", () => {
    let state = createGame("complete-opening-roll");

    while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
      const actorPlayerId = getRequiredPlayerIds(state)[0];
      if (!actorPlayerId) throw new Error("Opening setup needs an actor");
      state = applyCommand(state, actorPlayerId, chooseAutomatedCommand(state, actorPlayerId));
    }

    for (const player of state.players) {
      expect(
        state.board.buildings.filter((building) => building.playerId === player.id),
      ).toHaveLength(2);
      expect(state.board.roads.filter((road) => road.playerId === player.id)).toHaveLength(2);
    }
    expect(state.phase.kind).toBe("roll");
    expect(getLegalActions(state, state.activePlayerId).canRoll).toBe(true);
  });
});

describe("city upgrades", () => {
  test("a bot upgrades only its persisted settlement and pays the full cost", () => {
    const { state, vertexKey } = cityReadyState();

    expect(chooseAutomatedCommand(state, PLAYERS[0]!.id)).toEqual({
      kind: "build_city",
      vertexKey,
    });

    const next = applyCommand(state, PLAYERS[0]!.id, { kind: "build_city", vertexKey });
    const player = next.players[0]!;

    expect(next.board.buildings).toEqual([{ kind: "city", playerId: PLAYERS[0]!.id, vertexKey }]);
    expect(player.resources).toEqual(emptyInventory());
    expect(player.piecesRemaining).toEqual({ cities: 3, roads: 15, settlements: 5 });
    expect(player.victoryPoints).toBe(2);
    expectConservedState(next);
  });

  test("an empty vertex or an opponent settlement cannot become a city", () => {
    const empty = cityReadyState();
    empty.state.board.buildings = [];
    empty.state.players[0]!.piecesRemaining.settlements = 5;
    empty.state.players[0]!.victoryPoints = 0;

    expectRuleError(
      () =>
        applyCommand(empty.state, PLAYERS[0]!.id, {
          kind: "build_city",
          vertexKey: empty.vertexKey,
        }),
      "INVALID_LOCATION",
    );

    const opponent = cityReadyState(PLAYERS[1]!.id);
    expectRuleError(
      () =>
        applyCommand(opponent.state, PLAYERS[0]!.id, {
          kind: "build_city",
          vertexKey: opponent.vertexKey,
        }),
      "INVALID_LOCATION",
    );
  });
});

describe("development card purchases", () => {
  test("draws the deterministic top card, pays the bank, and updates legal actions", () => {
    const state = developmentCardReadyState();
    const playerId = PLAYERS[0]!.id;
    const topCard = state.developmentDeck[0];
    if (!topCard) throw new Error("Development deck must not be empty");

    expect(getLegalActions(state, playerId).canBuyDevelopmentCard).toBe(true);
    const next = applyCommand(state, playerId, { kind: "buy_development_card" });

    expect(next.developmentDeck).toEqual(state.developmentDeck.slice(1));
    expect(next.players[0]!.developmentCards).toEqual([topCard]);
    expect(next.players[0]!.resources).toEqual(emptyInventory());
    expect(next.bank).toEqual(createGame("development-card-purchase").bank);
    expect(getLegalActions(next, playerId).canBuyDevelopmentCard).toBe(false);
    const buyerView = toPlayerView(next, playerId);
    const opponentView = toPlayerView(next, PLAYERS[1]!.id);
    expect(buyerView.developmentCardSupply).toBe(24);
    expect(buyerView.players[0]!.isViewer && buyerView.players[0]!.developmentCards).toEqual([
      topCard,
    ]);
    expect(
      !opponentView.players[0]!.isViewer && opponentView.players[0]!.developmentCardCount,
    ).toBe(1);
    expect("developmentCards" in opponentView.players[0]!).toBe(false);
    expectConservedState(next);
  });

  test("rejects an unaffordable purchase, an empty supply, and the wrong phase", () => {
    const ready = developmentCardReadyState();
    const playerId = PLAYERS[0]!.id;
    const unaffordable: GameState = {
      ...ready,
      bank: { ...ready.bank, sheep: ready.bank.sheep + 1 },
      players: ready.players.map((player) =>
        player.id === playerId
          ? { ...player, resources: { ...player.resources, sheep: 0 } }
          : player,
      ),
    };
    const emptySupply: GameState = { ...ready, developmentDeck: [] };
    const wrongPhase: GameState = { ...ready, phase: { kind: "roll" } };

    expect(getLegalActions(unaffordable, playerId).canBuyDevelopmentCard).toBe(false);
    expect(getLegalActions(emptySupply, playerId).canBuyDevelopmentCard).toBe(false);
    expectRuleError(
      () => applyCommand(unaffordable, playerId, { kind: "buy_development_card" }),
      "INSUFFICIENT_RESOURCES",
    );
    expectRuleError(
      () => applyCommand(emptySupply, playerId, { kind: "buy_development_card" }),
      "NO_DEVELOPMENT_CARD_AVAILABLE",
    );
    expectRuleError(
      () => applyCommand(wrongPhase, playerId, { kind: "buy_development_card" }),
      "INVALID_PHASE",
    );
  });

  test("counts a drawn victory-point card without exposing it as building score", () => {
    const ready = developmentCardReadyState("development-card-victory");
    const playerId = PLAYERS[0]!.id;
    const vertexKeys = getBoardTopology(ready.board.tiles).vertexKeys.slice(0, 2);
    if (vertexKeys.length !== 2) throw new Error("Test board needs two vertices");
    const developmentDeck = [...ready.developmentDeck];
    const victoryPointIndex = developmentDeck.indexOf("victory-point");
    if (victoryPointIndex < 0) throw new Error("Development deck needs a victory-point card");
    [developmentDeck[0], developmentDeck[victoryPointIndex]] = [
      developmentDeck[victoryPointIndex]!,
      developmentDeck[0]!,
    ];
    const state: GameState = {
      ...ready,
      board: {
        ...ready.board,
        buildings: vertexKeys.map((vertexKey) => ({
          kind: "settlement" as const,
          playerId,
          vertexKey,
        })),
      },
      developmentDeck,
      players: ready.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              piecesRemaining: { ...player.piecesRemaining, settlements: 3 },
              victoryPoints: 2,
            }
          : player,
      ),
      settings: { ...ready.settings, victoryPoints: 3 },
    };
    assertGameState(state);

    const next = applyCommand(state, playerId, { kind: "buy_development_card" });

    expect(next.players[0]!.victoryPoints).toBe(2);
    expect(next.players[0]!.developmentCards).toEqual(["victory-point"]);
    expect(next.status).toBe("completed");
    expect(next.phase.kind).toBe("finished");
    expect(next.winnerPlayerId).toBe(playerId);
    assertGameState(next);
  });
});

describe("development card plays", () => {
  test("plays a Knight before rolling and awards Largest Army at three knights", () => {
    const playerId = PLAYERS[0]!.id;
    let state = createGame("play-knight");
    state = giveDevelopmentCard(state, playerId, "knight");
    for (let count = 0; count < 2; count += 1) {
      const knightIndex = state.developmentDeck.indexOf("knight");
      if (knightIndex < 0) throw new Error("Development deck needs another Knight");
      state.developmentDeck.splice(knightIndex, 1);
    }
    state = {
      ...state,
      phase: { kind: "roll" },
      players: state.players.map((player) =>
        player.id === playerId
          ? { ...player, playedDevelopmentCards: ["knight", "knight"] }
          : player,
      ),
      turnNumber: 1,
    };

    expect(getLegalActions(state, playerId).playableDevelopmentCards).toContain("knight");
    const next = applyCommand(state, playerId, { kind: "play_knight" });

    expect(next.phase).toEqual({
      kind: "move_robber",
      resumePhase: "roll",
      rollerPlayerId: playerId,
    });
    expect(next.players[0]!.developmentCards).toEqual([]);
    expect(next.players[0]!.playedDevelopmentCards).toEqual(["knight", "knight", "knight"]);
    expect(next.largestArmyPlayerId).toBe(playerId);
    expect(next.players[0]!.victoryPoints).toBe(2);
    expectConservedState(next);
    assertGameState(next);
  });

  test("Monopoly collects the named resource from every opponent", () => {
    const playerId = PLAYERS[0]!.id;
    let state = giveDevelopmentCard(createGame("play-monopoly"), playerId, "monopoly");
    state = {
      ...state,
      bank: { ...state.bank, brick: state.bank.brick - 3 },
      phase: { kind: "build_and_trade" },
      players: state.players.map((player) =>
        player.id === PLAYERS[1]!.id
          ? { ...player, resources: { ...player.resources, brick: 2 } }
          : player.id === PLAYERS[2]!.id
            ? { ...player, resources: { ...player.resources, brick: 1 } }
            : player,
      ),
      turnNumber: 1,
    };

    const next = applyCommand(state, playerId, {
      kind: "play_monopoly",
      resource: "brick",
    });

    expect(next.players[0]!.resources.brick).toBe(3);
    expect(next.players.slice(1).every((player) => player.resources.brick === 0)).toBe(true);
    expect(next.players[0]!.playedDevelopmentCards).toEqual(["monopoly"]);
    expect(next.phase.kind).toBe("build_and_trade");
    expectConservedState(next);
  });

  test("Year of Plenty takes exactly two selected cards from the bank", () => {
    const playerId = PLAYERS[0]!.id;
    const state = {
      ...giveDevelopmentCard(createGame("play-year-of-plenty"), playerId, "year-of-plenty"),
      phase: { kind: "roll" as const },
      turnNumber: 1,
    };
    const resources = { ...emptyInventory(), brick: 1, wheat: 1 };
    const next = applyCommand(state, playerId, {
      kind: "play_year_of_plenty",
      resources,
    });

    expect(next.players[0]!.resources).toEqual(resources);
    expect(next.bank.brick).toBe(state.bank.brick - 1);
    expect(next.bank.wheat).toBe(state.bank.wheat - 1);
    expect(next.phase.kind).toBe("roll");
    expectConservedState(next);
    expectRuleError(
      () =>
        applyCommand(
          giveDevelopmentCard(
            { ...createGame("invalid-year-of-plenty"), phase: { kind: "roll" } },
            playerId,
            "year-of-plenty",
          ),
          playerId,
          {
            kind: "play_year_of_plenty",
            resources: { ...emptyInventory(), wheat: 1 },
          },
        ),
      "INVALID_COMMAND",
    );
  });

  test("Road Building places two connected roads for free and resumes the prior phase", () => {
    const playerId = PLAYERS[0]!.id;
    let state = createGame("play-road-building");
    while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
      const actorPlayerId = getRequiredPlayerIds(state)[0];
      if (!actorPlayerId) throw new Error("Setup needs an actor");
      state = applyCommand(state, actorPlayerId, chooseAutomatedCommand(state, actorPlayerId));
    }
    state = giveDevelopmentCard(state, playerId, "road-building");
    const resourcesBefore = { ...state.players[0]!.resources };
    const roadsBefore = state.board.roads.length;

    state = applyCommand(state, playerId, { kind: "play_road_building" });
    expect(state.phase).toEqual({
      kind: "road_building",
      remainingRoads: 2,
      resumePhase: "roll",
    });

    for (let count = 0; count < 2; count += 1) {
      const edgeKey = getLegalActions(state, playerId).roadEdgeKeys[0];
      if (!edgeKey) throw new Error("Road Building needs a legal road");
      state = applyCommand(state, playerId, { edgeKey, kind: "place_road" });
    }

    expect(state.phase.kind).toBe("roll");
    expect(state.board.roads).toHaveLength(roadsBefore + 2);
    expect(state.players[0]!.resources).toEqual(resourcesBefore);
    expect(state.players[0]!.playedDevelopmentCards).toEqual(["road-building"]);
    expectConservedState(state);
  });

  test("blocks a card bought this turn and a second card in the same turn", () => {
    const playerId = PLAYERS[0]!.id;
    const boughtThisTurn = {
      ...giveDevelopmentCard(createGame("new-development-card"), playerId, "monopoly"),
      developmentCardsBoughtThisTurn: 1,
      phase: { kind: "roll" as const },
      turnNumber: 1,
    };
    expect(getLegalActions(boughtThisTurn, playerId).playableDevelopmentCards).toEqual([]);
    expectRuleError(
      () =>
        applyCommand(boughtThisTurn, playerId, {
          kind: "play_monopoly",
          resource: "brick",
        }),
      "DEVELOPMENT_CARD_NOT_PLAYABLE",
    );

    const alreadyPlayed = {
      ...boughtThisTurn,
      developmentCardPlayedThisTurn: true,
      developmentCardsBoughtThisTurn: 0,
    };
    expect(getLegalActions(alreadyPlayed, playerId).playableDevelopmentCards).toEqual([]);
    expectRuleError(
      () =>
        applyCommand(alreadyPlayed, playerId, {
          kind: "play_monopoly",
          resource: "brick",
        }),
      "DEVELOPMENT_CARD_NOT_PLAYABLE",
    );

    const ended = applyCommand({ ...alreadyPlayed, phase: { kind: "build_and_trade" } }, playerId, {
      kind: "end_turn",
    });
    expect(ended.developmentCardPlayedThisTurn).toBe(false);
    expect(ended.developmentCardsBoughtThisTurn).toBe(0);
  });
});

describe("trade offers", () => {
  test("spending offered resources cancels the offer and stale bots reject it", () => {
    const cityReady = cityReadyState();
    const state: GameState = {
      ...cityReady.state,
      bank: { ...cityReady.state.bank, brick: cityReady.state.bank.brick - 1 },
      players: cityReady.state.players.map((player) =>
        player.id === PLAYERS[1]!.id
          ? { ...player, resources: { ...player.resources, brick: 1 } }
          : player,
      ),
    };
    const proposed = applyCommand(state, PLAYERS[0]!.id, {
      give: { brick: 0, sheep: 0, stone: 1, tree: 0, wheat: 0 },
      kind: "propose_trade",
      recipientPlayerIds: [PLAYERS[1]!.id],
      want: { brick: 1, sheep: 0, stone: 0, tree: 0, wheat: 0 },
    });
    const stale = {
      ...proposed,
      players: proposed.players.map((player) =>
        player.id === PLAYERS[0]!.id
          ? { ...player, resources: { ...player.resources, stone: 0 } }
          : player,
      ),
    };
    const offerActionNumber = proposed.tradeOffer?.offerActionNumber;
    if (offerActionNumber === undefined) throw new Error("Trade offer needs an action number");

    expect(chooseAutomatedCommand(stale, PLAYERS[1]!.id)).toEqual({
      accept: false,
      kind: "respond_trade",
      offerActionNumber,
    });

    const next = applyCommand(proposed, PLAYERS[0]!.id, {
      kind: "build_city",
      vertexKey: cityReady.vertexKey,
    });
    expect(next.tradeOffer).toBeNull();
    expectConservedState(next);
  });
});

describe("friendly robber", () => {
  test("is opt-in so standard games can target player-adjacent tiles", () => {
    const created = createGame("standard-robber");
    const tile = created.board.tiles.find(
      (candidate) => candidate.id !== created.board.robberTileId,
    );
    const vertexKey = tile
      ? getBoardTopology(created.board.tiles).tileById[tile.id]?.vertexKeys[0]
      : undefined;
    if (!tile || !vertexKey) throw new Error("Robber test needs another occupied tile");
    const state: GameState = {
      ...created,
      board: {
        ...created.board,
        buildings: [{ kind: "settlement", playerId: PLAYERS[1]!.id, vertexKey }],
      },
      phase: {
        kind: "move_robber",
        resumePhase: "build_and_trade",
        rollerPlayerId: PLAYERS[0]!.id,
      },
      players: created.players.map((player) =>
        player.id === PLAYERS[1]!.id
          ? {
              ...player,
              piecesRemaining: { ...player.piecesRemaining, settlements: 4 },
              victoryPoints: 1,
            }
          : player,
      ),
    };

    expect(state.settings.friendlyRobber).toBe(false);
    expect(getLegalActions(state, PLAYERS[0]!.id).robberTileIds).toContain(tile.id);
  });

  test("still requires a move when every other tile is protected", () => {
    let state = createGame("fr7:58");
    state = { ...state, settings: { ...state.settings, friendlyRobber: true } };

    while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
      const actorPlayerId = getRequiredPlayerIds(state)[0];
      if (!actorPlayerId) throw new Error("Setup requires an actor");
      state = applyCommand(state, actorPlayerId, chooseAutomatedCommand(state, actorPlayerId));
    }

    const protectingVertexKeys = [
      "vertex:-1:-3",
      "vertex:-5:-1",
      "vertex:-5:1",
      "vertex:-5:3",
      "vertex:1:1",
      "vertex:1:3",
      "vertex:4:-2",
      "vertex:5:1",
    ];
    state = {
      ...state,
      board: {
        ...state.board,
        buildings: state.board.buildings.map((building, index) => ({
          ...building,
          vertexKey: protectingVertexKeys[index] ?? building.vertexKey,
        })),
      },
    };

    state = applyCommand(state, state.activePlayerId, { kind: "roll" });
    expect(state.lastDiceRoll?.sum).toBe(7);
    expect(state.phase.kind).toBe("move_robber");

    const currentTileId = state.board.robberTileId;
    const legalTileIds = getLegalActions(state, state.activePlayerId).robberTileIds;
    expect(legalTileIds).not.toContain(currentTileId);
    expect(legalTileIds).toHaveLength(state.board.tiles.length - 1);
    const destinationTileId = legalTileIds[0];
    if (!destinationTileId) throw new Error("Robber needs a legal destination");

    const next = applyCommand(state, state.activePlayerId, {
      kind: "move_robber",
      tileId: destinationTileId,
    });
    expect(next.board.robberTileId).toBe(destinationTileId);
  });
});

describe("robber production blocking", () => {
  test("a settlement or city receives nothing from the occupied terrain tile", () => {
    const created = createGame("robber-production-block");
    const topology = getBoardTopology(created.board.tiles);
    const tilesById = new Map(created.board.tiles.map((tile) => [tile.id, tile]));
    const placement = created.board.tiles.flatMap((tile) => {
      if (tile.numberToken === null || tile.terrain === "desert") {
        return [];
      }
      const vertexKey = (topology.tileById[tile.id]?.vertexKeys ?? []).find((candidate) =>
        (topology.vertexTileIds[candidate] ?? []).every(
          (tileId) => tileId === tile.id || tilesById.get(tileId)?.numberToken !== tile.numberToken,
        ),
      );
      return vertexKey ? [{ rollTotal: tile.numberToken, tileId: tile.id, vertexKey }] : [];
    })[0];
    if (!placement) throw new Error("Test board needs an isolated production vertex");

    for (const kind of ["settlement", "city"] as const) {
      const state: GameState = {
        ...created,
        board: {
          ...created.board,
          buildings: [{ kind, playerId: PLAYERS[0]!.id, vertexKey: placement.vertexKey }],
          robberTileId: placement.tileId,
        },
        players: created.players.map((player) =>
          player.id === PLAYERS[0]!.id
            ? {
                ...player,
                piecesRemaining: {
                  ...player.piecesRemaining,
                  cities: kind === "city" ? 3 : 4,
                  settlements: kind === "settlement" ? 4 : 5,
                },
                victoryPoints: kind === "city" ? 2 : 1,
              }
            : player,
        ),
      };

      const next = distributeResourcesForRoll(state, placement.rollTotal);

      expect(next.players[0]!.resources).toEqual(emptyInventory());
      expect(next.bank).toEqual(created.bank);
      expectConservedState(next);
    }
  });
});

describe("robber theft", () => {
  function robberReadyState(victimPlayerIds: string[]) {
    const created = createGame(`robber-theft:${victimPlayerIds.length}`);
    const tile = created.board.tiles.find(
      (candidate) => candidate.id !== created.board.robberTileId,
    );
    if (!tile) throw new Error("Robber needs another tile");

    const vertexKeys = getBoardTopology(created.board.tiles).tileById[tile.id]?.vertexKeys ?? [];
    if (vertexKeys.length < victimPlayerIds.length) {
      throw new Error("Robber tile needs enough adjacent vertices");
    }

    const victimIdSet = new Set(victimPlayerIds);
    const state: GameState = {
      ...created,
      activePlayerId: PLAYERS[0]!.id,
      bank: {
        ...created.bank,
        brick: created.bank.brick - victimPlayerIds.length,
      },
      board: {
        ...created.board,
        buildings: victimPlayerIds.map((playerId, index) => ({
          kind: "settlement",
          playerId,
          vertexKey: vertexKeys[index]!,
        })),
      },
      phase: {
        kind: "move_robber",
        resumePhase: "build_and_trade",
        rollerPlayerId: PLAYERS[0]!.id,
      },
      players: created.players.map((player) =>
        victimIdSet.has(player.id)
          ? {
              ...player,
              piecesRemaining: { ...player.piecesRemaining, settlements: 4 },
              resources: { ...player.resources, brick: 1 },
              victoryPoints: 1,
            }
          : player,
      ),
      settings: { ...created.settings, friendlyRobber: false },
    };

    return { state, tileId: tile.id };
  }

  test("automatically steals when only one adjacent player is eligible", () => {
    const { state, tileId } = robberReadyState([PLAYERS[1]!.id]);
    const next = applyCommand(state, PLAYERS[0]!.id, { kind: "move_robber", tileId });

    expect(next.phase).toEqual({ kind: "build_and_trade" });
    expect(next.players[0]!.resources.brick).toBe(1);
    expect(next.players[1]!.resources.brick).toBe(0);
    expect(next.randomIndex).toBe(state.randomIndex + 1);
    expectConservedState(next);
  });

  test("still asks for a victim when multiple adjacent players are eligible", () => {
    const victimPlayerIds = [PLAYERS[1]!.id, PLAYERS[2]!.id];
    const { state, tileId } = robberReadyState(victimPlayerIds);
    const next = applyCommand(state, PLAYERS[0]!.id, { kind: "move_robber", tileId });

    expect(next.phase).toEqual({
      eligibleVictimIds: victimPlayerIds,
      kind: "steal",
      resumePhase: "build_and_trade",
      rollerPlayerId: PLAYERS[0]!.id,
    });
    expect(next.players[0]!.resources.brick).toBe(0);
    expect(next.randomIndex).toBe(state.randomIndex);
    expectConservedState(next);
  });
});

describe("maps and turn limits", () => {
  test("each supported map exposes only its intended player counts", () => {
    expect([3, 4, 5, 6, 7, 8].filter((count) => mapSupportsPlayerCount("base", count))).toEqual([
      3, 4,
    ]);
    expect(
      [3, 4, 5, 6, 7, 8].filter((count) => mapSupportsPlayerCount("extended-6", count)),
    ).toEqual([5, 6]);
    expect(
      [3, 4, 5, 6, 7, 8].filter((count) => mapSupportsPlayerCount("extended-8", count)),
    ).toEqual([7, 8]);

    expectRuleError(
      () =>
        createDefaultGame(
          [
            ...PLAYERS,
            {
              botDifficulty: "hard",
              displayName: SUPERHERO_BOT_NAMES[4],
              id: "player-5",
              isBot: true,
            } as const,
          ],
          "invalid-map-size",
          { map: "base", maxPlayers: 5 },
        ),
      "INVALID_COMMAND",
    );
  });

  test("ending turn 500 continues to the next player", () => {
    const state: GameState = {
      ...createGame("long-game"),
      phase: { kind: "build_and_trade" },
      turnNumber: 500,
    };
    const next = applyCommand(state, PLAYERS[0]!.id, { kind: "end_turn" });

    expect(next.status).toBe("active");
    expect(next.phase).toEqual({ kind: "roll" });
    expect(next.activePlayerId).toBe(PLAYERS[1]!.id);
    expect(next.turnNumber).toBe(501);
    expect(next.winnerPlayerId).toBeNull();
  });
});

describe("automated decisions", () => {
  test("a human timeout never spends cards on an optional build", () => {
    const { state } = cityReadyState();
    state.players[0]!.isBot = false;
    state.players[0]!.botDifficulty = undefined;

    expect(chooseAutomatedCommand(state, PLAYERS[0]!.id)).toEqual({ kind: "end_turn" });
  });

  test("easy and medium bots vary deterministic robber destinations", () => {
    for (const botDifficulty of ["easy", "medium"] as const) {
      const created = createGame(`robber-destinations-${botDifficulty}`);
      let state: GameState = {
        ...created,
        activePlayerId: PLAYERS[0]!.id,
        phase: {
          kind: "move_robber",
          resumePhase: "build_and_trade",
          rollerPlayerId: PLAYERS[0]!.id,
        },
        players: created.players.map((player) =>
          player.id === PLAYERS[0]!.id ? { ...player, botDifficulty } : player,
        ),
        settings: { ...created.settings, friendlyRobber: false },
      };
      const destinations = new Set<string>();

      for (let move = 0; move < 20; move += 1) {
        const command = chooseAutomatedCommand(state, PLAYERS[0]!.id);
        expect(command.kind).toBe("move_robber");
        if (command.kind !== "move_robber") throw new Error("Bot must move the robber");

        destinations.add(command.tileId);
        state = {
          ...state,
          actionNumber: state.actionNumber + 1,
          board: { ...state.board, robberTileId: command.tileId },
        };
      }

      expect(destinations.size).toBeGreaterThan(2);
    }
  });

  test("easy bots use targeted trades instead of cycling or starving forever", () => {
    const players = Array.from({ length: 3 }, (_, index) => ({
      botDifficulty: "easy" as const,
      displayName: SUPERHERO_BOT_NAMES[index]!,
      id: `easy-player-${index + 1}`,
      isBot: true,
    }));
    let state = createDefaultGame(players, "audit:base:easy:0", {
      map: "base",
      maxPlayers: 3,
      turnTimerSeconds: 0,
      victoryPoints: 10,
    });

    for (let step = 0; step < 2_000 && state.status !== "completed"; step += 1) {
      const actorPlayerId = getRequiredPlayerIds(state)[0];
      if (!actorPlayerId) throw new Error("Automated game requires an actor");
      state = applyCommand(state, actorPlayerId, chooseAutomatedCommand(state, actorPlayerId));
    }

    expect(state.status).toBe("completed");
    expect(state.winnerPlayerId).not.toBeNull();
    expectConservedState(state);
  });

  test("complete bot games preserve legality after every action", () => {
    for (let gameIndex = 0; gameIndex < 4; gameIndex += 1) {
      let state = createGame(`rules-audit-${gameIndex}`);

      for (let step = 0; step < 5_000 && state.status !== "completed"; step += 1) {
        const actorPlayerId = getRequiredPlayerIds(state).find(
          (playerId) => state.players.find((player) => player.id === playerId)?.isBot,
        );
        expect(actorPlayerId).toBeDefined();

        const command = chooseAutomatedCommand(state, actorPlayerId!);
        if (command.kind === "build_city") {
          expect(state.board.buildings).toContainEqual({
            kind: "settlement",
            playerId: actorPlayerId!,
            vertexKey: command.vertexKey,
          });
        }

        const previousActionNumber = state.actionNumber;
        state = applyCommand(state, actorPlayerId!, command);
        expect(state.actionNumber).toBe(previousActionNumber + 1);
        expectConservedState(state);
      }

      expect(state.status).toBe("completed");
    }
  });
});
