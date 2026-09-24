import { describe, expect, test } from "bun:test";

import { NUMBER_TOKEN_PIPS, TERRAIN_RESOURCE } from "../src/constants";
import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  GAME_SETTINGS_LIMITS,
  RESOURCE_TYPES,
  applyCommand,
  assertGameState,
  assertPlayerGameView,
  chooseAutomatedCommand,
  chooseFallbackCommand,
  emptyInventory,
  getBoardTopology,
  getLegalActions,
  getRequiredPlayerIds,
  toPlayerView,
  type GameCommand,
  type GamePlayerInput,
  type GameState,
  type ResourceInventory,
} from "../src/index";
import { reconcileLargestArmyAward } from "../src/largest-army";
import { subtractResources } from "../src/resources";
import { getSettlementVertexKeys } from "../src/rules";
import type { BoardTopology } from "../src/topology";
import type { PortDescriptor } from "../src/types";
import {
  boardPieces,
  createGame,
  createPlayedGame,
  makePlayers,
  opponentsOf,
  playThroughSetup,
  playerById,
  ruleError,
  surroundings,
  withBoardPieces,
  withCardsFromBank,
  withDevelopmentCard,
  withHand,
  withNextRoll,
} from "./helpers";

const HUMANS = makePlayers(4).map(
  ({ displayName, id }): GamePlayerInput => ({ displayName, id, isBot: false }),
);

function handChange(before: GameState, after: GameState, playerId: string): ResourceInventory {
  return subtractResources(
    playerById(after, playerId).resources,
    playerById(before, playerId).resources,
  );
}

function tileAdjacentBuildings(state: GameState, topology: BoardTopology, tileId: string) {
  const vertexKeys = topology.tileById[tileId]!.vertexKeys;
  return state.board.buildings.filter((building) => vertexKeys.includes(building.vertexKey));
}

function withPlayedKnights(state: GameState, playerId: string, count: number): GameState {
  let next = state;
  for (let played = 0; played < count; played += 1) {
    next = {
      ...next,
      developmentDeck: next.developmentDeck.toSpliced(next.developmentDeck.indexOf("knight"), 1),
      players: next.players.map((player) =>
        player.id === playerId
          ? { ...player, playedDevelopmentCards: [...player.playedDevelopmentCards, "knight"] }
          : player,
      ),
    };
  }
  return reconcileLargestArmyAward(next);
}

function playEntireGame(initial: GameState) {
  let state = initial;
  for (let step = 0; step < 5_000 && state.phase.kind !== "finished"; step += 1) {
    const actorPlayerId = getRequiredPlayerIds(state)[0]!;
    const command = chooseAutomatedCommand(state, actorPlayerId);
    const previousActionNumber = state.actionNumber;
    state = applyCommand(state, actorPlayerId, command);
    expect(state.actionNumber).toBe(previousActionNumber + 1);
    assertGameState(state);
  }
  return state;
}

describe("game creation", () => {
  test("draws the turn order from the seed while seats stay in lobby order", () => {
    const playerIds = makePlayers(4).map((player) => player.id);
    const openingPlayers = new Set<string>();

    for (let index = 0; index < 12; index += 1) {
      const game = createGame(`turn-order-${index}`);

      expect(game.players.map((player) => player.id)).toEqual(playerIds);
      expect(game.players.map((player) => player.seatIndex)).toEqual([0, 1, 2, 3]);
      expect(game.turnOrder.toSorted()).toEqual(playerIds);
      expect(game.activePlayerId).toBe(game.turnOrder[0]!);
      expect(createGame(`turn-order-${index}`).turnOrder).toEqual(game.turnOrder);
      openingPlayers.add(game.activePlayerId);
    }

    expect(openingPlayers.size).toBeGreaterThan(1);
  });

  test("rejects settings outside the shared limits and maps too small for the table", () => {
    const { discardLimit, victoryPoints } = GAME_SETTINGS_LIMITS;

    for (const settings of [
      { victoryPoints: victoryPoints.min - 1 },
      { victoryPoints: victoryPoints.max + 1 },
      { discardLimit: discardLimit.min - 1 },
      { discardLimit: discardLimit.max + 1 },
    ]) {
      expect(() => createGame("invalid-settings", settings)).toThrow(ruleError("INVALID_SETTINGS"));
    }
    expect(() => createGame("crowded-map", { map: "base" }, makePlayers(5))).toThrow(
      ruleError("INVALID_SETTINGS"),
    );
  });
});

