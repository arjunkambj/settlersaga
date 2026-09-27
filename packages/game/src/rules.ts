import {
  ANY_PORT_TRADE_RATIO,
  BANK_TRADE_RATIO,
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  FRIENDLY_ROBBER_MAX_VICTORY_POINTS,
  RESOURCE_ORDER,
  RESOURCE_PORT_TRADE_RATIO,
  TERRAIN_RESOURCE,
} from "./constants";
import { reconcileLargestArmyAward } from "./largest-army";
import { reconcileLongestRoadAward } from "./longest-road";
import { createBalancedDiceBag, deterministicInteger } from "./random";
import {
  addResources,
  emptyInventory,
  hasResources,
  isValidInventory,
  subtractResources,
  totalResources,
} from "./resources";
import { getBoardTopology, type BoardTopology } from "./topology";
import { GameRuleError, RESOURCE_TYPES, isPlayableDevelopmentCard } from "./types";
import type {
  GameCommand,
  GameRuleErrorCode,
  GameState,
  LegalActions,
  PlayableDevelopmentCardType,
  PlayerId,
  PlayerState,
  PortTrade,
  ResourceInventory,
  ResourceType,
  TradeOffer,
} from "./types";

// Reshuffling while a few rolls remain keeps the end of each cycle from being countable.
const BALANCED_DICE_RESHUFFLE_AT = 5;
const ROAD_BUILDING_ROADS = 2;
const YEAR_OF_PLENTY_CARDS = 2;

function fail(code: GameRuleErrorCode, message: string): never {
  throw new GameRuleError(code, message);
}

export function requirePlayer(state: Pick<GameState, "players">, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    fail("UNKNOWN_PLAYER", `Unknown player: ${playerId}`);
  }

  return player;
}

export function boardTopology(state: Pick<GameState, "board">): BoardTopology {
  return getBoardTopology(state.board.tiles);
}

/** Seat positions in turn order for the snake draft: 0..n-1, then n-1..0. */
export function getSetupSeatOrder(playerCount: number): number[] {
  const ascending = Array.from({ length: playerCount }, (_, index) => index);
  return [...ascending, ...[...ascending].reverse()];
}

function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player)),
  };
}

function updateResources(
  state: GameState,
  playerId: PlayerId,
  update: (resources: ResourceInventory) => ResourceInventory,
): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    resources: update(player.resources),
  }));
}

function buildingAt(state: Pick<GameState, "board">, vertexKey: string) {
  return state.board.buildings.find((building) => building.vertexKey === vertexKey);
}

function roadAt(state: Pick<GameState, "board">, edgeKey: string) {
  return state.board.roads.find((road) => road.edgeKey === edgeKey);
}

function playerOwnsPort(state: Pick<GameState, "board">, playerId: PlayerId, trade: PortTrade) {
  const topology = boardTopology(state);

  return state.board.ports.some(
    (port) =>
      port.trade === trade &&
      topology.edgeVertices[port.edgeKey]!.some(
        (vertexKey) => buildingAt(state, vertexKey)?.playerId === playerId,
      ),
  );
}

function getBankTradeRatio(
  state: Pick<GameState, "board">,
  playerId: PlayerId,
  give: ResourceType,
) {
  if (playerOwnsPort(state, playerId, give)) {
    return RESOURCE_PORT_TRADE_RATIO;
  }

  return playerOwnsPort(state, playerId, "any") ? ANY_PORT_TRADE_RATIO : BANK_TRADE_RATIO;
}

function followsDistanceRule(state: GameState, topology: BoardTopology, vertexKey: string) {
  return topology.vertexNeighbors[vertexKey]!.every((neighbor) => !buildingAt(state, neighbor));
}

function hasPlayerRoadAtVertex(
  state: GameState,
  topology: BoardTopology,
  playerId: PlayerId,
  vertexKey: string,
) {
  return topology.vertexEdges[vertexKey]!.some(
    (edgeKey) => roadAt(state, edgeKey)?.playerId === playerId,
  );
}

function roadConnectsToPlayer(
  state: GameState,
  topology: BoardTopology,
  playerId: PlayerId,
  edgeKey: string,
) {
  return topology.edgeVertices[edgeKey]!.some((vertexKey) => {
    const building = buildingAt(state, vertexKey);

    if (building) {
      return building.playerId === playerId;
    }

    return hasPlayerRoadAtVertex(state, topology, playerId, vertexKey);
  });
}

export function getSettlementVertexKeys(
  state: GameState,
  playerId: PlayerId,
  requiresRoad: boolean,
) {
  const topology = boardTopology(state);

  return topology.vertexKeys.filter(
    (vertexKey) =>
      !buildingAt(state, vertexKey) &&
      followsDistanceRule(state, topology, vertexKey) &&
      (!requiresRoad || hasPlayerRoadAtVertex(state, topology, playerId, vertexKey)),
  );
}

export function getRoadEdgeKeys(state: GameState, playerId: PlayerId) {
  const topology = boardTopology(state);

  return topology.edgeKeys.filter(
    (edgeKey) =>
      !roadAt(state, edgeKey) && roadConnectsToPlayer(state, topology, playerId, edgeKey),
  );
}

export function getCityVertexKeys(state: GameState, playerId: PlayerId) {
  return state.board.buildings
    .filter((building) => building.playerId === playerId && building.kind === "settlement")
    .map((building) => building.vertexKey)
    .sort();
}

