import type {
  BaseGameSettings,
  BotDifficulty,
  BuildingKind,
  DevelopmentCardType,
  PlayerPieces,
  PlayerCount,
  ResourceInventory,
  ResourceType,
  TerrainType,
} from "./types";

export const BANK_RESOURCE_COUNT = 19;
export const BANK_TRADE_RATIO = 4;
export const ANY_PORT_TRADE_RATIO = 3;
export const RESOURCE_PORT_TRADE_RATIO = 2;
export const DEFAULT_DISCARD_LIMIT = 7;

export const DEFAULT_BASE_GAME_SETTINGS: Readonly<BaseGameSettings> = Object.freeze({
  balancedDice: true,
  discardLimit: DEFAULT_DISCARD_LIMIT,
  friendlyRobber: false,
  hideBankCards: false,
  map: "base",
  maxPlayers: 4,
  turnTimerSeconds: 60,
  victoryPoints: 10,
});

export const INITIAL_PIECES: Readonly<PlayerPieces> = {
  cities: 4,
  roads: 15,
  settlements: 5,
};

export const DEVELOPMENT_CARD_COST: Readonly<ResourceInventory> = {
  brick: 0,
  sheep: 1,
  stone: 1,
  tree: 0,
  wheat: 1,
};

export const DEVELOPMENT_CARD_DECK: readonly DevelopmentCardType[] = [
  ...Array.from({ length: 14 }, () => "knight" as const),
  ...Array.from({ length: 2 }, () => "monopoly" as const),
  ...Array.from({ length: 2 }, () => "road-building" as const),
  ...Array.from({ length: 5 }, () => "victory-point" as const),
  ...Array.from({ length: 2 }, () => "year-of-plenty" as const),
];

export const BUILD_COSTS: Readonly<Record<BuildingKind | "road", Readonly<ResourceInventory>>> = {
  city: { brick: 0, sheep: 0, stone: 3, tree: 0, wheat: 2 },
  road: { brick: 1, sheep: 0, stone: 0, tree: 1, wheat: 0 },
  settlement: { brick: 1, sheep: 1, stone: 0, tree: 1, wheat: 1 },
};

export const TERRAIN_RESOURCE: Readonly<Record<TerrainType, ResourceType | null>> = {
  desert: null,
  fields: "wheat",
  forest: "tree",
  hills: "brick",
  mountains: "stone",
  pasture: "sheep",
};

export const NUMBER_TOKEN_PIPS: Readonly<Record<number, number>> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

export function getSetupSeatOrder(playerCount: PlayerCount): number[] {
  const ascending = Array.from({ length: playerCount }, (_, index) => index);
  return [...ascending, ...[...ascending].reverse()];
}

export const RESOURCE_ORDER: readonly ResourceType[] = ["tree", "brick", "sheep", "wheat", "stone"];

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ["easy", "medium", "hard"];
export const TURN_TIMER_OPTIONS = [0, 30, 60, 90, 120] as const;