describe("opening setup", () => {
  test("snakes through the turn order and pays the second settlement's neighbouring tiles", () => {
    let state = createGame("snake-order");
    const topology = getBoardTopology(state.board.tiles);
    const settlers: string[] = [];

    while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
      const actorPlayerId = state.activePlayerId;
      const command = chooseAutomatedCommand(state, actorPlayerId);
      const next = applyCommand(state, actorPlayerId, command);

      if (command.kind === "place_settlement") {
        const expected = emptyInventory();
        if (settlers.includes(actorPlayerId)) {
          for (const tileId of topology.vertexTileIds[command.vertexKey]!) {
            const tile = state.board.tiles.find((candidate) => candidate.id === tileId)!;
            const resource = TERRAIN_RESOURCE[tile.terrain];
            if (resource) expected[resource] += 1;
          }
        }
        settlers.push(actorPlayerId);
        expect(handChange(state, next, actorPlayerId)).toEqual(expected);
      }
      state = next;
    }

    expect(settlers).toEqual([...state.turnOrder, ...state.turnOrder.toReversed()]);
    expect(state.phase).toEqual({ kind: "roll" });
    expect(state.activePlayerId).toBe(state.turnOrder[0]!);
    assertGameState(state);
  });

  test("allows the first roll only after every player completes opening setup", () => {
    const state = playThroughSetup(createGame("complete-opening-roll"));

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

describe("rolling", () => {
  test("a seven makes only hands over the discard limit discard half, rounded down", () => {
    const played = createPlayedGame("discard-on-seven");
    const roller = played.turnOrder[0]!;
    const largeHand = played.turnOrder[1]!;
    const limitHand = played.turnOrder[2]!;
    const smallHand = played.turnOrder[3]!;
    const hands = withHand(
      withHand(
        withHand(
          withHand(played, roller, { brick: 3, sheep: 2, stone: 2, tree: 1, wheat: 1 }),
          largeHand,
          { brick: 2, sheep: 2, stone: 2, tree: 2 },
        ),
        limitHand,
        { wheat: 7 },
      ),
      smallHand,
      { tree: 3 },
    );

    const rolled = applyCommand(withNextRoll(hands, 7), roller, { kind: "roll" });

    expect(rolled.lastDiceRoll?.sum).toBe(7);
    expect(getRequiredPlayerIds(rolled).toSorted()).toEqual([roller, largeHand].toSorted());
    expect(getLegalActions(rolled, roller).discardCount).toBe(4);
    expect(getLegalActions(rolled, largeHand).discardCount).toBe(4);
    expect(getLegalActions(rolled, limitHand).discardCount).toBeNull();
    expect(() =>
      applyCommand(rolled, roller, {
        kind: "discard",
        resources: { ...emptyInventory(), brick: 3 },
      }),
    ).toThrow(ruleError("INVALID_DISCARD"));

    const rollerDiscarded = applyCommand(rolled, roller, {
      kind: "discard",
      resources: { ...emptyInventory(), brick: 3, sheep: 1 },
    });
    expect(getRequiredPlayerIds(rollerDiscarded)).toEqual([largeHand]);

    const allDiscarded = applyCommand(rollerDiscarded, largeHand, {
      kind: "discard",
      resources: { ...emptyInventory(), stone: 2, tree: 2 },
    });
    expect(allDiscarded.phase).toEqual({ kind: "move_robber", resumePhase: "build_and_trade" });
    expect(playerById(allDiscarded, largeHand).resources).toEqual({
      ...emptyInventory(),
      brick: 2,
      sheep: 2,
    });
    assertGameState(allDiscarded);
  });

  test("a short bank pays nobody when several players are owed, but pays out a lone claimant", () => {
    const base = createPlayedGame("bank-shortage");
    const roller = base.activePlayerId;
    const claims = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].flatMap((sum) => {
      const rolled = applyCommand(withNextRoll(base, sum), roller, { kind: "roll" });
      return RESOURCE_TYPES.map((resource) => ({
        owed: base.players.map((player) => handChange(base, rolled, player.id)[resource]),
        resource,
        sum,
      }));
    });
    const rollWithBankHolding = (claim: (typeof claims)[number], remaining: number) => {
      const drained = withCardsFromBank(base, roller, {
        [claim.resource]: base.bank[claim.resource] - remaining,
      });
      const rolled = applyCommand(withNextRoll(drained, claim.sum), roller, { kind: "roll" });
      assertGameState(rolled);
      return drained.players.map(
        (player) => handChange(drained, rolled, player.id)[claim.resource],
      );
    };
    const shared = claims.find(({ owed }) => owed.filter((count) => count > 0).length > 1)!;
    const lone = claims.find(
      ({ owed }) => owed.filter((count) => count > 0).length === 1 && Math.max(...owed) > 1,
    )!;
    const loneTotal = Math.max(...lone.owed);

    expect(rollWithBankHolding(shared, 1)).toEqual(shared.owed.map(() => 0));
    expect(rollWithBankHolding(lone, loneTotal - 1)).toEqual(
      lone.owed.map((count) => (count > 0 ? loneTotal - 1 : 0)),
    );
  });

  test("balanced dice draw from the bag and reshuffle once 5 rolls are left", () => {
    const played = createPlayedGame("balanced-dice-reshuffle");
    const roller = played.activePlayerId;
    const stacked = withNextRoll(played, 8);
    const sixLeft = { ...stacked, balancedDiceBag: stacked.balancedDiceBag.slice(0, 6) };

    const drawn = applyCommand(sixLeft, roller, { kind: "roll" });
    expect(drawn.lastDiceRoll).toEqual(sixLeft.balancedDiceBag[0]!);
    expect(drawn.balancedDiceBag).toEqual(sixLeft.balancedDiceBag.slice(1));
    expect(drawn.randomIndex).toBe(sixLeft.randomIndex);

    const reshuffled = applyCommand({ ...drawn, phase: { kind: "roll" } }, roller, {
      kind: "roll",
    });
    expect(reshuffled.balancedDiceBag).toHaveLength(35);
    expect(reshuffled.randomIndex).toBe(drawn.randomIndex + 35);
  });

  test("the robber's tile produces nothing", () => {
    const base = createPlayedGame("robber-production-block");
    const topology = getBoardTopology(base.board.tiles);
    const tile = base.board.tiles.find(
      (candidate) =>
        candidate.numberToken !== null &&
        candidate.id !== base.board.robberTileId &&
        tileAdjacentBuildings(base, topology, candidate.id).length > 0,
    )!;
    const resource = TERRAIN_RESOURCE[tile.terrain]!;
    const rollTile = (state: GameState) =>
      applyCommand(withNextRoll(state, tile.numberToken!), state.activePlayerId, { kind: "roll" });
    const open = rollTile(base);
    const blocked = rollTile({ ...base, board: { ...base.board, robberTileId: tile.id } });

    for (const player of base.players) {
      const buildingsOnTile = tileAdjacentBuildings(base, topology, tile.id).filter(
        (building) => building.playerId === player.id,
      ).length;
      expect(
        handChange(base, open, player.id)[resource] -
          handChange(base, blocked, player.id)[resource],
      ).toBe(buildingsOnTile);
    }
  });
});

describe("building", () => {
  test("a settlement must keep its distance and connect to the player's roads", () => {
    const played = createPlayedGame("settlement-placement");
    const builder = played.activePlayerId;
    const state = withHand(played, builder, BUILD_COSTS.settlement);
    const topology = getBoardTopology(state.board.tiles);
    const ownSettlement = boardPieces(state)[builder]!.settlements[0]!;
    const crowdedVertexKey = topology.vertexNeighbors[ownSettlement]![0]!;
    const legalVertexKeys = getLegalActions(state, builder).settlementVertexKeys;
    const unconnectedVertexKey = getSettlementVertexKeys(state, builder, false).find(
      (vertexKey) => !legalVertexKeys.includes(vertexKey),
    )!;

    expect(() =>
      applyCommand(state, builder, { kind: "place_settlement", vertexKey: crowdedVertexKey }),
    ).toThrow(ruleError("DISTANCE_RULE"));
    expect(() =>
      applyCommand(state, builder, { kind: "place_settlement", vertexKey: unconnectedVertexKey }),
    ).toThrow(ruleError("ROAD_NOT_CONNECTED"));
  });

  test("a road cannot continue through an opponent's settlement", () => {
    const played = createPlayedGame("blocked-road");
    const builder = played.activePlayerId;
    const rival = opponentsOf(played, builder)[0]!;
    const topology = getBoardTopology(played.board.tiles);
    const pieces = boardPieces(played);
    const occupied = surroundings(
      topology,
      played.board.buildings.map((building) => building.vertexKey),
    );
    const roadedEdgeKeys = new Set(played.board.roads.map((road) => road.edgeKey));
    const extension = pieces[builder]!.roads.flatMap((roadEdgeKey) =>
      topology.edgeVertices[roadEdgeKey]!.flatMap((junction) =>
        topology.vertexEdges[junction]!.map((edgeKey) => ({
          edgeKey,
          outpost: topology.edgeVertices[edgeKey]!.find((vertexKey) => vertexKey !== junction)!,
        })),
      ),
    ).find(({ edgeKey, outpost }) => !roadedEdgeKeys.has(edgeKey) && !occupied.has(outpost))!;
    const blockedEdgeKey = topology.vertexEdges[extension.outpost]!.find(
      (edgeKey) => edgeKey !== extension.edgeKey && !roadedEdgeKeys.has(edgeKey),
    )!;
    const state = withHand(
      withBoardPieces(played, {
        ...pieces,
        [builder]: { ...pieces[builder]!, roads: [...pieces[builder]!.roads, extension.edgeKey] },
        [rival]: {
          ...pieces[rival]!,
          settlements: [...pieces[rival]!.settlements, extension.outpost],
        },
      }),
      builder,
      BUILD_COSTS.road,
    );
    assertGameState(state);

    expect(getLegalActions(state, builder).roadEdgeKeys).not.toContain(blockedEdgeKey);
    expect(() =>
      applyCommand(state, builder, { edgeKey: blockedEdgeKey, kind: "place_road" }),
    ).toThrow(ruleError("ROAD_NOT_CONNECTED"));
  });

  test("a player with no settlements left cannot place another", () => {
    const played = createPlayedGame("out-of-settlements");
    const builder = played.activePlayerId;
    let state = played;
    for (let added = 0; added < 3; added += 1) {
      const pieces = boardPieces(state);
      const vertexKey = getSettlementVertexKeys(state, builder, false)[0]!;
      state = withBoardPieces(state, {
        ...pieces,
        [builder]: {
          ...pieces[builder]!,
          settlements: [...pieces[builder]!.settlements, vertexKey],
        },
      });
    }
    state = withHand(state, builder, BUILD_COSTS.settlement);
    assertGameState(state);

    expect(getLegalActions(state, builder).settlementVertexKeys).toEqual([]);
    expect(() =>
      applyCommand(state, builder, {
        kind: "place_settlement",
        vertexKey: getSettlementVertexKeys(state, builder, false)[0]!,
      }),
    ).toThrow(ruleError("NO_PIECE_AVAILABLE"));
  });

  test("a bot upgrades one of its own settlements and pays the full city cost", () => {
    const played = createPlayedGame("city-upgrade");
    const builder = played.activePlayerId;
    const state = withHand(played, builder, BUILD_COSTS.city);
    const command = chooseAutomatedCommand(state, builder);
    if (command.kind !== "build_city") throw new Error(`Expected a city, got ${command.kind}`);

    const next = applyCommand(state, builder, command);

    expect(next.board.buildings).toContainEqual({
      kind: "city",
      playerId: builder,
      vertexKey: command.vertexKey,
    });
    expect(playerById(next, builder)).toMatchObject({
      piecesRemaining: { cities: 3, roads: 13, settlements: 4 },
      resources: emptyInventory(),
      victoryPoints: playerById(state, builder).victoryPoints + 1,
    });
    assertGameState(next);
  });

  test("an empty vertex or an opponent's settlement cannot become a city", () => {
    const played = createPlayedGame("invalid-city");
    const builder = played.activePlayerId;
    const state = withHand(played, builder, BUILD_COSTS.city);
    const opponentSettlement = boardPieces(state)[opponentsOf(state, builder)[0]!]!.settlements[0]!;
    const emptyVertexKey = getSettlementVertexKeys(state, builder, false)[0]!;

    for (const vertexKey of [emptyVertexKey, opponentSettlement]) {
      expect(() => applyCommand(state, builder, { kind: "build_city", vertexKey })).toThrow(
        ruleError("INVALID_LOCATION"),
      );
    }
  });
});

describe("bank trades", () => {
  test("harbours lower the rate from 4:1 to 3:1, and to 2:1 for their resource", () => {
    const played = createPlayedGame("harbour-rates");
    const trader = played.activePlayerId;
    const topology = getBoardTopology(played.board.tiles);
    const occupied = surroundings(
      topology,
      played.board.buildings.map((building) => building.vertexKey),
    );
    const freeHarbourVertex = (port: PortDescriptor) =>
      topology.edgeVertices[port.edgeKey]!.find((vertexKey) => !occupied.has(vertexKey));
    const genericPort = played.board.ports.find(
      (port) => port.trade === "any" && freeHarbourVertex(port),
    )!;
    const resourcePort = played.board.ports.find(
      (port) =>
        port.trade !== "any" &&
        freeHarbourVertex(port) &&
        !surroundings(topology, [freeHarbourVertex(genericPort)!]).has(freeHarbourVertex(port)!),
    )!;
    const withHarbours = (ports: readonly PortDescriptor[]) => {
      const pieces = boardPieces(played);
      return withHand(
        withBoardPieces(played, {
          ...pieces,
          [trader]: {
            ...pieces[trader]!,
            settlements: [
              ...pieces[trader]!.settlements,
              ...ports.map((port) => freeHarbourVertex(port)!),
            ],
          },
        }),
        trader,
        { brick: 4, sheep: 4, stone: 4, tree: 4, wheat: 4 },
      );
    };
    const ratios = (state: GameState) =>
      Object.fromEntries(
        getLegalActions(state, trader).bankTrades.map((trade) => [trade.give, trade.ratio]),
      );
    const expectedRatios = (ratio: number) =>
      Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, ratio]));

    expect(ratios(withHarbours([]))).toEqual(expectedRatios(4));
    expect(ratios(withHarbours([genericPort]))).toEqual(expectedRatios(3));

    const bothHarbours = withHarbours([genericPort, resourcePort]);
    const harbourResource = resourcePort.trade;
    if (harbourResource === "any") throw new Error("Expected a resource harbour");
    expect(ratios(bothHarbours)).toEqual({ ...expectedRatios(3), [harbourResource]: 2 });

    const receive = RESOURCE_TYPES.find((resource) => resource !== harbourResource)!;
    const traded = applyCommand(bothHarbours, trader, {
      give: harbourResource,
      kind: "trade_bank",
      receive,
    });
    expect(handChange(bothHarbours, traded, trader)).toEqual({
      ...emptyInventory(),
      [harbourResource]: -2,
      [receive]: 1,
    });
    assertGameState(traded);
  });

  test("a hidden bank does not reveal an exhausted resource through legal actions", () => {
    const played = createPlayedGame("hidden-bank", { hideBankCards: true });
    const trader = played.activePlayerId;
    const hoarder = opponentsOf(played, trader)[0]!;
    const state = withCardsFromBank(withHand(played, trader, { wheat: 4 }), hoarder, {
      brick: played.bank.brick + playerById(played, trader).resources.brick,
    });
    const receivesBrick = { give: "wheat", receive: "brick" };

    expect(state.bank.brick).toBe(0);
    expect(toPlayerView(state, trader).legalActions.bankTrades).toContainEqual(
      expect.objectContaining(receivesBrick),
    );
    expect(getLegalActions(state, trader).bankTrades).not.toContainEqual(
      expect.objectContaining(receivesBrick),
    );
    expect(() =>
      applyCommand(state, trader, { give: "wheat", kind: "trade_bank", receive: "brick" }),
    ).toThrow(ruleError("BANK_OUT_OF_RESOURCE"));
  });
});