function payCost(
  state: GameState,
  playerId: PlayerId,
  cost: Readonly<ResourceInventory>,
): GameState {
  if (!hasResources(requirePlayer(state, playerId).resources, cost)) {
    fail("INSUFFICIENT_RESOURCES", "Player cannot afford this action");
  }

  return {
    ...updateResources(state, playerId, (resources) => subtractResources(resources, cost)),
    bank: addResources(state.bank, cost),
  };
}

function addBuilding(state: GameState, playerId: PlayerId, vertexKey: string): GameState {
  const withBuilding = updatePlayer(state, playerId, (player) => ({
    ...player,
    piecesRemaining: {
      ...player.piecesRemaining,
      settlements: player.piecesRemaining.settlements - 1,
    },
    victoryPoints: player.victoryPoints + 1,
  }));

  return reconcileLongestRoadAward({
    ...withBuilding,
    board: {
      ...state.board,
      buildings: [...state.board.buildings, { kind: "settlement", playerId, vertexKey }],
    },
  });
}

function addRoad(state: GameState, playerId: PlayerId, edgeKey: string): GameState {
  const withRoad = updatePlayer(state, playerId, (player) => ({
    ...player,
    piecesRemaining: {
      ...player.piecesRemaining,
      roads: player.piecesRemaining.roads - 1,
    },
  }));

  return reconcileLongestRoadAward({
    ...withRoad,
    board: {
      ...state.board,
      roads: [...state.board.roads, { edgeKey, playerId }],
    },
  });
}

function grantSecondSettlementResources(
  state: GameState,
  playerId: PlayerId,
  vertexKey: string,
): GameState {
  const granted = emptyInventory();

  for (const tileId of boardTopology(state).vertexTileIds[vertexKey]!) {
    const tile = state.board.tiles.find((candidate) => candidate.id === tileId)!;
    const resource = TERRAIN_RESOURCE[tile.terrain];

    if (resource && state.bank[resource] > granted[resource]) {
      granted[resource] += 1;
    }
  }

  return {
    ...updateResources(state, playerId, (resources) => addResources(resources, granted)),
    bank: subtractResources(state.bank, granted),
  };
}

/** A player wins only on their own turn, counting their unrevealed victory-point cards. */
function finishIfWinner(state: GameState, playerId: PlayerId): GameState {
  const player = requirePlayer(state, playerId);
  const hiddenVictoryPoints = player.developmentCards.filter(
    (card) => card === "victory-point",
  ).length;

  if (player.victoryPoints + hiddenVictoryPoints < state.settings.victoryPoints) {
    return state;
  }

  return {
    ...state,
    phase: { kind: "finished" },
    tradeOffer: null,
    winnerPlayerId: playerId,
  };
}

function requirePlaceablePiece(player: PlayerState, piece: keyof PlayerState["piecesRemaining"]) {
  if (player.piecesRemaining[piece] <= 0) {
    fail("NO_PIECE_AVAILABLE", `Player has no ${piece} remaining`);
  }
}

function placeSettlement(state: GameState, playerId: PlayerId, vertexKey: string): GameState {
  const { phase } = state;
  if (phase.kind !== "setup_settlement" && phase.kind !== "build_and_trade") {
    fail("INVALID_PHASE", "Settlements cannot be placed in this phase");
  }

  const topology = boardTopology(state);
  if (!Object.hasOwn(topology.vertexNeighbors, vertexKey)) {
    fail("INVALID_LOCATION", `Unknown vertex: ${vertexKey}`);
  }
  if (buildingAt(state, vertexKey)) {
    fail("LOCATION_OCCUPIED", "The vertex already contains a building");
  }
  if (!followsDistanceRule(state, topology, vertexKey)) {
    fail("DISTANCE_RULE", "Adjacent vertices must remain empty");
  }
  requirePlaceablePiece(requirePlayer(state, playerId), "settlements");

  if (phase.kind === "setup_settlement") {
    const withSettlement = addBuilding(state, playerId, vertexKey);
    const isSecondSettlement = phase.setupIndex >= state.players.length;

    return {
      ...(isSecondSettlement
        ? grantSecondSettlementResources(withSettlement, playerId, vertexKey)
        : withSettlement),
      phase: { kind: "setup_road", settlementVertexKey: vertexKey, setupIndex: phase.setupIndex },
    };
  }

  if (!hasPlayerRoadAtVertex(state, topology, playerId, vertexKey)) {
    fail("ROAD_NOT_CONNECTED", "Settlement must connect to the player's road");
  }

  return addBuilding(payCost(state, playerId, BUILD_COSTS.settlement), playerId, vertexKey);
}

function finishSetupRoad(state: GameState, setupIndex: number): GameState {
  const setupSeatOrder = getSetupSeatOrder(state.players.length);
  const nextSetupIndex = setupIndex + 1;

  if (nextSetupIndex < setupSeatOrder.length) {
    return {
      ...state,
      activePlayerId: state.turnOrder[setupSeatOrder[nextSetupIndex]!]!,
      phase: { kind: "setup_settlement", setupIndex: nextSetupIndex },
    };
  }

  return {
    ...state,
    activePlayerId: state.turnOrder[0]!,
    phase: { kind: "roll" },
    turnNumber: 1,
  };
}

