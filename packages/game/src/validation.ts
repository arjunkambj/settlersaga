import { getGameMapDefinition, mapSupportsPlayerCount } from "./maps";
import {
  BANK_RESOURCE_COUNT,
  BOT_DIFFICULTIES,
  DEVELOPMENT_CARD_DECK,
  INITIAL_PIECES,
  TURN_TIMER_OPTIONS,
} from "./constants";
import { LONGEST_ROAD_VICTORY_POINTS, getLongestRoadPlayerId } from "./longest-road";
import { LARGEST_ARMY_VICTORY_POINTS, getLargestArmyPlayerId } from "./largest-army";
import { getBoardTopology, getTileId } from "./topology";
import {
  DEVELOPMENT_CARD_TYPES,
  GAME_MAP_IDS,
  PLAYER_COUNTS,
  RESOURCE_TYPES,
  TERRAIN_TYPES,
} from "./types";
import type {
  DevelopmentCardType,
  GameMapId,
  GamePhase,
  GameState,
  PlayerGameView,
  PlayerId,
  PlayableDevelopmentCardType,
  ResourceInventory,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const BUILDING_KINDS = ["city", "settlement"] as const;
const GAME_STATUSES = ["active", "completed"] as const;
const PHASE_KINDS = [
  "setup_settlement",
  "setup_road",
  "roll",
  "discard",
  "move_robber",
  "steal",
  "road_building",
  "build_and_trade",
  "finished",
] as const satisfies readonly GamePhase["kind"][];

export class GameDataValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "GameDataValidationError";
  }
}

function invalid(path: string, message: string): never {
  throw new GameDataValidationError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "expected an object");
  }
  return value as UnknownRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    invalid(path, "expected an array");
  }
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string") {
    invalid(path, "expected a string");
  }
  return value;
}

function identifier(value: unknown, path: string): string {
  const result = string(value, path);
  if (result.length === 0) {
    invalid(path, "expected a non-empty identifier");
  }
  return result;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    invalid(path, "expected a boolean");
  }
  return value;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    invalid(path, "expected a safe integer");
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const result = integer(value, path);
  if (result < 0) {
    invalid(path, "expected a non-negative integer");
  }
  return result;
}

function positiveInteger(value: unknown, path: string): number {
  const result = integer(value, path);
  if (result <= 0) {
    invalid(path, "expected a positive integer");
  }
  return result;
}

function member<Value extends string | number>(
  value: unknown,
  values: readonly Value[],
  path: string,
): Value {
  const match = values.find((candidate) => candidate === value);
  if (match === undefined) {
    invalid(path, "contains an unsupported value");
  }
  return match;
}

function optionalMember<Value extends string | number>(
  value: unknown,
  values: readonly Value[],
  path: string,
): void {
  if (value !== undefined) {
    member(value, values, path);
  }
}

function validateInventory(value: unknown, path: string): ResourceInventory {
  const inventory = record(value, path);
  for (const resource of RESOURCE_TYPES) {
    nonNegativeInteger(inventory[resource], `${path}.${resource}`);
  }
  return inventory as ResourceInventory;
}

function validateDevelopmentCards(value: unknown, path: string): DevelopmentCardType[] {
  return array(value, path).map((card, index) =>
    member(card, DEVELOPMENT_CARD_TYPES, `${path}[${index}]`),
  );
}

function validatePieces(value: unknown, path: string): void {
  const pieces = record(value, path);
  nonNegativeInteger(pieces.cities, `${path}.cities`);
  nonNegativeInteger(pieces.roads, `${path}.roads`);
  nonNegativeInteger(pieces.settlements, `${path}.settlements`);
}

function validateDiceRoll(value: unknown, path: string): void {
  const roll = record(value, path);
  const first = integer(roll.first, `${path}.first`);
  const second = integer(roll.second, `${path}.second`);
  const sum = integer(roll.sum, `${path}.sum`);
  if (first < 1 || first > 6 || second < 1 || second > 6 || sum !== first + second) {
    invalid(path, "contains an invalid dice roll");
  }
}