describe("player trades", () => {
  function tradeTable(seed: string) {
    const played = createPlayedGame(seed);
    const proposer = played.turnOrder[0]!;
    const first = played.turnOrder[1]!;
    const second = played.turnOrder[2]!;
    const third = played.turnOrder[3]!;
    const state = withHand(
      withHand(
        withHand(withHand(played, proposer, { stone: 3, wheat: 2 }), first, { wheat: 1 }),
        second,
        {
          wheat: 2,
        },
      ),
      third,
      {},
    );
    const propose = (recipientPlayerIds: string[]): GameState =>
      applyCommand(state, proposer, {
        give: { ...emptyInventory(), stone: 1 },
        kind: "propose_trade",
        recipientPlayerIds,
        want: { ...emptyInventory(), wheat: 1 },
      });
    return { first, propose, proposer, second, state, third };
  }

  function respond(state: GameState, playerId: string, accept: boolean): GameState {
    return applyCommand(state, playerId, {
      accept,
      kind: "respond_trade",
      offerActionNumber: state.tradeOffer!.offerActionNumber,
    });
  }

  test("a trade waits for the proposer to confirm one of the players who accepted", () => {
    const { first, propose, proposer, second, state, third } = tradeTable("confirmed-trade");
    const proposed = propose([first, second, third]);
    const offerActionNumber = proposed.tradeOffer!.offerActionNumber;

    const firstAccepted = respond(proposed, first, true);
    expect(firstAccepted.players).toEqual(proposed.players);
    expect(getRequiredPlayerIds(firstAccepted)).toEqual([proposer, second, third]);
    expect(getLegalActions(firstAccepted, first).canRespondToTrade).toBe(false);

    const responded = respond(respond(firstAccepted, second, true), third, false);
    expect(responded.tradeOffer).toMatchObject({
      acceptedPlayerIds: [first, second],
      rejectedPlayerIds: [third],
    });
    expect(getRequiredPlayerIds(responded)).toEqual([proposer]);
    expect(getLegalActions(responded, proposer).tradePartnerPlayerIds).toEqual([first, second]);
    for (const viewerPlayerId of state.turnOrder) {
      const view = toPlayerView(responded, viewerPlayerId);
      expect(view.tradeOffer).toEqual(responded.tradeOffer);
      assertPlayerGameView(view);
    }
    expect(() =>
      applyCommand(responded, proposer, {
        kind: "confirm_trade",
        offerActionNumber,
        partnerPlayerId: third,
      }),
    ).toThrow(ruleError("INVALID_TRADE"));

    const traded = applyCommand(responded, proposer, {
      kind: "confirm_trade",
      offerActionNumber,
      partnerPlayerId: second,
    });

    expect(traded.tradeOffer).toBeNull();
    expect(handChange(responded, traded, proposer)).toEqual({
      ...emptyInventory(),
      stone: -1,
      wheat: 1,
    });
    expect(handChange(responded, traded, second)).toEqual({
      ...emptyInventory(),
      stone: 1,
      wheat: -1,
    });
    expect(handChange(responded, traded, first)).toEqual(emptyInventory());
    assertGameState(traded);
  });

  test("an offer closes when everyone declines, it is cancelled, the turn ends, or the proposer spends the cards", () => {
    const { first, propose, proposer, second } = tradeTable("closed-trade");
    const proposed = propose([first, second]);
    const offerActionNumber = proposed.tradeOffer!.offerActionNumber;
    const cityVertexKey = boardPieces(proposed)[proposer]!.settlements[0]!;
    const closings: GameCommand[] = [
      { kind: "cancel_trade", offerActionNumber },
      { kind: "end_turn" },
      { kind: "build_city", vertexKey: cityVertexKey },
    ];

    expect(respond(respond(proposed, first, false), second, false).tradeOffer).toBeNull();
    for (const command of closings) {
      const closed = applyCommand(proposed, proposer, command);
      expect(closed.tradeOffer).toBeNull();
      assertGameState(closed);
    }
  });

  test("an offer must be affordable and cannot trade a resource for itself", () => {
    const { first, propose, proposer, state, third } = tradeTable("invalid-trade");

    expect(() => respond(propose([third]), third, true)).toThrow(
      ruleError("INSUFFICIENT_RESOURCES"),
    );
    expect(() => respond(propose([first]), first, true)).not.toThrow();
    expect(() =>
      applyCommand(state, proposer, {
        give: { ...emptyInventory(), stone: 1 },
        kind: "propose_trade",
        recipientPlayerIds: [first],
        want: { ...emptyInventory(), stone: 1, wheat: 1 },
      }),
    ).toThrow(ruleError("INVALID_TRADE"));
  });
});

