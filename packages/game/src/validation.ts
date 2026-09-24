import { INITIAL_PIECES, TERRAIN_RESOURCE } from "./constants";
import { LARGEST_ARMY_VICTORY_POINTS, getLargestArmyPlayerId } from "./largest-army";
import { LONGEST_ROAD_VICTORY_POINTS, getLongestRoadPlayerId } from "./longest-road";
import { getGameMapDefinition } from "./maps";
import { hasResources, totalResources } from "./resources";
import { getSetupSeatOrder } from "./rules";
import { getGameSettingsProblem } from "./settings";
import { getBoardTopology, getTileId } from "./topology";
import {
  BOT_DIFFICULTIES,
  DEVELOPMENT_CARD_TYPES,
  GAME_MAP_IDS,
  NUMBER_TOKENS,
  PLAYER_COUNTS,
  RESOURCE_TYPES,
  TERRAIN_TYPES,
  TURN_TIMER_OPTIONS,
  isPlayableDevelopmentCard,
} from "./types";
import type {
  BankTradeOption,
  BaseGameSettings,
  BoardState,
  BuildingState,
  DevelopmentCardType,
  DiceRoll,
  GameMapId,
  GamePhase,
  GamePlayerInput,
  GameState,
  LegalActions,
  PlayableDevelopmentCardType,
  PlayerGameView,
  PlayerId,
  PlayerPieces,
  PlayerState,
  PlayerViewState,
  PortDescriptor,
  PortTrade,
  ResourceInventory,
  RoadState,
  TileState,
  TradeOffer,
} from "./types";

type UnknownRecord = Record<string, unknown>;
type SharedGameState = Omit<
  GameState,
  "balancedDiceBag" | "bank" | "developmentDeck" | "players" | "randomIndex" | "seed"
>;

const BUILDING_KINDS = ["city", "settlement"] as const;
const RESUME_PHASES = ["build_and_trade", "roll"] as const;
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
const PRIVATE_GAME_FIELDS = ["balancedDiceBag", "developmentDeck", "randomIndex", "seed"] as const;

export class GameDataValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "GameDataValidationError";
  }
}

function invalid(path: string, message: string): never {
  throw new GameDataValidationError(path, message);
}

function expectRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "expected an object");
  }
  return value as UnknownRecord;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    invalid(path, "expected an array");
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    invalid(path, "expected a string");
  }
  return value;
}

function expectIdentifier(value: unknown, path: string): string {
  const identifier = expectString(value, path);
  if (identifier.length === 0) {
    invalid(path, "expected a non-empty identifier");
  }
  return identifier;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    invalid(path, "expected a boolean");
  }
  return value;
}

function expectInteger(value: unknown, path: string, minimum = Number.MIN_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    invalid(path, "expected a safe integer");
  }
  if (value < minimum) {
    invalid(path, `expected an integer of at least ${minimum}`);
  }
  return value;
}