interface ValidatedPlayers {
  developmentCardCounts: Map<PlayerId, number>;
  ids: Set<PlayerId>;
  length: number;
  playedDevelopmentCards: Map<PlayerId, PlayableDevelopmentCardType[]>;
  records: Map<PlayerId, UnknownRecord>;
  resources: Map<PlayerId, ResourceInventory>;
}

function validatePlayerBase(
  value: unknown,
  path: string,
): {
  id: PlayerId;
  playedDevelopmentCards: PlayableDevelopmentCardType[];
  player: UnknownRecord;
  seatIndex: number;
} {
  const player = record(value, path);
  const id = identifier(player.id, `${path}.id`);
  string(player.displayName, `${path}.displayName`);
  boolean(player.isBot, `${path}.isBot`);
  optionalMember(player.botDifficulty, BOT_DIFFICULTIES, `${path}.botDifficulty`);
  const seatIndex = nonNegativeInteger(player.seatIndex, `${path}.seatIndex`);
  validatePieces(player.piecesRemaining, `${path}.piecesRemaining`);
  const playedDevelopmentCards = validateDevelopmentCards(
    player.playedDevelopmentCards,
    `${path}.playedDevelopmentCards`,
  );
  if (playedDevelopmentCards.includes("victory-point")) {
    invalid(`${path}.playedDevelopmentCards`, "cannot contain victory-point cards");
  }
  nonNegativeInteger(player.victoryPoints, `${path}.victoryPoints`);
  return {
    id,
    playedDevelopmentCards: playedDevelopmentCards as PlayableDevelopmentCardType[],
    player,
    seatIndex,
  };
}

function validatePlayers(
  value: unknown,
  path: string,
  validateDetails: (
    player: UnknownRecord,
    playerPath: string,
    playerId: PlayerId,
  ) => ResourceInventory | undefined,
): ValidatedPlayers {
  const players = array(value, path);
  const ids = new Set<PlayerId>();
  const developmentCardCounts = new Map<PlayerId, number>();
  const playedDevelopmentCards = new Map<PlayerId, PlayableDevelopmentCardType[]>();
  const records = new Map<PlayerId, UnknownRecord>();
  const resources = new Map<PlayerId, ResourceInventory>();
  const seatIndexes = new Set<number>();

  for (const [index, valueAtIndex] of players.entries()) {
    const playerPath = `${path}[${index}]`;
    const {
      id,
      playedDevelopmentCards: playerPlayedDevelopmentCards,
      player,
      seatIndex,
    } = validatePlayerBase(valueAtIndex, playerPath);
    if (ids.has(id)) {
      invalid(`${playerPath}.id`, "duplicates another player ID");
    }
    if (seatIndexes.has(seatIndex)) {
      invalid(`${playerPath}.seatIndex`, "duplicates another seat index");
    }
    ids.add(id);
    records.set(id, player);
    seatIndexes.add(seatIndex);
    const inventory = validateDetails(player, playerPath, id);
    const developmentCardCount =
      player.developmentCards === undefined
        ? nonNegativeInteger(player.developmentCardCount, `${playerPath}.developmentCardCount`)
        : validateDevelopmentCards(player.developmentCards, `${playerPath}.developmentCards`)
            .length;
    developmentCardCounts.set(id, developmentCardCount);
    playedDevelopmentCards.set(id, playerPlayedDevelopmentCards);
    if (inventory) {
      resources.set(id, inventory);
    }
  }

  return {
    developmentCardCounts,
    ids,
    length: players.length,
    playedDevelopmentCards,
    records,
    resources,
  };
}

function validateStatePlayers(value: unknown): ValidatedPlayers {
  return validatePlayers(value, "game.players", (player, path) => {
    if ("developmentCardCount" in player) {
      invalid(`${path}.developmentCardCount`, "must be derived from the private card hand");
    }
    return validateInventory(player.resources, `${path}.resources`);
  });
}