describe("development cards", () => {
  test("draws the deterministic top card, pays the bank, and hides it from opponents", () => {
    const played = createPlayedGame("development-card-purchase");
    const buyer = played.activePlayerId;
    const state = withHand(played, buyer, DEVELOPMENT_CARD_COST);
    const topCard = state.developmentDeck[0]!;

    expect(getLegalActions(state, buyer).canBuyDevelopmentCard).toBe(true);
    const next = applyCommand(state, buyer, { kind: "buy_development_card" });

    expect(next.developmentDeck).toEqual(state.developmentDeck.slice(1));
    expect(playerById(next, buyer).developmentCards).toEqual([topCard]);
    expect(playerById(next, buyer).resources).toEqual(emptyInventory());
    expect(getLegalActions(next, buyer).canBuyDevelopmentCard).toBe(false);
    const opponentView = toPlayerView(next, opponentsOf(next, buyer)[0]!);
    const buyerAsSeenByOpponent = opponentView.players.find((player) => player.id === buyer)!;
    expect(opponentView.developmentCardSupply).toBe(state.developmentDeck.length - 1);
    expect(buyerAsSeenByOpponent).toMatchObject({ developmentCardCount: 1, isViewer: false });
    expect("developmentCards" in buyerAsSeenByOpponent).toBe(false);
    assertGameState(next);
  });

  test("rejects an unaffordable purchase, an empty supply, and the wrong phase", () => {
    const played = createPlayedGame("development-card-rejections");
    const buyer = played.activePlayerId;
    const ready = withHand(played, buyer, DEVELOPMENT_CARD_COST);
    const unaffordable = withHand(played, buyer, { sheep: 1, stone: 1 });
    const emptySupply: GameState = { ...ready, developmentDeck: [] };
    const wrongPhase: GameState = { ...ready, phase: { kind: "roll" } };

    expect(getLegalActions(unaffordable, buyer).canBuyDevelopmentCard).toBe(false);
    expect(getLegalActions(emptySupply, buyer).canBuyDevelopmentCard).toBe(false);
    expect(() => applyCommand(unaffordable, buyer, { kind: "buy_development_card" })).toThrow(
      ruleError("INSUFFICIENT_RESOURCES"),
    );
    expect(() => applyCommand(emptySupply, buyer, { kind: "buy_development_card" })).toThrow(
      ruleError("NO_DEVELOPMENT_CARD_AVAILABLE"),
    );
    expect(() => applyCommand(wrongPhase, buyer, { kind: "buy_development_card" })).toThrow(
      ruleError("INVALID_PHASE"),
    );
  });

  test("a bought victory-point card wins at once without showing in the public score", () => {
    const played = createPlayedGame("development-card-victory", { victoryPoints: 3 });
    const buyer = played.activePlayerId;
    const victoryPointIndex = played.developmentDeck.indexOf("victory-point");
    const state = withHand(
      {
        ...played,
        developmentDeck: [
          "victory-point",
          ...played.developmentDeck.toSpliced(victoryPointIndex, 1),
        ],
      },
      buyer,
      DEVELOPMENT_CARD_COST,
    );
    assertGameState(state);

    const next = applyCommand(state, buyer, { kind: "buy_development_card" });

    expect(playerById(next, buyer).victoryPoints).toBe(2);
    expect(next.phase.kind).toBe("finished");
    expect(next.winnerPlayerId).toBe(buyer);
    expect(
      toPlayerView(next, opponentsOf(next, buyer)[0]!).players.find(
        (player) => player.id === buyer,
      ),
    ).toMatchObject({ revealedVictoryPointCards: 1 });
    assertGameState(next);
  });

  test("a Knight before rolling moves the robber and a third Knight takes Largest Army", () => {
    const played: GameState = { ...createPlayedGame("play-knight"), phase: { kind: "roll" } };
    const player = played.activePlayerId;
    const state = withDevelopmentCard(withPlayedKnights(played, player, 2), player, "knight");

    expect(getLegalActions(state, player).playableDevelopmentCards).toContain("knight");
    const next = applyCommand(state, player, { kind: "play_knight" });

    expect(next.phase).toEqual({ kind: "move_robber", resumePhase: "roll" });
    expect(playerById(next, player).playedDevelopmentCards).toEqual(["knight", "knight", "knight"]);
    expect(next.largestArmyPlayerId).toBe(player);
    expect(playerById(next, player).victoryPoints).toBe(
      playerById(state, player).victoryPoints + 2,
    );
    assertGameState(next);
  });

  test("Largest Army changes hands only for a strictly larger army", () => {
    const played = createPlayedGame("largest-army-transfer");
    const challenger = played.activePlayerId;
    const holder = opponentsOf(played, challenger)[0]!;
    const state = withDevelopmentCard(
      withPlayedKnights(withPlayedKnights(played, holder, 3), challenger, 2),
      challenger,
      "knight",
    );
    expect(state.largestArmyPlayerId).toBe(holder);

    const tied = applyCommand(state, challenger, { kind: "play_knight" });
    expect(tied.largestArmyPlayerId).toBe(holder);

    const nextTurn = withDevelopmentCard(
      { ...tied, developmentCardPlayedThisTurn: false, phase: { kind: "build_and_trade" } },
      challenger,
      "knight",
    );
    const overtaken = applyCommand(nextTurn, challenger, { kind: "play_knight" });

    expect(overtaken.largestArmyPlayerId).toBe(challenger);
    expect(playerById(overtaken, holder).victoryPoints).toBe(
      playerById(tied, holder).victoryPoints - 2,
    );
    assertGameState(overtaken);
  });

  test("Monopoly collects the named resource from every opponent", () => {
    const played = createPlayedGame("play-monopoly");
    const player = played.activePlayerId;
    const [first, second] = opponentsOf(played, player);
    const state = withDevelopmentCard(
      withHand(withHand(withHand(played, player, {}), first!, { brick: 2, wheat: 1 }), second!, {
        brick: 1,
      }),
      player,
      "monopoly",
    );
    const opponentBrick = opponentsOf(state, player).reduce(
      (total, opponentId) => total + playerById(state, opponentId).resources.brick,
      0,
    );

    const next = applyCommand(state, player, { kind: "play_monopoly", resource: "brick" });

    expect(playerById(next, player).resources.brick).toBe(opponentBrick);
    for (const opponentId of opponentsOf(next, player)) {
      expect(playerById(next, opponentId).resources.brick).toBe(0);
    }
    expect(playerById(next, first!).resources.wheat).toBe(1);
    assertGameState(next);
  });

  test("Year of Plenty takes two chosen cards, if the bank has them", () => {
    const played: GameState = {
      ...createPlayedGame("play-year-of-plenty"),
      phase: { kind: "roll" },
    };
    const player = played.activePlayerId;
    const state = withDevelopmentCard(withHand(played, player, {}), player, "year-of-plenty");
    const resources = { ...emptyInventory(), brick: 1, wheat: 1 };

    const next = applyCommand(state, player, { kind: "play_year_of_plenty", resources });

    expect(playerById(next, player).resources).toEqual(resources);
    expect(next.bank).toEqual(subtractResources(state.bank, resources));
    expect(next.phase.kind).toBe("roll");
    assertGameState(next);

    const scarceWheat = withCardsFromBank(state, opponentsOf(state, player)[0]!, {
      wheat: state.bank.wheat - 1,
    });
    expect(() =>
      applyCommand(state, player, {
        kind: "play_year_of_plenty",
        resources: { ...emptyInventory(), wheat: 1 },
      }),
    ).toThrow(ruleError("INVALID_COMMAND"));
    expect(() =>
      applyCommand(scarceWheat, player, {
        kind: "play_year_of_plenty",
        resources: { ...emptyInventory(), wheat: 2 },
      }),
    ).toThrow(ruleError("BANK_OUT_OF_RESOURCE"));
  });

  test("Road Building places two connected roads for free and resumes the prior phase", () => {
    const played: GameState = {
      ...createPlayedGame("play-road-building"),
      phase: { kind: "roll" },
    };
    const player = played.activePlayerId;
    let state = applyCommand(withDevelopmentCard(played, player, "road-building"), player, {
      kind: "play_road_building",
    });

    expect(state.phase).toEqual({ kind: "road_building", remainingRoads: 2, resumePhase: "roll" });
    for (let placed = 0; placed < 2; placed += 1) {
      const edgeKey = getLegalActions(state, player).roadEdgeKeys[0]!;
      state = applyCommand(state, player, { edgeKey, kind: "place_road" });
    }

    expect(state.phase).toEqual({ kind: "roll" });
    expect(state.board.roads).toHaveLength(played.board.roads.length + 2);
    expect(playerById(state, player).resources).toEqual(playerById(played, player).resources);
    expect(playerById(state, player).playedDevelopmentCards).toEqual(["road-building"]);
    assertGameState(state);
  });

  test("blocks a card bought this turn and a second card in the same turn", () => {
    const played: GameState = {
      ...createPlayedGame("new-development-card"),
      phase: { kind: "roll" },
    };
    const player = played.activePlayerId;
    const monopoly: GameCommand = { kind: "play_monopoly", resource: "brick" };
    const boughtThisTurn: GameState = {
      ...withDevelopmentCard(played, player, "monopoly"),
      developmentCardsBoughtThisTurn: 1,
    };
    const alreadyPlayed: GameState = {
      ...boughtThisTurn,
      developmentCardPlayedThisTurn: true,
      developmentCardsBoughtThisTurn: 0,
    };

    for (const state of [boughtThisTurn, alreadyPlayed]) {
      expect(getLegalActions(state, player).playableDevelopmentCards).toEqual([]);
      expect(() => applyCommand(state, player, monopoly)).toThrow(
        ruleError("DEVELOPMENT_CARD_NOT_PLAYABLE"),
      );
    }

    const ended = applyCommand({ ...alreadyPlayed, phase: { kind: "build_and_trade" } }, player, {
      kind: "end_turn",
    });
    expect(ended.developmentCardPlayedThisTurn).toBe(false);
    expect(ended.developmentCardsBoughtThisTurn).toBe(0);
  });
});