function placeRoad(state: GameState, playerId: PlayerId, edgeKey: string): GameState {
  const { phase } = state;
  if (
    phase.kind !== "setup_road" &&
    phase.kind !== "road_building" &&
    phase.kind !== "build_and_trade"
  ) {
    fail("INVALID_PHASE", "Roads cannot be placed in this phase");
  }

  const topology = boardTopology(state);
  if (!Object.hasOwn(topology.edgeVertices, edgeKey)) {
    fail("INVALID_LOCATION", `Unknown edge: ${edgeKey}`);
  }
  if (roadAt(state, edgeKey)) {
    fail("LOCATION_OCCUPIED", "The edge already contains a road");
  }
  requirePlaceablePiece(requirePlayer(state, playerId), "roads");

  if (phase.kind === "setup_road") {
    if (!topology.edgeVertices[edgeKey]!.includes(phase.settlementVertexKey)) {
      fail("ROAD_NOT_CONNECTED", "Setup road must touch the new settlement");
    }

    return finishSetupRoad(addRoad(state, playerId, edgeKey), phase.setupIndex);
  }

  if (!roadConnectsToPlayer(state, topology, playerId, edgeKey)) {
    fail("ROAD_NOT_CONNECTED", "Road must connect to the player's network");
  }

  if (phase.kind === "build_and_trade") {
    return addRoad(payCost(state, playerId, BUILD_COSTS.road), playerId, edgeKey);
  }

  const withRoad = addRoad(state, playerId, edgeKey);
  const remainingRoads = phase.remainingRoads - 1;
  const canContinue =
    remainingRoads > 0 &&
    requirePlayer(withRoad, playerId).piecesRemaining.roads > 0 &&
    getRoadEdgeKeys(withRoad, playerId).length > 0;

  return {
    ...withRoad,
    phase: canContinue
      ? { kind: "road_building", remainingRoads, resumePhase: phase.resumePhase }
      : { kind: phase.resumePhase },
  };
}

function buildCity(state: GameState, playerId: PlayerId, vertexKey: string): GameState {
  if (state.phase.kind !== "build_and_trade") {
    fail("INVALID_PHASE", "Cities cannot be built in this phase");
  }

  const building = buildingAt(state, vertexKey);
  if (building?.playerId !== playerId || building.kind !== "settlement") {
    fail("INVALID_LOCATION", "City must replace the player's settlement");
  }
  requirePlaceablePiece(requirePlayer(state, playerId), "cities");

  const paid = payCost(state, playerId, BUILD_COSTS.city);
  return updatePlayer(
    {
      ...paid,
      board: {
        ...paid.board,
        buildings: paid.board.buildings.map((candidate) =>
          candidate.vertexKey === vertexKey ? { ...candidate, kind: "city" } : candidate,
        ),
      },
    },
    playerId,
    (player) => ({
      ...player,
      piecesRemaining: {
        ...player.piecesRemaining,
        cities: player.piecesRemaining.cities - 1,
        settlements: player.piecesRemaining.settlements + 1,
      },
      victoryPoints: player.victoryPoints + 1,
    }),
  );
}

function buyDevelopmentCard(state: GameState, playerId: PlayerId): GameState {
  if (state.phase.kind !== "build_and_trade") {
    fail("INVALID_PHASE", "Development cards cannot be bought in this phase");
  }

  const [card, ...developmentDeck] = state.developmentDeck;
  if (!card) {
    fail("NO_DEVELOPMENT_CARD_AVAILABLE", "No development cards remain");
  }

  const paid = payCost(state, playerId, DEVELOPMENT_CARD_COST);
  return updatePlayer(
    {
      ...paid,
      developmentCardsBoughtThisTurn: paid.developmentCardsBoughtThisTurn + 1,
      developmentDeck,
    },
    playerId,
    (player) => ({ ...player, developmentCards: [...player.developmentCards, card] }),
  );
}

function playableDevelopmentCards(
  state: GameState,
  player: PlayerState,
  hideBankStock: boolean,
): PlayableDevelopmentCardType[] {
  if (
    state.developmentCardPlayedThisTurn ||
    (state.phase.kind !== "roll" && state.phase.kind !== "build_and_trade") ||
    state.activePlayerId !== player.id
  ) {
    return [];
  }

  // Cards bought this turn sit at the end of the hand and cannot be played yet.
  const playableHand = player.developmentCards.slice(
    0,
    player.developmentCards.length - state.developmentCardsBoughtThisTurn,
  );
  const cards = new Set(playableHand.filter(isPlayableDevelopmentCard));

  if (player.piecesRemaining.roads === 0 || getRoadEdgeKeys(state, player.id).length === 0) {
    cards.delete("road-building");
  }
  if (!hideBankStock && totalResources(state.bank) < YEAR_OF_PLENTY_CARDS) {
    cards.delete("year-of-plenty");
  }

  return [...cards];
}

function consumeDevelopmentCard(
  state: GameState,
  playerId: PlayerId,
  card: PlayableDevelopmentCardType,
): GameState {
  const player = requirePlayer(state, playerId);
  if (!playableDevelopmentCards(state, player, false).includes(card)) {
    fail("DEVELOPMENT_CARD_NOT_PLAYABLE", "This development card cannot be played right now");
  }

  // Playable cards form a prefix of the hand, so the first copy is always one of them.
  const cardIndex = player.developmentCards.indexOf(card);
  return updatePlayer(
    { ...state, developmentCardPlayedThisTurn: true, tradeOffer: null },
    playerId,
    (current) => ({
      ...current,
      developmentCards: current.developmentCards.filter((_, index) => index !== cardIndex),
      playedDevelopmentCards: [...current.playedDevelopmentCards, card],
    }),
  );
}

