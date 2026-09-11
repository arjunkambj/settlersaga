import type { GameMapId, PlayerCount, TerrainType } from "./types";

export interface GameMapDefinition {
  readonly description: string;
  readonly id: GameMapId;
  readonly label: string;
  readonly numberTokens: readonly number[];
  readonly playerCounts: readonly PlayerCount[];
  readonly portCount: number;
  readonly terrainCounts: Readonly<Record<TerrainType, number>>;
  readonly tileCount: number;
}

const BASE_PLAYER_COUNTS = [3, 4] as const satisfies readonly PlayerCount[];
const EXTENDED_6_PLAYER_COUNTS = [5, 6] as const satisfies readonly PlayerCount[];
const EXTENDED_8_PLAYER_COUNTS = [7, 8] as const satisfies readonly PlayerCount[];
const BASE_SPIRAL_NUMBER_TOKENS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const EXTENDED_6_NUMBER_TOKENS = [
  2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
];
const EXTENDED_8_NUMBER_TOKENS = [
  2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11,
  11, 12, 12, 12,
];

export const GAME_MAP_DEFINITIONS: Readonly<Record<GameMapId, GameMapDefinition>> = Object.freeze({
  base: Object.freeze({
    description: "19 terrain tiles and 1 desert — the standard 3–4 player island.",
    id: "base",
    label: "3–4 player map",
    numberTokens: Object.freeze(BASE_SPIRAL_NUMBER_TOKENS),
    playerCounts: BASE_PLAYER_COUNTS,
    portCount: 9,
    terrainCounts: Object.freeze({
      desert: 1,
      fields: 4,
      forest: 4,
      hills: 3,
      mountains: 3,
      pasture: 4,
    }),
    tileCount: 19,
  }),
  "extended-6": Object.freeze({
    description: "30 terrain tiles and 2 deserts — the official 5–6 player board size.",
    id: "extended-6",
    label: "5–6 player map",
    numberTokens: Object.freeze(EXTENDED_6_NUMBER_TOKENS),
    playerCounts: EXTENDED_6_PLAYER_COUNTS,
    portCount: 11,
    terrainCounts: Object.freeze({
      desert: 2,
      fields: 6,
      forest: 6,
      hills: 5,
      mountains: 5,
      pasture: 6,
    }),
    tileCount: 30,
  }),
  "extended-8": Object.freeze({
    description: "37 terrain tiles and 2 deserts — Setter's 7–8 player board size.",
    id: "extended-8",
    label: "7–8 player map",
    numberTokens: Object.freeze(EXTENDED_8_NUMBER_TOKENS),
    playerCounts: EXTENDED_8_PLAYER_COUNTS,
    portCount: 12,
    terrainCounts: Object.freeze({
      desert: 2,
      fields: 7,
      forest: 8,
      hills: 6,
      mountains: 6,
      pasture: 8,
    }),
    tileCount: 37,
  }),
});

export const AVAILABLE_GAME_MAPS: readonly GameMapDefinition[] = Object.freeze(
  Object.values(GAME_MAP_DEFINITIONS),
);

export function getGameMapDefinition(mapId: GameMapId): GameMapDefinition {
  return GAME_MAP_DEFINITIONS[mapId];
}

export function isGameMapId(value: unknown): value is GameMapId {
  return typeof value === "string" && value in GAME_MAP_DEFINITIONS;
}

export function mapSupportsPlayerCount(mapId: unknown, playerCount: number): boolean {
  if (!isGameMapId(mapId)) {
    return false;
  }

  return GAME_MAP_DEFINITIONS[mapId].playerCounts.some((count) => count === playerCount);
}