describe("robber", () => {
  function robberTurn(state: GameState): GameState {
    return {
      ...state,
      phase: { kind: "move_robber", resumePhase: "build_and_trade" },
      settings: { ...state.settings, friendlyRobber: false },
    };
  }

  test("standard games may target any tile next to a player", () => {
    const state = robberTurn(createPlayedGame("standard-robber"));
    const topology = getBoardTopology(state.board.tiles);
    const occupiedTileIds = state.board.tiles
      .filter(
        (tile) =>
          tile.id !== state.board.robberTileId &&
          tileAdjacentBuildings(state, topology, tile.id).length > 0,
      )
      .map((tile) => tile.id);

    expect(getLegalActions(state, state.activePlayerId).robberTileIds).toEqual(
      expect.arrayContaining(occupiedTileIds),
    );
  });

  test("steals at once from a lone victim and asks when several players are eligible", () => {
    const played = robberTurn(createPlayedGame("robber-theft"));
    const thief = played.activePlayerId;
    const topology = getBoardTopology(played.board.tiles);
    const state = opponentsOf(played, thief).reduce(
      (current, opponentId) => withHand(current, opponentId, { brick: 1 }),
      withHand(played, thief, {}),
    );
    const victimsAt = (tileId: string) => [
      ...new Set(
        tileAdjacentBuildings(state, topology, tileId)
          .map((building) => building.playerId)
          .filter((playerId) => playerId !== thief),
      ),
    ];
    const candidateTiles = state.board.tiles.filter((tile) => tile.id !== state.board.robberTileId);
    const loneTile = candidateTiles.find((tile) => victimsAt(tile.id).length === 1)!;
    const sharedTile = candidateTiles.find((tile) => victimsAt(tile.id).length > 1)!;

    const stolen = applyCommand(state, thief, { kind: "move_robber", tileId: loneTile.id });
    expect(stolen.phase).toEqual({ kind: "build_and_trade" });
    expect(playerById(stolen, thief).resources).toEqual({ ...emptyInventory(), brick: 1 });
    expect(playerById(stolen, victimsAt(loneTile.id)[0]!).resources).toEqual(emptyInventory());
    assertGameState(stolen);

    const choosing = applyCommand(state, thief, { kind: "move_robber", tileId: sharedTile.id });
    expect(choosing.phase).toEqual({
      eligibleVictimIds: state.players
        .map((player) => player.id)
        .filter((playerId) => victimsAt(sharedTile.id).includes(playerId)),
      kind: "steal",
      resumePhase: "build_and_trade",
    });
    expect(choosing.randomIndex).toBe(state.randomIndex);
    assertGameState(choosing);
  });

  test("the friendly robber spares the tiles and hands of players with 2 or fewer points", () => {
    const played = createPlayedGame("friendly-robber", { friendlyRobber: true });
    const thief = played.activePlayerId;
    const target = opponentsOf(played, thief)[0]!;
    const pieces = boardPieces(played);
    const [cityVertexKey, ...settlements] = pieces[target]!.settlements;
    const state: GameState = {
      ...withHand(
        withBoardPieces(played, {
          ...pieces,
          [target]: { ...pieces[target]!, cities: [cityVertexKey!], settlements },
        }),
        target,
        { brick: 1 },
      ),
      phase: { kind: "move_robber", resumePhase: "build_and_trade" },
    };
    assertGameState(state);
    const topology = getBoardTopology(state.board.tiles);
    const touchesOnlyTarget = (tileId: string) =>
      tileAdjacentBuildings(state, topology, tileId).every(
        (building) => building.playerId === target,
      );
    const candidateTileIds = state.board.tiles
      .map((tile) => tile.id)
      .filter((tileId) => tileId !== state.board.robberTileId);
    const unprotectedTileIds = candidateTileIds.filter(touchesOnlyTarget);
    const protectedTileId = candidateTileIds.find((tileId) => !touchesOnlyTarget(tileId))!;
    const targetTileId = unprotectedTileIds.find(
      (tileId) => tileAdjacentBuildings(state, topology, tileId).length > 0,
    )!;

    expect(targetTileId).toBeDefined();
    expect(getLegalActions(state, thief).robberTileIds).toEqual(unprotectedTileIds);
    expect(() =>
      applyCommand(state, thief, { kind: "move_robber", tileId: protectedTileId }),
    ).toThrow(ruleError("INVALID_ROBBER_TILE"));

    const robbed = applyCommand(state, thief, { kind: "move_robber", tileId: targetTileId });
    expect(handChange(state, robbed, thief)).toEqual({ ...emptyInventory(), brick: 1 });
    expect(playerById(robbed, target).resources).toEqual(emptyInventory());
  });

  test("the friendly robber still moves when every tile touches a protected player", () => {
    const game = createGame("friendly-robber-fallback", { friendlyRobber: true });
    const topology = getBoardTopology(game.board.tiles);
    const uncoveredTileIds = new Set(
      game.board.tiles
        .map((tile) => tile.id)
        .filter((tileId) => tileId !== game.board.robberTileId),
    );
    const settlements: string[] = [];
    while (uncoveredTileIds.size > 0) {
      const blocked = surroundings(topology, settlements);
      const coverage = (vertexKey: string) =>
        topology.vertexTileIds[vertexKey]!.filter((tileId) => uncoveredTileIds.has(tileId)).length;
      const vertexKey = topology.vertexKeys
        .filter((candidate) => !blocked.has(candidate))
        .toSorted((first, second) => coverage(second) - coverage(first))[0]!;
      settlements.push(vertexKey);
      for (const tileId of topology.vertexTileIds[vertexKey]!) uncoveredTileIds.delete(tileId);
    }
    expect(settlements.length).toBeLessThanOrEqual(game.players.length * 2);
    const roadAt = (vertexKey: string) => topology.vertexEdges[vertexKey]![0]!;
    const thief = game.activePlayerId;
    const state: GameState = {
      ...opponentsOf(game, thief).reduce(
        (current, opponentId) => withHand(current, opponentId, { brick: 1 }),
        withBoardPieces(
          game,
          Object.fromEntries(
            game.turnOrder.map((playerId, index) => {
              const owned = settlements.slice(index * 2, index * 2 + 2);
              const fallback = getSettlementVertexKeys(game, playerId, false).filter(
                (vertexKey) => !surroundings(topology, settlements).has(vertexKey),
              );
              const vertexKeys = [...owned, ...fallback].slice(0, 2);
              return [playerId, { roads: vertexKeys.map(roadAt), settlements: vertexKeys }];
            }),
          ),
        ),
      ),
      phase: { kind: "move_robber", resumePhase: "build_and_trade" },
    };
    assertGameState(state);

    const legalTileIds = getLegalActions(state, thief).robberTileIds;
    expect(legalTileIds).toHaveLength(state.board.tiles.length - 1);

    const opponentTileId = legalTileIds.find((tileId) =>
      tileAdjacentBuildings(state, topology, tileId).some(
        (building) => building.playerId !== thief,
      ),
    )!;
    const moved = applyCommand(state, thief, { kind: "move_robber", tileId: opponentTileId });
    expect(moved.board.robberTileId).toBe(opponentTileId);
    expect(moved.phase).toEqual({ kind: "build_and_trade" });
    expect(moved.players).toEqual(state.players);
  });
});