function requireResumablePhase(state: GameState) {
  const resumePhase = state.phase.kind;
  if (resumePhase !== "roll" && resumePhase !== "build_and_trade") {
    fail("INVALID_PHASE", "Development cards can only be played before or after rolling");
  }
  return resumePhase;
}

function playKnight(state: GameState, playerId: PlayerId): GameState {
  const resumePhase = requireResumablePhase(state);

  return {
    ...reconcileLargestArmyAward(consumeDevelopmentCard(state, playerId, "knight")),
    phase: { kind: "move_robber", resumePhase },
  };
}

function playMonopoly(state: GameState, playerId: PlayerId, resource: ResourceType): GameState {
  const consumed = consumeDevelopmentCard(state, playerId, "monopoly");
  const collected = consumed.players.reduce(
    (total, player) => total + (player.id === playerId ? 0 : player.resources[resource]),
    0,
  );

  return {
    ...consumed,
    players: consumed.players.map((player) => ({
      ...player,
      resources: {
        ...player.resources,
        [resource]: player.id === playerId ? player.resources[resource] + collected : 0,
      },
    })),
  };
}

function playRoadBuilding(state: GameState, playerId: PlayerId): GameState {
  const resumePhase = requireResumablePhase(state);
  const consumed = consumeDevelopmentCard(state, playerId, "road-building");

  return {
    ...consumed,
    phase: {
      kind: "road_building",
      remainingRoads: Math.min(
        ROAD_BUILDING_ROADS,
        requirePlayer(consumed, playerId).piecesRemaining.roads,
      ),
      resumePhase,
    },
  };
}

function playYearOfPlenty(
  state: GameState,
  playerId: PlayerId,
  resources: ResourceInventory,
): GameState {
  if (!isValidInventory(resources) || totalResources(resources) !== YEAR_OF_PLENTY_CARDS) {
    fail("INVALID_COMMAND", "Year of Plenty must select exactly two resource cards");
  }
  if (!hasResources(state.bank, resources)) {
    fail("BANK_OUT_OF_RESOURCE", "The bank does not have the selected resource cards");
  }

  const consumed = consumeDevelopmentCard(state, playerId, "year-of-plenty");
  return {
    ...updateResources(consumed, playerId, (current) => addResources(current, resources)),
    bank: subtractResources(consumed.bank, resources),
  };
}

/** One tile's payout to one player on a roll, after the bank has covered what it can. */
export interface DiceProduction {
  amount: number;
  playerId: PlayerId;
  resource: ResourceType;
  tileId: string;
}

/**
 * What a roll pays, tile by tile: every tile showing the rolled number, unless the robber sits on
 * it, pays 1 card per settlement and 2 per city at its corners. When the bank cannot cover every
 * claim for a resource, nobody receives it, unless a single player is owed it: they take whatever
 * the bank has left, from their first tiles on.
 */
export function getDiceProduction(
  board: Pick<GameState["board"], "buildings" | "robberTileId" | "tiles">,
  rollTotal: number,
  bank: Readonly<ResourceInventory>,
): DiceProduction[] {
  const topology = getBoardTopology(board.tiles);
  const buildingByVertex = new Map(
    board.buildings.map((building) => [building.vertexKey, building]),
  );
  const production: DiceProduction[] = [];

  for (const tile of board.tiles) {
    const resource = TERRAIN_RESOURCE[tile.terrain];
    if (!resource || tile.numberToken !== rollTotal || tile.id === board.robberTileId) {
      continue;
    }

    const amountByPlayer = new Map<PlayerId, number>();
    for (const vertexKey of topology.tileById[tile.id]!.vertexKeys) {
      const building = buildingByVertex.get(vertexKey);
      if (building) {
        amountByPlayer.set(
          building.playerId,
          (amountByPlayer.get(building.playerId) ?? 0) + (building.kind === "city" ? 2 : 1),
        );
      }
    }
    for (const [playerId, amount] of amountByPlayer) {
      production.push({ amount, playerId, resource, tileId: tile.id });
    }
  }

  for (const resource of RESOURCE_TYPES) {
    const claims = production.filter((claim) => claim.resource === resource);
    const requested = claims.reduce((total, claim) => total + claim.amount, 0);
    if (requested <= bank[resource]) {
      continue;
    }

    const claimantCount = new Set(claims.map((claim) => claim.playerId)).size;
    let remaining = claimantCount === 1 ? bank[resource] : 0;
    for (const claim of claims) {
      claim.amount = Math.min(claim.amount, remaining);
      remaining -= claim.amount;
    }
  }

  return production.filter((claim) => claim.amount > 0);
}

function distributeResourcesForRoll(state: GameState, rollTotal: number): GameState {
  const claims = new Map(state.players.map((player) => [player.id, emptyInventory()]));

  for (const { amount, playerId, resource } of getDiceProduction(
    state.board,
    rollTotal,
    state.bank,
  )) {
    claims.get(playerId)![resource] += amount;
  }

  const paidOut = [...claims.values()].reduce(addResources, emptyInventory());
  return {
    ...state,
    bank: subtractResources(state.bank, paidOut),
    players: state.players.map((player) => ({
      ...player,
      resources: addResources(player.resources, claims.get(player.id)!),
    })),
  };
}