function validateViewPlayers(value: unknown, viewerPlayerId: PlayerId): ValidatedPlayers {
  let viewerCount = 0;
  const players = validatePlayers(value, "view.players", (player, path, playerId) => {
    const isViewer = boolean(player.isViewer, `${path}.isViewer`);
    const resourceCount = nonNegativeInteger(player.resourceCount, `${path}.resourceCount`);

    if (isViewer) {
      viewerCount += 1;
      if ("developmentCardCount" in player) {
        invalid(`${path}.developmentCardCount`, "must not replace the viewer's private card hand");
      }
      if (playerId !== viewerPlayerId) {
        invalid(`${path}.isViewer`, "does not match viewerPlayerId");
      }
      const resources = validateInventory(player.resources, `${path}.resources`);
      const actualResourceCount = RESOURCE_TYPES.reduce(
        (total, resource) => total + resources[resource],
        0,
      );
      if (resourceCount !== actualResourceCount) {
        invalid(`${path}.resourceCount`, "does not match the private resource inventory");
      }
      return resources;
    } else if (playerId === viewerPlayerId) {
      invalid(`${path}.isViewer`, "must be true for viewerPlayerId");
    }
    if ("developmentCards" in player) {
      invalid(`${path}.developmentCards`, "must not expose another player's private cards");
    }
    if ("resources" in player) {
      invalid(`${path}.resources`, "must not expose another player's private resources");
    }
    if (player.revealedVictoryPointCards !== null) {
      nonNegativeInteger(player.revealedVictoryPointCards, `${path}.revealedVictoryPointCards`);
    }
    return undefined;
  });

  if (!players.ids.has(viewerPlayerId) || viewerCount !== 1) {
    invalid("view.viewerPlayerId", "must identify exactly one viewer player");
  }
  return players;
}

function validateDevelopmentCardConservation(
  players: ValidatedPlayers,
  deck: readonly DevelopmentCardType[],
): void {
  const expectedCounts = new Map<DevelopmentCardType, number>();
  const actualCounts = new Map<DevelopmentCardType, number>();

  for (const card of DEVELOPMENT_CARD_DECK) {
    expectedCounts.set(card, (expectedCounts.get(card) ?? 0) + 1);
  }
  for (const card of deck) {
    actualCounts.set(card, (actualCounts.get(card) ?? 0) + 1);
  }
  for (const player of players.records.values()) {
    for (const card of validateDevelopmentCards(
      player.developmentCards,
      "game.players.developmentCards",
    )) {
      actualCounts.set(card, (actualCounts.get(card) ?? 0) + 1);
    }
  }
  for (const cards of players.playedDevelopmentCards.values()) {
    for (const card of cards) {
      actualCounts.set(card, (actualCounts.get(card) ?? 0) + 1);
    }
  }

  for (const card of DEVELOPMENT_CARD_TYPES) {
    if ((actualCounts.get(card) ?? 0) !== expectedCounts.get(card)) {
      invalid(`game.${card}`, "must match the development card supply");
    }
  }
}

interface ValidatedSettings {
  map: GameMapId;
  maxPlayers: number;
}

function validateSettings(value: unknown, path: string): ValidatedSettings {
  const settings = record(value, path);
  boolean(settings.balancedDice, `${path}.balancedDice`);
  nonNegativeInteger(settings.discardLimit, `${path}.discardLimit`);
  boolean(settings.friendlyRobber, `${path}.friendlyRobber`);
  boolean(settings.hideBankCards, `${path}.hideBankCards`);
  const map = member(settings.map, GAME_MAP_IDS, `${path}.map`);
  const maxPlayers = member(settings.maxPlayers, PLAYER_COUNTS, `${path}.maxPlayers`);
  member(settings.turnTimerSeconds, TURN_TIMER_OPTIONS, `${path}.turnTimerSeconds`);
  positiveInteger(settings.victoryPoints, `${path}.victoryPoints`);
  return { map, maxPlayers };
}