describe("automated decisions", () => {
  test("a timed-out human never spends cards on an optional build", () => {
    const played = createPlayedGame("human-timeout-build", {}, HUMANS);
    const state = withHand(played, played.activePlayerId, BUILD_COSTS.city);

    expect(chooseAutomatedCommand(state, state.activePlayerId)).toEqual({ kind: "end_turn" });
  });

  test("a timed-out human settles the most productive spot and robs someone else's tile", () => {
    const game = createGame("human-timeout-choices", {}, HUMANS);
    const topology = getBoardTopology(game.board.tiles);
    const pips = (vertexKey: string) =>
      topology.vertexTileIds[vertexKey]!.reduce((total, tileId) => {
        const token = game.board.tiles.find((tile) => tile.id === tileId)!.numberToken;
        return total + (token === null ? 0 : NUMBER_TOKEN_PIPS[token]);
      }, 0);
    const settlement = chooseAutomatedCommand(game, game.activePlayerId);
    if (settlement.kind !== "place_settlement") throw new Error("Expected a settlement");

    expect(pips(settlement.vertexKey)).toBe(
      Math.max(...getLegalActions(game, game.activePlayerId).settlementVertexKeys.map(pips)),
    );

    const played: GameState = {
      ...createPlayedGame("human-timeout-robber", {}, HUMANS),
      phase: { kind: "move_robber", resumePhase: "build_and_trade" },
    };
    const robber = chooseAutomatedCommand(played, played.activePlayerId);
    if (robber.kind !== "move_robber") throw new Error("Expected a robber move");
    expect(
      tileAdjacentBuildings(played, topology, robber.tileId).filter(
        (building) => building.playerId === played.activePlayerId,
      ),
    ).toEqual([]);
  });

  test("the fallback takes only required actions, choosing the first legal option", () => {
    const game = createGame("fallback-command");
    const played = createPlayedGame("fallback-command");
    const bot = played.activePlayerId;
    const rolling: GameState = {
      ...withDevelopmentCard(played, bot, "knight"),
      phase: { kind: "roll" },
    };
    const building = withHand(played, bot, BUILD_COSTS.city);
    const recipient = opponentsOf(building, bot)[0]!;
    const offered = applyCommand(withHand(building, recipient, { wheat: 1 }), bot, {
      give: { ...emptyInventory(), stone: 1 },
      kind: "propose_trade",
      recipientPlayerIds: [recipient],
      want: { ...emptyInventory(), wheat: 1 },
    });

    expect(chooseFallbackCommand(game, game.activePlayerId)).toEqual({
      kind: "place_settlement",
      vertexKey: getLegalActions(game, game.activePlayerId).settlementVertexKeys[0]!,
    });
    expect(chooseFallbackCommand(rolling, bot)).toEqual({ kind: "roll" });
    expect(chooseFallbackCommand(building, bot)).toEqual({ kind: "end_turn" });
    expect(chooseFallbackCommand(offered, recipient)).toMatchObject({
      accept: false,
      kind: "respond_trade",
    });
  });

  test("easy and medium bots vary deterministic robber destinations", () => {
    for (const botDifficulty of ["easy", "medium"] as const) {
      const played = createPlayedGame(`robber-destinations-${botDifficulty}`);
      const botId = played.activePlayerId;
      let state: GameState = {
        ...played,
        phase: { kind: "move_robber", resumePhase: "build_and_trade" },
        players: played.players.map((player) =>
          player.id === botId ? { ...player, botDifficulty } : player,
        ),
      };
      const destinations = new Set<string>();

      for (let move = 0; move < 20; move += 1) {
        const command = chooseAutomatedCommand(state, botId);
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

  test("bots choose Monopoly from public information, not opponents' hidden hands", () => {
    const played = createPlayedGame("monopoly-public-information");
    const bot = played.activePlayerId;
    const [first, second] = opponentsOf(played, bot);
    const base = withDevelopmentCard(withHand(played, bot, {}), bot, "monopoly");
    const holding = (resource: "brick" | "stone") =>
      withHand(withHand(base, first!, { [resource]: 4 }), second!, { [resource]: 2 });

    expect(chooseAutomatedCommand(holding("brick"), bot)).toEqual(
      chooseAutomatedCommand(holding("stone"), bot),
    );
  });

  test("bots take the Year of Plenty cards their next build is missing", () => {
    const played: GameState = {
      ...createPlayedGame("year-of-plenty-need"),
      phase: { kind: "roll" },
    };
    const bot = played.activePlayerId;
    const state = withDevelopmentCard(
      withHand(played, bot, { stone: 1, wheat: 2 }),
      bot,
      "year-of-plenty",
    );

    expect(chooseAutomatedCommand(state, bot)).toEqual({
      kind: "play_year_of_plenty",
      resources: { ...emptyInventory(), stone: 2 },
    });
  });

  test("bots accept only trades that bring their next build closer, and never help a near-winner", () => {
    const played = createPlayedGame("bot-trade-response");
    const proposer = played.activePlayerId;
    const bot = opponentsOf(played, proposer)[0]!;
    const table = withHand(withHand(played, proposer, { stone: 1, tree: 1 }), bot, {
      sheep: 1,
      stone: 2,
      wheat: 2,
    });
    const response = (
      state: GameState,
      give: Partial<ResourceInventory>,
      want: Partial<ResourceInventory>,
    ) =>
      chooseAutomatedCommand(
        applyCommand(state, proposer, {
          give: { ...emptyInventory(), ...give },
          kind: "propose_trade",
          recipientPlayerIds: [bot],
          want: { ...emptyInventory(), ...want },
        }),
        bot,
      );
    const nearWinner: GameState = {
      ...table,
      settings: { ...table.settings, victoryPoints: playerById(table, proposer).victoryPoints + 2 },
    };

    expect(response(table, { stone: 1 }, { sheep: 1 })).toMatchObject({ accept: true });
    expect(response(table, { tree: 1 }, { stone: 1 })).toMatchObject({ accept: false });
    expect(response(nearWinner, { stone: 1 }, { sheep: 1 })).toMatchObject({ accept: false });
  });

  test("easy bots use targeted trades instead of cycling or starving forever", () => {
    const players = makePlayers(3).map((player) => ({ ...player, botDifficulty: "easy" as const }));
    const finished = playEntireGame(createGame("audit:base:easy:0", {}, players));

    expect(finished.phase.kind).toBe("finished");
    expect(finished.winnerPlayerId).not.toBeNull();
  });

  test.each([
    ["base", 4],
    ["extended-6", 6],
    ["extended-8", 8],
  ] as const)("bots finish a %s game with every state valid", (map, playerCount) => {
    const finished = playEntireGame(
      createGame(`rules-audit-${map}`, { map }, makePlayers(playerCount)),
    );

    expect(finished.phase.kind).toBe("finished");
    expect(finished.winnerPlayerId).not.toBeNull();
  });
});