function drawDice(state: GameState) {
  if (!state.settings.balancedDice) {
    const firstDraw = deterministicInteger(state.seed, state.randomIndex, 6);
    const secondDraw = deterministicInteger(state.seed, firstDraw.nextIndex, 6);
    const first = firstDraw.value + 1;
    const second = secondDraw.value + 1;

    return {
      balancedDiceBag: state.balancedDiceBag,
      randomIndex: secondDraw.nextIndex,
      roll: { first, second, sum: first + second },
    };
  }

  const { bag, nextIndex } =
    state.balancedDiceBag.length > BALANCED_DICE_RESHUFFLE_AT
      ? { bag: state.balancedDiceBag, nextIndex: state.randomIndex }
      : createBalancedDiceBag(state.seed, state.randomIndex);
  const [roll, ...balancedDiceBag] = bag;

  return { balancedDiceBag, randomIndex: nextIndex, roll: roll! };
}

function rollDice(state: GameState): GameState {
  if (state.phase.kind !== "roll") {
    fail("INVALID_PHASE", "Dice can only be rolled at the start of a turn");
  }

  const { balancedDiceBag, randomIndex, roll } = drawDice(state);
  const rolled: GameState = { ...state, balancedDiceBag, lastDiceRoll: roll, randomIndex };

  if (roll.sum !== 7) {
    return { ...distributeResourcesForRoll(rolled, roll.sum), phase: { kind: "build_and_trade" } };
  }

  const pending = rolled.players.flatMap((player) => {
    const handSize = totalResources(player.resources);
    return handSize > state.settings.discardLimit
      ? [{ count: Math.floor(handSize / 2), playerId: player.id }]
      : [];
  });

  return {
    ...rolled,
    phase:
      pending.length > 0
        ? { kind: "discard", pending }
        : { kind: "move_robber", resumePhase: "build_and_trade" },
  };
}

function discardResources(
  state: GameState,
  playerId: PlayerId,
  discarded: ResourceInventory,
): GameState {
  if (state.phase.kind !== "discard") {
    fail("INVALID_PHASE", "No discard is currently required");
  }

  const requirement = state.phase.pending.find((pending) => pending.playerId === playerId);
  if (
    !requirement ||
    !isValidInventory(discarded) ||
    totalResources(discarded) !== requirement.count ||
    !hasResources(requirePlayer(state, playerId).resources, discarded)
  ) {
    fail("INVALID_DISCARD", "Discard must exactly match the pending requirement");
  }

  const pending = state.phase.pending.filter((candidate) => candidate.playerId !== playerId);
  return {
    ...updateResources(state, playerId, (resources) => subtractResources(resources, discarded)),
    bank: addResources(state.bank, discarded),
    phase:
      pending.length > 0
        ? { kind: "discard", pending }
        : { kind: "move_robber", resumePhase: "build_and_trade" },
  };
}

function friendlyRobberProtectedPlayerIds(state: GameState) {
  if (!state.settings.friendlyRobber) {
    return new Set<PlayerId>();
  }

  return new Set(
    state.players
      .filter((player) => player.victoryPoints <= FRIENDLY_ROBBER_MAX_VICTORY_POINTS)
      .map((player) => player.id),
  );
}

function robberTileIds(state: GameState) {
  const available = state.board.tiles
    .filter((tile) => tile.id !== state.board.robberTileId)
    .map((tile) => tile.id);
  const protectedPlayerIds = friendlyRobberProtectedPlayerIds(state);

  if (protectedPlayerIds.size === 0) {
    return available;
  }

  const topology = boardTopology(state);
  const friendly = available.filter((tileId) => {
    const adjacentVertices = new Set(topology.tileById[tileId]!.vertexKeys);
    return !state.board.buildings.some(
      (building) =>
        protectedPlayerIds.has(building.playerId) && adjacentVertices.has(building.vertexKey),
    );
  });

  if (friendly.length > 0) {
    return friendly;
  }

  // Every tile touches a protected player: park the robber on a desert when possible.
  const desertTileIds = available.filter((tileId) =>
    state.board.tiles.some((tile) => tile.id === tileId && TERRAIN_RESOURCE[tile.terrain] === null),
  );
  return desertTileIds.length > 0 ? desertTileIds : available;
}

function moveRobber(state: GameState, playerId: PlayerId, tileId: string): GameState {
  if (state.phase.kind !== "move_robber") {
    fail("INVALID_PHASE", "Robber cannot be moved in this phase");
  }
  if (tileId === state.board.robberTileId) {
    fail("ROBBER_TILE_UNCHANGED", "Robber must move to another tile");
  }
  if (!state.board.tiles.some((tile) => tile.id === tileId)) {
    fail("INVALID_ROBBER_TILE", `Unknown robber tile: ${tileId}`);
  }
  if (!robberTileIds(state).includes(tileId)) {
    fail(
      "INVALID_ROBBER_TILE",
      `Friendly robber protects players with ${FRIENDLY_ROBBER_MAX_VICTORY_POINTS} or fewer points`,
    );
  }

  const { resumePhase } = state.phase;
  const adjacentVertices = new Set(boardTopology(state).tileById[tileId]!.vertexKeys);
  const protectedPlayerIds = friendlyRobberProtectedPlayerIds(state);
  const eligibleVictimIds = state.players
    .filter(
      (player) =>
        player.id !== playerId &&
        !protectedPlayerIds.has(player.id) &&
        totalResources(player.resources) > 0 &&
        state.board.buildings.some(
          (building) => building.playerId === player.id && adjacentVertices.has(building.vertexKey),
        ),
    )
    .map((player) => player.id);
  const withRobber: GameState = { ...state, board: { ...state.board, robberTileId: tileId } };

  if (eligibleVictimIds.length === 0) {
    return { ...withRobber, phase: { kind: resumePhase } };
  }

  const awaitingVictim: GameState = {
    ...withRobber,
    phase: { eligibleVictimIds, kind: "steal", resumePhase },
  };
  return eligibleVictimIds.length === 1
    ? stealResource(awaitingVictim, playerId, eligibleVictimIds[0]!)
    : awaitingVictim;
}