function validateKnownId(value: unknown, knownIds: ReadonlySet<string>, path: string): string {
  const id = identifier(value, path);
  if (!knownIds.has(id)) {
    invalid(path, "references an unknown ID");
  }
  return id;
}

function validateUniqueIds(value: unknown, path: string, knownIds?: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of array(value, path).entries()) {
    const itemPath = `${path}[${index}]`;
    const id = knownIds
      ? validateKnownId(candidate, knownIds, itemPath)
      : identifier(candidate, itemPath);
    if (seen.has(id)) {
      invalid(itemPath, "duplicates another ID");
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

interface ValidatedBoard {
  buildingCounts: Map<PlayerId, { cities: number; settlements: number }>;
  edgeKeys: Set<string>;
  roadCounts: Map<PlayerId, number>;
  tileIds: Set<string>;
  vertexKeys: Set<string>;
}

function validateBoard(
  value: unknown,
  map: GameMapId,
  playerIds: ReadonlySet<PlayerId>,
  path: string,
): ValidatedBoard {
  const board = record(value, path);
  const tileValues = array(board.tiles, `${path}.tiles`);
  const definition = getGameMapDefinition(map);
  if (tileValues.length !== definition.tileCount) {
    invalid(`${path}.tiles`, `expected ${definition.tileCount} tiles for ${map}`);
  }

  const tileIds = new Set<string>();
  const coordinates: { q: number; r: number }[] = [];
  for (const [index, valueAtIndex] of tileValues.entries()) {
    const tilePath = `${path}.tiles[${index}]`;
    const tile = record(valueAtIndex, tilePath);
    const q = integer(tile.q, `${tilePath}.q`);
    const r = integer(tile.r, `${tilePath}.r`);
    const id = identifier(tile.id, `${tilePath}.id`);
    if (id !== getTileId({ q, r })) {
      invalid(`${tilePath}.id`, "does not match its coordinates");
    }
    if (tileIds.has(id)) {
      invalid(`${tilePath}.id`, "duplicates another tile");
    }
    tileIds.add(id);
    coordinates.push({ q, r });
    member(tile.terrain, TERRAIN_TYPES, `${tilePath}.terrain`);
    if (tile.numberToken !== null) {
      integer(tile.numberToken, `${tilePath}.numberToken`);
    }
  }

  const topology = getBoardTopology(coordinates);
  const edgeKeys = new Set(topology.edgeKeys);
  const vertexKeys = new Set(topology.vertexKeys);
  validateKnownId(board.robberTileId, tileIds, `${path}.robberTileId`);

  const occupiedVertices = new Set<string>();
  const buildingCounts = new Map<PlayerId, { cities: number; settlements: number }>();
  for (const [index, valueAtIndex] of array(board.buildings, `${path}.buildings`).entries()) {
    const buildingPath = `${path}.buildings[${index}]`;
    const building = record(valueAtIndex, buildingPath);
    const kind = member(building.kind, BUILDING_KINDS, `${buildingPath}.kind`);
    const playerId = validateKnownId(building.playerId, playerIds, `${buildingPath}.playerId`);
    const vertexKey = validateKnownId(building.vertexKey, vertexKeys, `${buildingPath}.vertexKey`);
    if (occupiedVertices.has(vertexKey)) {
      invalid(`${buildingPath}.vertexKey`, "duplicates another building vertex");
    }
    occupiedVertices.add(vertexKey);
    const counts = buildingCounts.get(playerId) ?? { cities: 0, settlements: 0 };
    counts[kind === "city" ? "cities" : "settlements"] += 1;
    buildingCounts.set(playerId, counts);
  }

  const occupiedEdges = new Set<string>();
  const roadCounts = new Map<PlayerId, number>();
  for (const [index, valueAtIndex] of array(board.roads, `${path}.roads`).entries()) {
    const roadPath = `${path}.roads[${index}]`;
    const road = record(valueAtIndex, roadPath);
    const playerId = validateKnownId(road.playerId, playerIds, `${roadPath}.playerId`);
    const edgeKey = validateKnownId(road.edgeKey, edgeKeys, `${roadPath}.edgeKey`);
    if (occupiedEdges.has(edgeKey)) {
      invalid(`${roadPath}.edgeKey`, "duplicates another road edge");
    }
    occupiedEdges.add(edgeKey);
    roadCounts.set(playerId, (roadCounts.get(playerId) ?? 0) + 1);
  }

  const portIds = new Set<string>();
  const portEdges = new Set<string>();
  for (const [index, valueAtIndex] of array(board.ports, `${path}.ports`).entries()) {
    const portPath = `${path}.ports[${index}]`;
    const port = record(valueAtIndex, portPath);
    const id = identifier(port.id, `${portPath}.id`);
    if (portIds.has(id)) {
      invalid(`${portPath}.id`, "duplicates another port ID");
    }
    portIds.add(id);
    const edgeKey = validateKnownId(port.edgeKey, edgeKeys, `${portPath}.edgeKey`);
    if (portEdges.has(edgeKey)) {
      invalid(`${portPath}.edgeKey`, "duplicates another port edge");
    }
    portEdges.add(edgeKey);
    if (port.trade !== "any") {
      member(port.trade, RESOURCE_TYPES, `${portPath}.trade`);
    }
  }

  return { buildingCounts, edgeKeys, roadCounts, tileIds, vertexKeys };
}

function validatePieceAndScoreConservation(
  players: ValidatedPlayers,
  board: ValidatedBoard,
  largestArmyPlayerId: PlayerId | null,
  longestRoadPlayerId: PlayerId | null,
  path: string,
): void {
  for (const [playerId, player] of players.records) {
    const pieces = record(player.piecesRemaining, `${path}.${playerId}.piecesRemaining`);
    const buildings = board.buildingCounts.get(playerId) ?? { cities: 0, settlements: 0 };
    const roadCount = board.roadCounts.get(playerId) ?? 0;
    if (
      pieces.cities !== INITIAL_PIECES.cities - buildings.cities ||
      pieces.settlements !== INITIAL_PIECES.settlements - buildings.settlements ||
      pieces.roads !== INITIAL_PIECES.roads - roadCount
    ) {
      invalid(`${path}.${playerId}.piecesRemaining`, "does not match pieces placed on the board");
    }
    const publicVictoryPoints =
      buildings.settlements +
      buildings.cities * 2 +
      (playerId === largestArmyPlayerId ? LARGEST_ARMY_VICTORY_POINTS : 0) +
      (playerId === longestRoadPlayerId ? LONGEST_ROAD_VICTORY_POINTS : 0);
    if (player.victoryPoints !== publicVictoryPoints) {
      invalid(
        `${path}.${playerId}.victoryPoints`,
        "does not match the player's buildings and awards",
      );
    }
  }
}

function validateResourceConservation(players: ValidatedPlayers, bank: ResourceInventory): void {
  for (const resource of RESOURCE_TYPES) {
    const total = [...players.resources.values()].reduce(
      (sum, inventory) => sum + inventory[resource],
      bank[resource],
    );
    if (total !== BANK_RESOURCE_COUNT) {
      invalid(
        `game.${resource}`,
        `must total ${BANK_RESOURCE_COUNT} cards across bank and players`,
      );
    }
  }
}

function validatePlayerId(
  value: unknown,
  playerIds: ReadonlySet<PlayerId>,
  path: string,
): PlayerId {
  return validateKnownId(value, playerIds, path);
}

function validatePhase(
  value: unknown,
  playerIds: ReadonlySet<PlayerId>,
  board: ValidatedBoard,
  path: string,
): GamePhase["kind"] {
  const phase = record(value, path);
  const kind = member(phase.kind, PHASE_KINDS, `${path}.kind`);

  switch (kind) {
    case "setup_settlement":
      nonNegativeInteger(phase.setupIndex, `${path}.setupIndex`);
      break;
    case "setup_road":
      nonNegativeInteger(phase.setupIndex, `${path}.setupIndex`);
      validateKnownId(phase.settlementVertexKey, board.vertexKeys, `${path}.settlementVertexKey`);
      break;
    case "discard": {
      const pendingPlayerIds = new Set<PlayerId>();
      for (const [index, valueAtIndex] of array(phase.pending, `${path}.pending`).entries()) {
        const requirementPath = `${path}.pending[${index}]`;
        const requirement = record(valueAtIndex, requirementPath);
        const playerId = validatePlayerId(
          requirement.playerId,
          playerIds,
          `${requirementPath}.playerId`,
        );
        if (pendingPlayerIds.has(playerId)) {
          invalid(`${requirementPath}.playerId`, "duplicates another discard requirement");
        }
        pendingPlayerIds.add(playerId);
        nonNegativeInteger(requirement.count, `${requirementPath}.count`);
      }
      validatePlayerId(phase.rollerPlayerId, playerIds, `${path}.rollerPlayerId`);
      break;
    }
    case "move_robber":
      validatePlayerId(phase.rollerPlayerId, playerIds, `${path}.rollerPlayerId`);
      member(phase.resumePhase, ["build_and_trade", "roll"], `${path}.resumePhase`);
      break;
    case "steal":
      validateUniqueIds(phase.eligibleVictimIds, `${path}.eligibleVictimIds`, playerIds);
      validatePlayerId(phase.rollerPlayerId, playerIds, `${path}.rollerPlayerId`);
      member(phase.resumePhase, ["build_and_trade", "roll"], `${path}.resumePhase`);
      break;
    case "road_building": {
      const remainingRoads = positiveInteger(phase.remainingRoads, `${path}.remainingRoads`);
      if (remainingRoads > 2) {
        invalid(`${path}.remainingRoads`, "cannot exceed two roads");
      }
      member(phase.resumePhase, ["build_and_trade", "roll"], `${path}.resumePhase`);
      break;
    }
    case "roll":
    case "build_and_trade":
    case "finished":
      break;
  }

  return kind;
}

function validateTradeOffer(value: unknown, playerIds: ReadonlySet<PlayerId>, path: string): void {
  if (value === null) {
    return;
  }
  const offer = record(value, path);
  validateInventory(offer.give, `${path}.give`);
  nonNegativeInteger(offer.offerActionNumber, `${path}.offerActionNumber`);
  validatePlayerId(offer.proposerPlayerId, playerIds, `${path}.proposerPlayerId`);
  validateUniqueIds(offer.recipientPlayerIds, `${path}.recipientPlayerIds`, playerIds);
  validateUniqueIds(offer.rejectedPlayerIds, `${path}.rejectedPlayerIds`, playerIds);
  validateInventory(offer.want, `${path}.want`);
}

interface ValidatedSharedGame {
  board: ValidatedBoard;
  phaseKind: GamePhase["kind"];
  playerIds: Set<PlayerId>;
}

function validateSharedGame(
  game: UnknownRecord,
  path: string,
  players: ValidatedPlayers,
): ValidatedSharedGame {
  const settings = validateSettings(game.settings, `${path}.settings`);
  if (
    players.length !== settings.maxPlayers ||
    !mapSupportsPlayerCount(settings.map, players.length)
  ) {
    invalid(`${path}.settings`, "map and player count are not supported together");
  }

  nonNegativeInteger(game.actionNumber, `${path}.actionNumber`);
  const activePlayerId = validatePlayerId(
    game.activePlayerId,
    players.ids,
    `${path}.activePlayerId`,
  );
  const board = validateBoard(game.board, settings.map, players.ids, `${path}.board`);
  const largestArmyPlayerId =
    game.largestArmyPlayerId === null
      ? null
      : validatePlayerId(game.largestArmyPlayerId, players.ids, `${path}.largestArmyPlayerId`);
  const expectedLargestArmyPlayerId = getLargestArmyPlayerId(
    [...players.records].map(([id, player]) => ({
      id,
      playedDevelopmentCards: players.playedDevelopmentCards.get(id) ?? [],
      seatIndex: player.seatIndex as number,
    })),
    largestArmyPlayerId,
  );
  if (largestArmyPlayerId !== expectedLargestArmyPlayerId) {
    invalid(`${path}.largestArmyPlayerId`, "does not match played knight cards");
  }
  const longestRoadPlayerId =
    game.longestRoadPlayerId === null
      ? null
      : validatePlayerId(game.longestRoadPlayerId, players.ids, `${path}.longestRoadPlayerId`);
  const expectedLongestRoadPlayerId = getLongestRoadPlayerId(
    game.board as unknown as GameState["board"],
    [...players.ids],
    longestRoadPlayerId,
  );
  if (longestRoadPlayerId !== expectedLongestRoadPlayerId) {
    invalid(`${path}.longestRoadPlayerId`, "does not match the board's longest road");
  }
  validatePieceAndScoreConservation(
    players,
    board,
    largestArmyPlayerId,
    longestRoadPlayerId,
    `${path}.players`,
  );
  boolean(game.developmentCardPlayedThisTurn, `${path}.developmentCardPlayedThisTurn`);
  const boughtThisTurn = nonNegativeInteger(
    game.developmentCardsBoughtThisTurn,
    `${path}.developmentCardsBoughtThisTurn`,
  );
  if (boughtThisTurn > (players.developmentCardCounts.get(activePlayerId) ?? 0)) {
    invalid(
      `${path}.developmentCardsBoughtThisTurn`,
      "exceeds the active player's development-card hand",
    );
  }
  if (game.lastDiceRoll !== null) {
    validateDiceRoll(game.lastDiceRoll, `${path}.lastDiceRoll`);
  }
  const phaseKind = validatePhase(game.phase, players.ids, board, `${path}.phase`);
  member(game.status, GAME_STATUSES, `${path}.status`);
  validateTradeOffer(game.tradeOffer, players.ids, `${path}.tradeOffer`);
  nonNegativeInteger(game.turnNumber, `${path}.turnNumber`);
  const turnOrder = validateUniqueIds(game.turnOrder, `${path}.turnOrder`, players.ids);
  if (turnOrder.length !== players.length) {
    invalid(`${path}.turnOrder`, "must contain every player exactly once");
  }
  if (game.version !== 4) {
    invalid(`${path}.version`, "contains an unsupported game-state version");
  }
  if (game.winnerPlayerId !== null) {
    validatePlayerId(game.winnerPlayerId, players.ids, `${path}.winnerPlayerId`);
  }

  return { board, phaseKind, playerIds: players.ids };
}

function validateLegalActions(value: unknown, shared: ValidatedSharedGame, path: string): void {
  const actions = record(value, path);
  for (const key of [
    "canCancelTrade",
    "canBuyDevelopmentCard",
    "canEndTurn",
    "canProposeTrade",
    "canRespondToTrade",
    "canRoll",
    "isRequiredActor",
  ] as const) {
    boolean(actions[key], `${path}.${key}`);
  }
  const playableDevelopmentCards = validateDevelopmentCards(
    actions.playableDevelopmentCards,
    `${path}.playableDevelopmentCards`,
  );
  if (
    playableDevelopmentCards.includes("victory-point") ||
    new Set(playableDevelopmentCards).size !== playableDevelopmentCards.length
  ) {
    invalid(
      `${path}.playableDevelopmentCards`,
      "must contain unique playable development-card types",
    );
  }

  const bankTrades = array(actions.bankTrades, `${path}.bankTrades`);
  for (const [index, valueAtIndex] of bankTrades.entries()) {
    const tradePath = `${path}.bankTrades[${index}]`;
    const trade = record(valueAtIndex, tradePath);
    member(trade.give, RESOURCE_TYPES, `${tradePath}.give`);
    positiveInteger(trade.ratio, `${tradePath}.ratio`);
    member(trade.receive, RESOURCE_TYPES, `${tradePath}.receive`);
  }

  validateUniqueIds(actions.cityVertexKeys, `${path}.cityVertexKeys`, shared.board.vertexKeys);
  if (actions.discardCount !== null) {
    nonNegativeInteger(actions.discardCount, `${path}.discardCount`);
  }
  const phaseKind = member(actions.phase, PHASE_KINDS, `${path}.phase`);
  if (phaseKind !== shared.phaseKind) {
    invalid(`${path}.phase`, "does not match the game phase");
  }
  validateUniqueIds(actions.roadEdgeKeys, `${path}.roadEdgeKeys`, shared.board.edgeKeys);
  validateUniqueIds(actions.robberTileIds, `${path}.robberTileIds`, shared.board.tileIds);
  validateUniqueIds(
    actions.settlementVertexKeys,
    `${path}.settlementVertexKeys`,
    shared.board.vertexKeys,
  );
  validateUniqueIds(actions.victimPlayerIds, `${path}.victimPlayerIds`, shared.playerIds);
}

export function assertGameState(value: unknown): asserts value is GameState {
  const game = record(value, "game");
  if ("developmentCardSupply" in game || "victoryPoints" in game) {
    invalid("game", "contains derived or obsolete top-level fields");
  }
  const players = validateStatePlayers(game.players);
  validateSharedGame(game, "game", players);
  const developmentDeck = validateDevelopmentCards(game.developmentDeck, "game.developmentDeck");
  validateDevelopmentCardConservation(players, developmentDeck);
  for (const [index, roll] of array(game.balancedDiceBag, "game.balancedDiceBag").entries()) {
    validateDiceRoll(roll, `game.balancedDiceBag[${index}]`);
  }
  const bank = validateInventory(game.bank, "game.bank");
  validateResourceConservation(players, bank);
  nonNegativeInteger(game.randomIndex, "game.randomIndex");
  identifier(game.seed, "game.seed");
}

export function assertPlayerGameView(value: unknown): asserts value is PlayerGameView {
  const view = record(value, "view");
  if ("developmentDeck" in view || "victoryPoints" in view) {
    invalid("view", "contains private or obsolete top-level fields");
  }
  const viewerPlayerId = identifier(view.viewerPlayerId, "view.viewerPlayerId");
  const players = validateViewPlayers(view.players, viewerPlayerId);
  const shared = validateSharedGame(view, "view", players);
  for (const [playerId, player] of players.records) {
    if (playerId === viewerPlayerId) {
      if ("revealedVictoryPointCards" in player) {
        invalid(
          `view.players.${playerId}.revealedVictoryPointCards`,
          "must not duplicate the viewer's private card hand",
        );
      }
      continue;
    }
    if (
      (view.status === "completed" && player.revealedVictoryPointCards === null) ||
      (view.status !== "completed" && player.revealedVictoryPointCards !== null)
    ) {
      invalid(
        `view.players.${playerId}.revealedVictoryPointCards`,
        "must only reveal victory point cards after the game is complete",
      );
    }
  }
  if (view.bank !== null) {
    validateInventory(view.bank, "view.bank");
  }
  const developmentCardSupply = nonNegativeInteger(
    view.developmentCardSupply,
    "view.developmentCardSupply",
  );
  const heldDevelopmentCards = [...players.developmentCardCounts.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const playedDevelopmentCards = [...players.playedDevelopmentCards.values()].reduce(
    (total, cards) => total + cards.length,
    0,
  );
  if (
    developmentCardSupply + heldDevelopmentCards + playedDevelopmentCards !==
    DEVELOPMENT_CARD_DECK.length
  ) {
    invalid("view.developmentCardSupply", "does not match player development card counts");
  }
  validateLegalActions(view.legalActions, shared, "view.legalActions");
}

export function isGameState(value: unknown): value is GameState {
  try {
    assertGameState(value);
    return true;
  } catch {
    return false;
  }
}

export function isPlayerGameView(value: unknown): value is PlayerGameView {
  try {
    assertPlayerGameView(value);
    return true;
  } catch {
    return false;
  }
}