function expectMember<Value extends string | number>(
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

function expectKnownId(value: unknown, knownIds: ReadonlySet<string>, path: string): string {
  const id = expectIdentifier(value, path);
  if (!knownIds.has(id)) {
    invalid(path, "references an unknown ID");
  }
  return id;
}

function expectNullableKnownId(
  value: unknown,
  knownIds: ReadonlySet<string>,
  path: string,
): string | null {
  return value === null ? null : expectKnownId(value, knownIds, path);
}

function expectUniqueIds(value: unknown, path: string, knownIds?: ReadonlySet<string>): string[] {
  const ids = expectArray(value, path).map((candidate, index) =>
    knownIds
      ? expectKnownId(candidate, knownIds, `${path}[${index}]`)
      : expectIdentifier(candidate, `${path}[${index}]`),
  );
  if (new Set(ids).size !== ids.length) {
    invalid(path, "contains a duplicate ID");
  }
  return ids;
}

function expectUniqueBy<Item>(items: readonly Item[], key: (item: Item) => unknown, path: string) {
  if (new Set(items.map(key)).size !== items.length) {
    invalid(path, "contains a duplicate entry");
  }
}

function parseInventory(value: unknown, path: string): ResourceInventory {
  const inventory = expectRecord(value, path);
  const count = (resource: keyof ResourceInventory) =>
    expectInteger(inventory[resource], `${path}.${resource}`, 0);
  return {
    brick: count("brick"),
    sheep: count("sheep"),
    stone: count("stone"),
    tree: count("tree"),
    wheat: count("wheat"),
  };
}

function parseDevelopmentCards(value: unknown, path: string): DevelopmentCardType[] {
  return expectArray(value, path).map((card, index) =>
    expectMember(card, DEVELOPMENT_CARD_TYPES, `${path}[${index}]`),
  );
}

function parsePlayedDevelopmentCards(value: unknown, path: string): PlayableDevelopmentCardType[] {
  return parseDevelopmentCards(value, path).map((card, index) => {
    if (!isPlayableDevelopmentCard(card)) {
      invalid(`${path}[${index}]`, "cannot be a victory-point card");
    }
    return card;
  });
}

function parsePieces(value: unknown, path: string): PlayerPieces {
  const pieces = expectRecord(value, path);
  return {
    cities: expectInteger(pieces.cities, `${path}.cities`, 0),
    roads: expectInteger(pieces.roads, `${path}.roads`, 0),
    settlements: expectInteger(pieces.settlements, `${path}.settlements`, 0),
  };
}

function parseDiceRoll(value: unknown, path: string): DiceRoll {
  const roll = expectRecord(value, path);
  const first = expectInteger(roll.first, `${path}.first`, 1);
  const second = expectInteger(roll.second, `${path}.second`, 1);
  const sum = expectInteger(roll.sum, `${path}.sum`);
  if (first > 6 || second > 6 || sum !== first + second) {
    invalid(path, "contains an invalid dice roll");
  }
  return { first, second, sum };
}

function parseSettings(value: unknown, path: string): BaseGameSettings {
  const settings = expectRecord(value, path);
  const parsed: BaseGameSettings = {
    balancedDice: expectBoolean(settings.balancedDice, `${path}.balancedDice`),
    discardLimit: expectInteger(settings.discardLimit, `${path}.discardLimit`),
    friendlyRobber: expectBoolean(settings.friendlyRobber, `${path}.friendlyRobber`),
    hideBankCards: expectBoolean(settings.hideBankCards, `${path}.hideBankCards`),
    map: expectMember(settings.map, GAME_MAP_IDS, `${path}.map`),
    maxPlayers: expectMember(settings.maxPlayers, PLAYER_COUNTS, `${path}.maxPlayers`),
    turnTimerSeconds: expectMember(
      settings.turnTimerSeconds,
      TURN_TIMER_OPTIONS,
      `${path}.turnTimerSeconds`,
    ),
    victoryPoints: expectInteger(settings.victoryPoints, `${path}.victoryPoints`),
  };
  const problem = getGameSettingsProblem(parsed);
  if (problem) {
    invalid(path, problem);
  }
  return parsed;
}

function parsePlayerIdentity(player: UnknownRecord, path: string): GamePlayerInput {
  const displayName = expectString(player.displayName, `${path}.displayName`);
  const id = expectIdentifier(player.id, `${path}.id`);

  if (expectBoolean(player.isBot, `${path}.isBot`)) {
    const botDifficulty = expectMember(
      player.botDifficulty,
      BOT_DIFFICULTIES,
      `${path}.botDifficulty`,
    );
    return { botDifficulty, displayName, id, isBot: true };
  }
  if (player.botDifficulty !== undefined) {
    invalid(`${path}.botDifficulty`, "is only allowed for bots");
  }
  return { displayName, id, isBot: false };
}

function parsePublicProgress(player: UnknownRecord, path: string) {
  return {
    piecesRemaining: parsePieces(player.piecesRemaining, `${path}.piecesRemaining`),
    playedDevelopmentCards: parsePlayedDevelopmentCards(
      player.playedDevelopmentCards,
      `${path}.playedDevelopmentCards`,
    ),
    seatIndex: expectInteger(player.seatIndex, `${path}.seatIndex`, 0),
    victoryPoints: expectInteger(player.victoryPoints, `${path}.victoryPoints`, 0),
  };
}

function parseStatePlayer(value: unknown, path: string): PlayerState {
  const player = expectRecord(value, path);
  return {
    ...parsePlayerIdentity(player, path),
    ...parsePublicProgress(player, path),
    developmentCards: parseDevelopmentCards(player.developmentCards, `${path}.developmentCards`),
    resources: parseInventory(player.resources, `${path}.resources`),
  };
}

function parseViewPlayer(value: unknown, path: string, viewerPlayerId: PlayerId): PlayerViewState {
  const player = expectRecord(value, path);
  const resourceCount = expectInteger(player.resourceCount, `${path}.resourceCount`, 0);

  if (expectBoolean(player.isViewer, `${path}.isViewer`)) {
    const viewer = parseStatePlayer(player, path);
    if (viewer.id !== viewerPlayerId) {
      invalid(`${path}.isViewer`, "does not match viewerPlayerId");
    }
    if (totalResources(viewer.resources) !== resourceCount) {
      invalid(`${path}.resourceCount`, "does not match the private resource inventory");
    }
    return { ...viewer, isViewer: true, resourceCount };
  }

  for (const privateField of ["developmentCards", "resources"] as const) {
    if (privateField in player) {
      invalid(`${path}.${privateField}`, "must not expose another player's private hand");
    }
  }
  const id = expectIdentifier(player.id, `${path}.id`);
  if (id === viewerPlayerId) {
    invalid(`${path}.isViewer`, "must be true for viewerPlayerId");
  }
  return {
    ...parsePublicProgress(player, path),
    developmentCardCount: expectInteger(
      player.developmentCardCount,
      `${path}.developmentCardCount`,
      0,
    ),
    displayName: expectString(player.displayName, `${path}.displayName`),
    id,
    isBot: expectBoolean(player.isBot, `${path}.isBot`),
    isViewer: false,
    resourceCount,
    revealedVictoryPointCards:
      player.revealedVictoryPointCards === null
        ? null
        : expectInteger(player.revealedVictoryPointCards, `${path}.revealedVictoryPointCards`, 0),
  };
}

function parsePlayers<Player extends { id: PlayerId; seatIndex: number }>(
  value: unknown,
  path: string,
  parsePlayer: (value: unknown, path: string) => Player,
): Player[] {
  const players = expectArray(value, path).map((player, index) =>
    parsePlayer(player, `${path}[${index}]`),
  );
  expectUniqueBy(players, (player) => player.id, `${path}.id`);
  expectUniqueBy(players, (player) => player.seatIndex, `${path}.seatIndex`);
  return players;
}

function parseTile(value: unknown, path: string): TileState {
  const tile = expectRecord(value, path);
  const q = expectInteger(tile.q, `${path}.q`);
  const r = expectInteger(tile.r, `${path}.r`);
  const id = expectIdentifier(tile.id, `${path}.id`);
  const terrain = expectMember(tile.terrain, TERRAIN_TYPES, `${path}.terrain`);

  if (id !== getTileId({ q, r })) {
    invalid(`${path}.id`, "does not match its coordinates");
  }
  if (TERRAIN_RESOURCE[terrain] === null) {
    if (tile.numberToken !== null) {
      invalid(`${path}.numberToken`, "must be null on a desert");
    }
    return { id, numberToken: null, q, r, terrain };
  }
  return {
    id,
    numberToken: expectMember(tile.numberToken, NUMBER_TOKENS, `${path}.numberToken`),
    q,
    r,
    terrain,
  };
}

function countBy<Item, Key>(items: readonly Item[], key: (item: Item) => Key): Map<Key, number> {
  const counts = new Map<Key, number>();
  for (const item of items) {
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  }
  return counts;
}

function sameCounts<Key>(first: ReadonlyMap<Key, number>, second: ReadonlyMap<Key, number>) {
  return (
    first.size === second.size && [...first].every(([key, count]) => second.get(key) === count)
  );
}

function parseBoard(
  value: unknown,
  mapId: GameMapId,
  playerIds: ReadonlySet<PlayerId>,
  path: string,
): BoardState {
  const board = expectRecord(value, path);
  const map = getGameMapDefinition(mapId);
  const tiles = expectArray(board.tiles, `${path}.tiles`).map((tile, index) =>
    parseTile(tile, `${path}.tiles[${index}]`),
  );
  expectUniqueBy(tiles, (tile) => tile.id, `${path}.tiles`);

  const terrainCounts = countBy(tiles, (tile) => tile.terrain);
  if (
    TERRAIN_TYPES.some(
      (terrain) => (terrainCounts.get(terrain) ?? 0) !== map.terrainCounts[terrain],
    )
  ) {
    invalid(`${path}.tiles`, `does not match the ${mapId} terrain set`);
  }
  if (
    !sameCounts(
      countBy(
        tiles.flatMap((tile) => (tile.numberToken === null ? [] : [tile.numberToken])),
        (token) => token,
      ),
      countBy(map.numberTokens, (token) => token),
    )
  ) {
    invalid(`${path}.tiles`, `does not match the ${mapId} number tokens`);
  }

  const topology = getBoardTopology(tiles);
  const tileIds = new Set(tiles.map((tile) => tile.id));
  const vertexKeys = new Set(topology.vertexKeys);
  const edgeKeys = new Set(topology.edgeKeys);

  const buildings = expectArray(board.buildings, `${path}.buildings`).map(
    (candidate, index): BuildingState => {
      const buildingPath = `${path}.buildings[${index}]`;
      const building = expectRecord(candidate, buildingPath);
      return {
        kind: expectMember(building.kind, BUILDING_KINDS, `${buildingPath}.kind`),
        playerId: expectKnownId(building.playerId, playerIds, `${buildingPath}.playerId`),
        vertexKey: expectKnownId(building.vertexKey, vertexKeys, `${buildingPath}.vertexKey`),
      };
    },
  );
  expectUniqueBy(buildings, (building) => building.vertexKey, `${path}.buildings`);

  const roads = expectArray(board.roads, `${path}.roads`).map((candidate, index): RoadState => {
    const roadPath = `${path}.roads[${index}]`;
    const road = expectRecord(candidate, roadPath);
    return {
      edgeKey: expectKnownId(road.edgeKey, edgeKeys, `${roadPath}.edgeKey`),
      playerId: expectKnownId(road.playerId, playerIds, `${roadPath}.playerId`),
    };
  });
  expectUniqueBy(roads, (road) => road.edgeKey, `${path}.roads`);

  const portTrades: readonly PortTrade[] = ["any", ...RESOURCE_TYPES];
  const ports = expectArray(board.ports, `${path}.ports`).map(
    (candidate, index): PortDescriptor => {
      const portPath = `${path}.ports[${index}]`;
      const port = expectRecord(candidate, portPath);
      return {
        edgeKey: expectKnownId(port.edgeKey, edgeKeys, `${portPath}.edgeKey`),
        id: expectIdentifier(port.id, `${portPath}.id`),
        trade: expectMember(port.trade, portTrades, `${portPath}.trade`),
      };
    },
  );
  expectUniqueBy(ports, (port) => port.id, `${path}.ports`);
  expectUniqueBy(ports, (port) => port.edgeKey, `${path}.ports`);
  if (
    !sameCounts(
      countBy(ports, (port) => port.trade),
      countBy(map.portTrades, (trade) => trade),
    )
  ) {
    invalid(`${path}.ports`, `does not match the ${mapId} harbours`);
  }

  return {
    buildings,
    ports,
    roads,
    robberTileId: expectKnownId(board.robberTileId, tileIds, `${path}.robberTileId`),
    tiles,
  };
}

function parsePhase(
  value: unknown,
  path: string,
  playerIds: ReadonlySet<PlayerId>,
  board: BoardState,
): GamePhase {
  const phase = expectRecord(value, path);
  const kind = expectMember(phase.kind, PHASE_KINDS, `${path}.kind`);
  const resumePhase = () => expectMember(phase.resumePhase, RESUME_PHASES, `${path}.resumePhase`);

  switch (kind) {
    case "setup_settlement":
      return { kind, setupIndex: expectInteger(phase.setupIndex, `${path}.setupIndex`, 0) };
    case "setup_road":
      return {
        kind,
        settlementVertexKey: expectKnownId(
          phase.settlementVertexKey,
          new Set(board.buildings.map((building) => building.vertexKey)),
          `${path}.settlementVertexKey`,
        ),
        setupIndex: expectInteger(phase.setupIndex, `${path}.setupIndex`, 0),
      };
    case "discard": {
      const pending = expectArray(phase.pending, `${path}.pending`).map((candidate, index) => {
        const requirementPath = `${path}.pending[${index}]`;
        const requirement = expectRecord(candidate, requirementPath);
        return {
          count: expectInteger(requirement.count, `${requirementPath}.count`, 1),
          playerId: expectKnownId(requirement.playerId, playerIds, `${requirementPath}.playerId`),
        };
      });
      expectUniqueBy(pending, (requirement) => requirement.playerId, `${path}.pending`);
      if (pending.length === 0) {
        invalid(`${path}.pending`, "must list at least one player");
      }
      return { kind, pending };
    }
    case "move_robber":
      return { kind, resumePhase: resumePhase() };
    case "steal": {
      const eligibleVictimIds = expectUniqueIds(
        phase.eligibleVictimIds,
        `${path}.eligibleVictimIds`,
        playerIds,
      );
      if (eligibleVictimIds.length === 0) {
        invalid(`${path}.eligibleVictimIds`, "must list at least one victim");
      }
      return { eligibleVictimIds, kind, resumePhase: resumePhase() };
    }
    case "road_building": {
      const remainingRoads = expectInteger(phase.remainingRoads, `${path}.remainingRoads`, 1);
      if (remainingRoads > 2) {
        invalid(`${path}.remainingRoads`, "cannot exceed two roads");
      }
      return { kind, remainingRoads, resumePhase: resumePhase() };
    }
    case "roll":
    case "build_and_trade":
    case "finished":
      return { kind };
  }
}

function parseTradeOffer(
  value: unknown,
  path: string,
  playerIds: ReadonlySet<PlayerId>,
): TradeOffer | null {
  if (value === null) {
    return null;
  }

  const offer = expectRecord(value, path);
  return {
    acceptedPlayerIds: expectUniqueIds(
      offer.acceptedPlayerIds,
      `${path}.acceptedPlayerIds`,
      playerIds,
    ),
    give: parseInventory(offer.give, `${path}.give`),
    offerActionNumber: expectInteger(offer.offerActionNumber, `${path}.offerActionNumber`, 1),
    proposerPlayerId: expectKnownId(offer.proposerPlayerId, playerIds, `${path}.proposerPlayerId`),
    recipientPlayerIds: expectUniqueIds(
      offer.recipientPlayerIds,
      `${path}.recipientPlayerIds`,
      playerIds,
    ),
    rejectedPlayerIds: expectUniqueIds(
      offer.rejectedPlayerIds,
      `${path}.rejectedPlayerIds`,
      playerIds,
    ),
    want: parseInventory(offer.want, `${path}.want`),
  };
}

function parseSharedGame(
  game: UnknownRecord,
  path: string,
  playerIds: ReadonlySet<PlayerId>,
): SharedGameState {
  const settings = parseSettings(game.settings, `${path}.settings`);
  const board = parseBoard(game.board, settings.map, playerIds, `${path}.board`);
  const turnOrder = expectUniqueIds(game.turnOrder, `${path}.turnOrder`, playerIds);

  if (playerIds.size !== settings.maxPlayers) {
    invalid(`${path}.players`, "must match settings.maxPlayers");
  }
  if (turnOrder.length !== playerIds.size) {
    invalid(`${path}.turnOrder`, "must contain every player exactly once");
  }

  return {
    actionNumber: expectInteger(game.actionNumber, `${path}.actionNumber`, 0),
    activePlayerId: expectKnownId(game.activePlayerId, playerIds, `${path}.activePlayerId`),
    board,
    developmentCardPlayedThisTurn: expectBoolean(
      game.developmentCardPlayedThisTurn,
      `${path}.developmentCardPlayedThisTurn`,
    ),
    developmentCardsBoughtThisTurn: expectInteger(
      game.developmentCardsBoughtThisTurn,
      `${path}.developmentCardsBoughtThisTurn`,
      0,
    ),
    lastDiceRoll:
      game.lastDiceRoll === null ? null : parseDiceRoll(game.lastDiceRoll, `${path}.lastDiceRoll`),
    largestArmyPlayerId: expectNullableKnownId(
      game.largestArmyPlayerId,
      playerIds,
      `${path}.largestArmyPlayerId`,
    ),
    longestRoadPlayerId: expectNullableKnownId(
      game.longestRoadPlayerId,
      playerIds,
      `${path}.longestRoadPlayerId`,
    ),
    phase: parsePhase(game.phase, `${path}.phase`, playerIds, board),
    settings,
    tradeOffer: parseTradeOffer(game.tradeOffer, `${path}.tradeOffer`, playerIds),
    turnNumber: expectInteger(game.turnNumber, `${path}.turnNumber`, 0),
    turnOrder,
    winnerPlayerId: expectNullableKnownId(game.winnerPlayerId, playerIds, `${path}.winnerPlayerId`),
  };
}

function checkPiecesAndScores(game: GameState): void {
  for (const player of game.players) {
    const path = `game.players.${player.id}`;
    const buildings = game.board.buildings.filter((building) => building.playerId === player.id);
    const cities = buildings.filter((building) => building.kind === "city").length;
    const settlements = buildings.length - cities;
    const roads = game.board.roads.filter((road) => road.playerId === player.id).length;

    if (
      player.piecesRemaining.cities !== INITIAL_PIECES.cities - cities ||
      player.piecesRemaining.settlements !== INITIAL_PIECES.settlements - settlements ||
      player.piecesRemaining.roads !== INITIAL_PIECES.roads - roads
    ) {
      invalid(`${path}.piecesRemaining`, "does not match pieces placed on the board");
    }

    const expectedVictoryPoints =
      settlements +
      cities * 2 +
      (player.id === game.largestArmyPlayerId ? LARGEST_ARMY_VICTORY_POINTS : 0) +
      (player.id === game.longestRoadPlayerId ? LONGEST_ROAD_VICTORY_POINTS : 0);
    if (player.victoryPoints !== expectedVictoryPoints) {
      invalid(`${path}.victoryPoints`, "does not match the player's buildings and awards");
    }
  }

  if (game.largestArmyPlayerId !== getLargestArmyPlayerId(game.players, game.largestArmyPlayerId)) {
    invalid("game.largestArmyPlayerId", "does not match played knight cards");
  }
  if (
    game.longestRoadPlayerId !==
    getLongestRoadPlayerId(
      game.board,
      game.players.map((player) => player.id),
      game.longestRoadPlayerId,
    )
  ) {
    invalid("game.longestRoadPlayerId", "does not match the board's longest road");
  }
}

function checkCardConservation(game: GameState): void {
  const map = getGameMapDefinition(game.settings.map);

  for (const resource of RESOURCE_TYPES) {
    const total = game.players.reduce(
      (sum, player) => sum + player.resources[resource],
      game.bank[resource],
    );
    if (total !== map.bankResourceCount) {
      invalid(
        `game.${resource}`,
        `must total ${map.bankResourceCount} cards across bank and players`,
      );
    }
  }

  const cardCounts = countBy(
    [
      ...game.developmentDeck,
      ...game.players.flatMap((player) => [
        ...player.developmentCards,
        ...player.playedDevelopmentCards,
      ]),
    ],
    (card) => card,
  );
  for (const card of DEVELOPMENT_CARD_TYPES) {
    if ((cardCounts.get(card) ?? 0) !== map.developmentCardCounts[card]) {
      invalid(`game.${card}`, "must match the development card supply");
    }
  }
}

function checkBalancedDiceBag(game: GameState): void {
  if (!game.settings.balancedDice && game.balancedDiceBag.length > 0) {
    invalid("game.balancedDiceBag", "must be empty without balanced dice");
  }

  const seenRolls = new Set<string>();
  for (const { first, second } of game.balancedDiceBag) {
    const key = `${first}:${second}`;
    if (seenRolls.has(key)) {
      invalid("game.balancedDiceBag", "must hold each dice combination at most once");
    }
    seenRolls.add(key);
  }
}

function checkSetupProgress(game: GameState, setupIndex: number, settlementsPlaced: number) {
  const seat = getSetupSeatOrder(game.players.length)[setupIndex];

  if (seat === undefined) {
    invalid("game.phase.setupIndex", "is past the end of setup");
  }
  if (game.activePlayerId !== game.turnOrder[seat]) {
    invalid("game.activePlayerId", "is not the player placing this setup piece");
  }
  if (game.board.buildings.length !== settlementsPlaced || game.board.roads.length !== setupIndex) {
    invalid("game.board", "does not match the setup progress");
  }
}

function checkPhase(game: GameState, activePlayer: PlayerState): void {
  const { phase } = game;

  if ((game.winnerPlayerId !== null) !== (phase.kind === "finished")) {
    invalid("game.winnerPlayerId", "must be set exactly when the game is finished");
  }

  switch (phase.kind) {
    case "setup_settlement":
      checkSetupProgress(game, phase.setupIndex, phase.setupIndex);
      return;
    case "setup_road":
      checkSetupProgress(game, phase.setupIndex, phase.setupIndex + 1);
      if (
        game.board.buildings.find((building) => building.vertexKey === phase.settlementVertexKey)
          ?.playerId !== activePlayer.id
      ) {
        invalid("game.phase.settlementVertexKey", "must be the active player's new settlement");
      }
      return;
  }

  for (const player of game.players) {
    if (
      game.board.buildings.filter((building) => building.playerId === player.id).length < 2 ||
      game.board.roads.filter((road) => road.playerId === player.id).length < 2
    ) {
      invalid(`game.players.${player.id}`, "must finish opening setup before play continues");
    }
  }

  switch (phase.kind) {
    case "discard":
      for (const { count, playerId } of phase.pending) {
        const handSize = totalResources(game.players.find(({ id }) => id === playerId)!.resources);
        if (handSize <= game.settings.discardLimit || count !== Math.floor(handSize / 2)) {
          invalid("game.phase.pending", "must require half of each oversized hand");
        }
      }
      return;
    case "steal":
      for (const victimId of phase.eligibleVictimIds) {
        const victim = game.players.find(({ id }) => id === victimId)!;
        if (victim.id === activePlayer.id || totalResources(victim.resources) === 0) {
          invalid("game.phase.eligibleVictimIds", "must list opponents holding resources");
        }
      }
      return;
    case "road_building":
      if (phase.remainingRoads > activePlayer.piecesRemaining.roads) {
        invalid("game.phase.remainingRoads", "exceeds the active player's remaining roads");
      }
      return;
  }
}

function checkTradeOffer(game: GameState, activePlayer: PlayerState): void {
  const offer = game.tradeOffer;
  if (!offer) {
    return;
  }

  const path = "game.tradeOffer";
  const responders = [...offer.acceptedPlayerIds, ...offer.rejectedPlayerIds];

  if (game.phase.kind !== "build_and_trade" || offer.proposerPlayerId !== activePlayer.id) {
    invalid(path, "must come from the active player after rolling");
  }
  if (offer.offerActionNumber > game.actionNumber) {
    invalid(`${path}.offerActionNumber`, "is ahead of the game");
  }
  if (
    offer.recipientPlayerIds.length === 0 ||
    offer.recipientPlayerIds.includes(offer.proposerPlayerId)
  ) {
    invalid(`${path}.recipientPlayerIds`, "must list at least one opponent");
  }
  if (
    new Set(responders).size !== responders.length ||
    responders.some((playerId) => !offer.recipientPlayerIds.includes(playerId))
  ) {
    invalid(path, "must record at most one response from each recipient");
  }
  if (offer.rejectedPlayerIds.length === offer.recipientPlayerIds.length) {
    invalid(`${path}.rejectedPlayerIds`, "cannot include every recipient");
  }
  if (
    totalResources(offer.give) === 0 ||
    totalResources(offer.want) === 0 ||
    RESOURCE_TYPES.some((resource) => offer.give[resource] > 0 && offer.want[resource] > 0)
  ) {
    invalid(path, "must give and request different resources");
  }
  if (!hasResources(activePlayer.resources, offer.give)) {
    invalid(`${path}.give`, "exceeds the proposer's hand");
  }
  for (const playerId of offer.acceptedPlayerIds) {
    if (!hasResources(game.players.find(({ id }) => id === playerId)!.resources, offer.want)) {
      invalid(`${path}.acceptedPlayerIds`, "includes a player who cannot afford the trade");
    }
  }
}

function checkGameInvariants(game: GameState): void {
  const activePlayer = game.players.find((player) => player.id === game.activePlayerId)!;

  if (game.developmentCardsBoughtThisTurn > activePlayer.developmentCards.length) {
    invalid("game.developmentCardsBoughtThisTurn", "exceeds the active player's hand");
  }
  checkPiecesAndScores(game);
  checkCardConservation(game);
  checkBalancedDiceBag(game);
  checkPhase(game, activePlayer);
  checkTradeOffer(game, activePlayer);
}

export function assertGameState(value: unknown): asserts value is GameState {
  const game = expectRecord(value, "game");
  const players = parsePlayers(game.players, "game.players", parseStatePlayer);

  checkGameInvariants({
    ...parseSharedGame(game, "game", new Set(players.map((player) => player.id))),
    balancedDiceBag: expectArray(game.balancedDiceBag, "game.balancedDiceBag").map((roll, index) =>
      parseDiceRoll(roll, `game.balancedDiceBag[${index}]`),
    ),
    bank: parseInventory(game.bank, "game.bank"),
    developmentDeck: parseDevelopmentCards(game.developmentDeck, "game.developmentDeck"),
    players,
    randomIndex: expectInteger(game.randomIndex, "game.randomIndex", 0),
    seed: expectIdentifier(game.seed, "game.seed"),
  });
}

function parseLegalActions(value: unknown, path: string): LegalActions {
  const actions = expectRecord(value, path);
  const flag = (key: string) => expectBoolean(actions[key], `${path}.${key}`);
  const ids = (key: string) => expectUniqueIds(actions[key], `${path}.${key}`);
  const playableDevelopmentCards = parsePlayedDevelopmentCards(
    actions.playableDevelopmentCards,
    `${path}.playableDevelopmentCards`,
  );
  expectUniqueBy(playableDevelopmentCards, (card) => card, `${path}.playableDevelopmentCards`);

  return {
    bankTrades: expectArray(actions.bankTrades, `${path}.bankTrades`).map(
      (candidate, index): BankTradeOption => {
        const tradePath = `${path}.bankTrades[${index}]`;
        const trade = expectRecord(candidate, tradePath);
        return {
          give: expectMember(trade.give, RESOURCE_TYPES, `${tradePath}.give`),
          ratio: expectInteger(trade.ratio, `${tradePath}.ratio`, 1),
          receive: expectMember(trade.receive, RESOURCE_TYPES, `${tradePath}.receive`),
        };
      },
    ),
    canBuyDevelopmentCard: flag("canBuyDevelopmentCard"),
    canCancelTrade: flag("canCancelTrade"),
    canEndTurn: flag("canEndTurn"),
    canProposeTrade: flag("canProposeTrade"),
    canRespondToTrade: flag("canRespondToTrade"),
    canRoll: flag("canRoll"),
    cityVertexKeys: ids("cityVertexKeys"),
    discardCount:
      actions.discardCount === null
        ? null
        : expectInteger(actions.discardCount, `${path}.discardCount`, 1),
    isRequiredActor: flag("isRequiredActor"),
    playableDevelopmentCards,
    roadEdgeKeys: ids("roadEdgeKeys"),
    robberTileIds: ids("robberTileIds"),
    settlementVertexKeys: ids("settlementVertexKeys"),
    tradePartnerPlayerIds: ids("tradePartnerPlayerIds"),
    victimPlayerIds: ids("victimPlayerIds"),
  };
}

/**
 * Checks a view's shape and that it hides other players' private data. Game-rule invariants are
 * enforced on the server's state by assertGameState, so they are not re-derived here.
 */
export function assertPlayerGameView(value: unknown): asserts value is PlayerGameView {
  const view = expectRecord(value, "view");

  for (const field of PRIVATE_GAME_FIELDS) {
    if (field in view) {
      invalid(`view.${field}`, "must stay private to the server");
    }
  }

  const viewerPlayerId = expectIdentifier(view.viewerPlayerId, "view.viewerPlayerId");
  const players = parsePlayers(view.players, "view.players", (player, path) =>
    parseViewPlayer(player, path, viewerPlayerId),
  );
  if (!players.some((player) => player.isViewer)) {
    invalid("view.viewerPlayerId", "must identify one of the players");
  }

  const shared = parseSharedGame(view, "view", new Set(players.map((player) => player.id)));
  const bank = view.bank === null ? null : parseInventory(view.bank, "view.bank");
  if ((bank === null) !== shared.settings.hideBankCards) {
    invalid("view.bank", "must be hidden exactly when hideBankCards is on");
  }

  const isFinished = shared.phase.kind === "finished";
  for (const player of players) {
    if (!player.isViewer && (player.revealedVictoryPointCards !== null) !== isFinished) {
      invalid(
        `view.players.${player.id}.revealedVictoryPointCards`,
        "must only reveal victory point cards after the game is complete",
      );
    }
  }

  expectInteger(view.developmentCardSupply, "view.developmentCardSupply", 0);
  parseLegalActions(view.legalActions, "view.legalActions");
}