function sampleResource(resources: ResourceInventory, cardIndex: number): ResourceType {
  let remaining = cardIndex;

  for (const resource of RESOURCE_ORDER) {
    if (remaining < resources[resource]) {
      return resource;
    }
    remaining -= resources[resource];
  }

  throw new Error(`Card ${cardIndex} is outside the inventory`);
}

function stealResource(state: GameState, playerId: PlayerId, victimPlayerId: PlayerId): GameState {
  if (state.phase.kind !== "steal") {
    fail("INVALID_PHASE", "No resource can be stolen in this phase");
  }
  if (!state.phase.eligibleVictimIds.includes(victimPlayerId)) {
    fail("INVALID_VICTIM", "Selected player is not an eligible victim");
  }

  const victimResources = requirePlayer(state, victimPlayerId).resources;
  const draw = deterministicInteger(state.seed, state.randomIndex, totalResources(victimResources));
  const stolen = { ...emptyInventory(), [sampleResource(victimResources, draw.value)]: 1 };
  const withVictim = updateResources(state, victimPlayerId, (resources) =>
    subtractResources(resources, stolen),
  );

  return {
    ...updateResources(withVictim, playerId, (resources) => addResources(resources, stolen)),
    phase: { kind: state.phase.resumePhase },
    randomIndex: draw.nextIndex,
  };
}

function tradeWithBank(
  state: GameState,
  playerId: PlayerId,
  give: ResourceType,
  receive: ResourceType,
): GameState {
  if (state.phase.kind !== "build_and_trade") {
    fail("INVALID_PHASE", "Bank trades are only allowed after rolling");
  }
  if (give === receive) {
    fail("INVALID_TRADE", "Trade resources must be different");
  }

  const ratio = getBankTradeRatio(state, playerId, give);
  if (requirePlayer(state, playerId).resources[give] < ratio) {
    fail("INVALID_TRADE", `This bank trade requires ${ratio} cards`);
  }
  if (state.bank[receive] < 1) {
    fail("BANK_OUT_OF_RESOURCE", "Bank has none of the requested resource");
  }

  const given = { ...emptyInventory(), [give]: ratio };
  const received = { ...emptyInventory(), [receive]: 1 };
  return {
    ...updateResources(state, playerId, (resources) =>
      addResources(subtractResources(resources, given), received),
    ),
    bank: addResources(subtractResources(state.bank, received), given),
  };
}

function proposeTrade(
  state: GameState,
  playerId: PlayerId,
  give: ResourceInventory,
  want: ResourceInventory,
  recipientPlayerIds: readonly PlayerId[],
): GameState {
  if (state.phase.kind !== "build_and_trade") {
    fail("INVALID_PHASE", "Trades can only be proposed after rolling");
  }
  if (state.tradeOffer) {
    fail("INVALID_TRADE", "Cancel the current trade offer before proposing another");
  }
  if (
    !isValidInventory(give) ||
    !isValidInventory(want) ||
    totalResources(give) === 0 ||
    totalResources(want) === 0
  ) {
    fail("INVALID_TRADE", "A trade must give and request at least one resource");
  }
  if (RESOURCE_TYPES.some((resource) => give[resource] > 0 && want[resource] > 0)) {
    fail("INVALID_TRADE", "A trade cannot give and request the same resource");
  }
  if (!hasResources(requirePlayer(state, playerId).resources, give)) {
    fail("INSUFFICIENT_RESOURCES", "Player cannot afford the proposed trade");
  }

  const uniqueRecipients = [...new Set(recipientPlayerIds)];
  if (
    uniqueRecipients.length === 0 ||
    uniqueRecipients.length !== recipientPlayerIds.length ||
    uniqueRecipients.includes(playerId)
  ) {
    fail("INVALID_TRADE", "Trade recipients must be unique opponents");
  }
  for (const recipientPlayerId of uniqueRecipients) {
    requirePlayer(state, recipientPlayerId);
  }

  return {
    ...state,
    tradeOffer: {
      acceptedPlayerIds: [],
      give: { ...give },
      offerActionNumber: state.actionNumber + 1,
      proposerPlayerId: playerId,
      recipientPlayerIds: uniqueRecipients,
      rejectedPlayerIds: [],
      want: { ...want },
    },
  };
}

function requireTradeOffer(state: GameState, offerActionNumber: number): TradeOffer {
  const offer = state.tradeOffer;

  if (!offer) {
    fail("INVALID_TRADE", "There is no active trade offer");
  }
  if (offer.offerActionNumber !== offerActionNumber) {
    fail("INVALID_TRADE", "Trade offer is stale");
  }

  return offer;
}

