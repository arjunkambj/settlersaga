import { NUMBER_TOKENS } from "./types";
import type {
  DevelopmentCardType,
  GameMapId,
  NumberToken,
  PlayerCount,
  PortTrade,
  TerrainType,
} from "./types";

export interface GameMapDefinition {
  readonly bankResourceCount: number;
  readonly description: string;
  readonly developmentCardCounts: Readonly<Record<DevelopmentCardType, number>>;
  readonly id: GameMapId;
  readonly label: string;
  readonly numberTokens: readonly NumberToken[];
  readonly playerCounts: readonly PlayerCount[];
  readonly portTrades: readonly PortTrade[];
  readonly terrainCounts: Readonly<Record<TerrainType, number>>;
}

function numberTokenSet(counts: Readonly<Record<NumberToken, number>>): NumberToken[] {
  return NUMBER_TOKENS.flatMap((token) => Array.from({ length: counts[token] }, () => token));
}

const GAME_MAP_DEFINITIONS: Readonly<Record<GameMapId, GameMapDefinition>> = {
  base: {
    bankResourceCount: 19,
    description: "18 resource tiles and 1 desert — the standard 3–4 player island.",
    developmentCardCounts: {
      knight: 14,
      monopoly: 2,
      "road-building": 2,
      "victory-point": 5,
      "year-of-plenty": 2,
    },
    id: "base",
    label: "3–4 player map",
    numberTokens: [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11],
    playerCounts: [3, 4],
    portTrades: ["any", "any", "any", "any", "tree", "brick", "sheep", "wheat", "stone"],
    terrainCounts: { desert: 1, fields: 4, forest: 4, hills: 3, mountains: 3, pasture: 4 },
  },
  "extended-6": {
    bankResourceCount: 24,
    description: "28 resource tiles and 2 deserts — the official 5–6 player board.",
    developmentCardCounts: {
      knight: 20,
      monopoly: 3,
      "road-building": 3,
      "victory-point": 5,
      "year-of-plenty": 3,
    },
    id: "extended-6",
    label: "5–6 player map",
    numberTokens: numberTokenSet({ 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 }),
    playerCounts: [5, 6],
    portTrades: [
      "any",
      "any",
      "any",
      "any",
      "any",
      "tree",
      "brick",
      "sheep",
      "sheep",
      "wheat",
      "stone",
    ],
    terrainCounts: { desert: 2, fields: 6, forest: 6, hills: 5, mountains: 5, pasture: 6 },
  },
  // There is no official 7–8 player set; these counts extrapolate the 5–6 player extension.
  "extended-8": {
    bankResourceCount: 29,
    description: "35 resource tiles and 2 deserts — SetterSaga's 7–8 player board.",
    developmentCardCounts: {
      knight: 26,
      monopoly: 4,
      "road-building": 4,
      "victory-point": 6,
      "year-of-plenty": 4,
    },
    id: "extended-8",
    label: "7–8 player map",
    numberTokens: numberTokenSet({ 2: 2, 3: 4, 4: 4, 5: 4, 6: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 1 }),
    playerCounts: [7, 8],
    portTrades: [
      "any",
      "any",
      "any",
      "any",
      "any",
      "any",
      "tree",
      "brick",
      "sheep",
      "sheep",
      "wheat",
      "stone",
    ],
    terrainCounts: { desert: 2, fields: 7, forest: 8, hills: 6, mountains: 6, pasture: 8 },
  },
};

export const AVAILABLE_GAME_MAPS: readonly GameMapDefinition[] =
  Object.values(GAME_MAP_DEFINITIONS);

export function getGameMapDefinition(mapId: GameMapId): GameMapDefinition {
  return GAME_MAP_DEFINITIONS[mapId];
}

export function mapSupportsPlayerCount(mapId: GameMapId, playerCount: number): boolean {
  return GAME_MAP_DEFINITIONS[mapId].playerCounts.some((count) => count === playerCount);
}
