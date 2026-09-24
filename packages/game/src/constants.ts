import type {
  BuildingKind,
  NumberToken,
  PlayerPieces,
  ResourceInventory,
  ResourceType,
  TerrainType,
} from "./types";

export const BANK_TRADE_RATIO = 4;
export const ANY_PORT_TRADE_RATIO = 3;
export const RESOURCE_PORT_TRADE_RATIO = 2;

export const FRIENDLY_ROBBER_MAX_VICTORY_POINTS = 2;

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

export const NUMBER_TOKEN_PIPS: Readonly<Record<NumberToken, number>> = {
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

export const RESOURCE_ORDER: readonly ResourceType[] = ["tree", "brick", "sheep", "wheat", "stone"];