function hasResponded(offer: TradeOffer, playerId: PlayerId) {
  return offer.acceptedPlayerIds.includes(playerId) || offer.rejectedPlayerIds.includes(playerId);
}

function respondToTrade(
  state: GameState,
  playerId: PlayerId,
  offerActionNumber: number,
  accept: boolean,
): GameState {
  const offer = requireTradeOffer(state, offerActionNumber);

  if (!offer.recipientPlayerIds.includes(playerId) || hasResponded(offer, playerId)) {
    fail("INVALID_TRADE", "Player cannot respond to this trade offer");
  }

  if (accept) {
    if (!hasResources(requirePlayer(state, playerId).resources, offer.want)) {
      fail("INSUFFICIENT_RESOURCES", "Player cannot afford this trade offer");
    }
    return {
      ...state,
      tradeOffer: { ...offer, acceptedPlayerIds: [...offer.acceptedPlayerIds, playerId] },
    };
  }

  const rejectedPlayerIds = [...offer.rejectedPlayerIds, playerId];
  const everyoneRejected = rejectedPlayerIds.length === offer.recipientPlayerIds.length;
  return { ...state, tradeOffer: everyoneRejected ? null : { ...offer, rejectedPlayerIds } };
}

function confirmTrade(
  state: GameState,
  playerId: PlayerId,
  offerActionNumber: number,
  partnerPlayerId: PlayerId,
): GameState {
  const offer = requireTradeOffer(state, offerActionNumber);

  if (!offer.acceptedPlayerIds.includes(partnerPlayerId)) {
    fail("INVALID_TRADE", "The trade partner has not accepted this offer");
  }
  if (
    !hasResources(requirePlayer(state, playerId).resources, offer.give) ||
    !hasResources(requirePlayer(state, partnerPlayerId).resources, offer.want)
  ) {
    fail("INSUFFICIENT_RESOURCES", "Trade participants can no longer afford this offer");
  }

  const withProposer = updateResources(state, playerId, (resources) =>
    addResources(subtractResources(resources, offer.give), offer.want),
  );
  return {
    ...updateResources(withProposer, partnerPlayerId, (resources) =>
      addResources(subtractResources(resources, offer.want), offer.give),
    ),
    tradeOffer: null,
  };
}

function cancelTrade(state: GameState, offerActionNumber: number): GameState {
  requireTradeOffer(state, offerActionNumber);
  return { ...state, tradeOffer: null };
}

function endTurn(state: GameState): GameState {
  if (state.phase.kind !== "build_and_trade") {
    fail("INVALID_PHASE", "Turn cannot end before rolling and resolving actions");
  }

  const activeIndex = state.turnOrder.indexOf(state.activePlayerId);
  return {
    ...state,
    activePlayerId: state.turnOrder[(activeIndex + 1) % state.turnOrder.length]!,
    developmentCardPlayedThisTurn: false,
    developmentCardsBoughtThisTurn: 0,
    lastDiceRoll: null,
    phase: { kind: "roll" },
    tradeOffer: null,
    turnNumber: state.turnNumber + 1,
  };
}

function withdrawUnaffordableTradeOffer(state: GameState): GameState {
  const offer = state.tradeOffer;

  if (!offer || hasResources(requirePlayer(state, offer.proposerPlayerId).resources, offer.give)) {
    return state;
  }

  return { ...state, tradeOffer: null };
}

export function getRequiredPlayerIds(state: GameState): PlayerId[] {
  if (state.phase.kind === "finished") {
    return [];
  }

  if (state.phase.kind === "discard") {
    return state.phase.pending.map((pending) => pending.playerId);
  }

  const offer = state.tradeOffer;
  if (offer) {
    return [
      state.activePlayerId,
      ...offer.recipientPlayerIds.filter((playerId) => !hasResponded(offer, playerId)),
    ];
  }

  return [state.activePlayerId];
}

function emptyLegalActions(): LegalActions {
  return {
    bankTrades: [],
    canBuyDevelopmentCard: false,
    canCancelTrade: false,
    canEndTurn: false,
    canProposeTrade: false,
    canRespondToTrade: false,
    canRoll: false,
    cityVertexKeys: [],
    discardCount: null,
    isRequiredActor: false,
    playableDevelopmentCards: [],
    roadEdgeKeys: [],
    robberTileIds: [],
    settlementVertexKeys: [],
    tradePartnerPlayerIds: [],
    victimPlayerIds: [],
  };
}

interface LegalActionOptions {
  /** Compute the actions as a player who cannot see the bank, so they do not reveal its stock. */
  hideBankStock?: boolean;
}

export function getLegalActions(
  state: GameState,
  actorPlayerId: PlayerId,
  { hideBankStock = false }: LegalActionOptions = {},
): LegalActions {
  const player = requirePlayer(state, actorPlayerId);
  const actions = emptyLegalActions();

  if (!getRequiredPlayerIds(state).includes(actorPlayerId)) {
    return actions;
  }

  actions.isRequiredActor = true;

  switch (state.phase.kind) {
    case "setup_settlement":
      actions.settlementVertexKeys = getSettlementVertexKeys(state, actorPlayerId, false);
      return actions;
    case "setup_road":
      actions.roadEdgeKeys = boardTopology(state).vertexEdges[
        state.phase.settlementVertexKey
      ]!.filter((edgeKey) => !roadAt(state, edgeKey));
      return actions;
    case "road_building":
      actions.roadEdgeKeys = getRoadEdgeKeys(state, actorPlayerId);
      return actions;
    case "roll":
      actions.canRoll = true;
      actions.playableDevelopmentCards = playableDevelopmentCards(state, player, hideBankStock);
      return actions;
    case "discard":
      actions.discardCount =
        state.phase.pending.find((requirement) => requirement.playerId === actorPlayerId)?.count ??
        null;
      return actions;
    case "move_robber":
      actions.robberTileIds = robberTileIds(state);
      return actions;
    case "steal":
      actions.victimPlayerIds = [...state.phase.eligibleVictimIds];
      return actions;
    case "build_and_trade":
      if (actorPlayerId !== state.activePlayerId) {
        actions.canRespondToTrade = true;
        return actions;
      }

      actions.canEndTurn = true;
      actions.playableDevelopmentCards = playableDevelopmentCards(state, player, hideBankStock);
      actions.canBuyDevelopmentCard =
        state.developmentDeck.length > 0 && hasResources(player.resources, DEVELOPMENT_CARD_COST);
      actions.canCancelTrade = state.tradeOffer !== null;
      actions.canProposeTrade = state.tradeOffer === null;
      actions.tradePartnerPlayerIds = [...(state.tradeOffer?.acceptedPlayerIds ?? [])];
      actions.cityVertexKeys =
        player.piecesRemaining.cities > 0 && hasResources(player.resources, BUILD_COSTS.city)
          ? getCityVertexKeys(state, actorPlayerId)
          : [];
      actions.settlementVertexKeys =
        player.piecesRemaining.settlements > 0 &&
        hasResources(player.resources, BUILD_COSTS.settlement)
          ? getSettlementVertexKeys(state, actorPlayerId, true)
          : [];
      actions.roadEdgeKeys =
        player.piecesRemaining.roads > 0 && hasResources(player.resources, BUILD_COSTS.road)
          ? getRoadEdgeKeys(state, actorPlayerId)
          : [];
      actions.bankTrades = RESOURCE_TYPES.flatMap((give) => {
        const ratio = getBankTradeRatio(state, actorPlayerId, give);

        return player.resources[give] >= ratio
          ? RESOURCE_TYPES.filter(
              (receive) => receive !== give && (hideBankStock || state.bank[receive] > 0),
            ).map((receive) => ({ give, ratio, receive }))
          : [];
      });
      return actions;
    case "finished":
      return actions;
  }
}

function reduceCommand(state: GameState, actorPlayerId: PlayerId, command: GameCommand): GameState {
  switch (command.kind) {
    case "place_settlement":
      return placeSettlement(state, actorPlayerId, command.vertexKey);
    case "place_road":
      return placeRoad(state, actorPlayerId, command.edgeKey);
    case "roll":
      return rollDice(state);
    case "discard":
      return discardResources(state, actorPlayerId, command.resources);
    case "move_robber":
      return moveRobber(state, actorPlayerId, command.tileId);
    case "steal":
      return stealResource(state, actorPlayerId, command.victimPlayerId);
    case "build_city":
      return buildCity(state, actorPlayerId, command.vertexKey);
    case "buy_development_card":
      return buyDevelopmentCard(state, actorPlayerId);
    case "play_knight":
      return playKnight(state, actorPlayerId);
    case "play_monopoly":
      return playMonopoly(state, actorPlayerId, command.resource);
    case "play_road_building":
      return playRoadBuilding(state, actorPlayerId);
    case "play_year_of_plenty":
      return playYearOfPlenty(state, actorPlayerId, command.resources);
    case "trade_bank":
      return tradeWithBank(state, actorPlayerId, command.give, command.receive);
    case "propose_trade":
      return proposeTrade(
        state,
        actorPlayerId,
        command.give,
        command.want,
        command.recipientPlayerIds,
      );
    case "respond_trade":
      return respondToTrade(state, actorPlayerId, command.offerActionNumber, command.accept);
    case "confirm_trade":
      return confirmTrade(state, actorPlayerId, command.offerActionNumber, command.partnerPlayerId);
    case "cancel_trade":
      return cancelTrade(state, command.offerActionNumber);
    case "end_turn":
      return endTurn(state);
  }
}

export function applyCommand(
  state: GameState,
  actorPlayerId: PlayerId,
  command: GameCommand,
): GameState {
  if (state.phase.kind === "finished") {
    fail("GAME_FINISHED", "Game is already complete");
  }

  requirePlayer(state, actorPlayerId);

  if (!getRequiredPlayerIds(state).includes(actorPlayerId)) {
    fail("NOT_REQUIRED_ACTOR", "Player cannot act in the current phase");
  }

  if (
    actorPlayerId !== state.activePlayerId &&
    state.phase.kind !== "discard" &&
    command.kind !== "respond_trade"
  ) {
    fail("NOT_REQUIRED_ACTOR", "Player may only respond to the active trade offer");
  }

  const next = withdrawUnaffordableTradeOffer(reduceCommand(state, actorPlayerId, command));

  // Checking the active player after every command also covers a turn that starts at the target,
  // such as after a Longest Road passed to this player during an opponent's turn.
  return {
    ...finishIfWinner(next, next.activePlayerId),
    actionNumber: state.actionNumber + 1,
  };
}
