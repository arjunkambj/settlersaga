import type { TerrainType } from "@settersaga/game";

export const BOARD_TILE = {
  radius: 145,
  renderSize: 364,
} as const;

export const TERRAIN_ATLAS_ASSET_PATH = "/game-assets/terrain/terrain-atlas-board.webp";

/** One small icon per terrain; harbor sails use them to show which resource they trade. */
export const TERRAIN_ICON_ASSET_PATHS: Readonly<Record<TerrainType, string>> = {
  desert: "/game-assets/terrain/icons/desert.png",
  fields: "/game-assets/terrain/icons/fields.png",
  forest: "/game-assets/terrain/icons/forest.png",
  hills: "/game-assets/terrain/icons/hills.png",
  mountains: "/game-assets/terrain/icons/mountains.png",
  pasture: "/game-assets/terrain/icons/pasture.png",
};

/** Calm ground for each terrain, laid out like TERRAIN_ATLAS; the board draws the feature on top. */
export const TERRAIN_GROUND_ATLAS_ASSET_PATH = "/game-assets/terrain/ground-atlas.webp";

/** Each terrain's feature (trees, sheep, wheat...), drawn at one size and spot on every tile. */
export const TERRAIN_FEATURE_ASSET_PATHS: Readonly<Record<TerrainType, string>> = {
  desert: "/game-assets/terrain/features/desert.png",
  fields: "/game-assets/terrain/features/fields.png",
  forest: "/game-assets/terrain/features/forest.png",
  hills: "/game-assets/terrain/features/hills.png",
  mountains: "/game-assets/terrain/features/mountains.png",
  pasture: "/game-assets/terrain/features/pasture.png",
};

export const TERRAIN_ATLAS = {
  columns: 3,
  frameSize: 512,
  frames: {
    desert: { column: 2, row: 1 },
    fields: { column: 0, row: 0 },
    forest: { column: 1, row: 0 },
    hills: { column: 2, row: 0 },
    mountains: { column: 0, row: 1 },
    pasture: { column: 1, row: 1 },
  },
  rows: 2,
} as const;

export const PIECE_ASSET_PATHS = {
  city: "/game-assets/pieces/city-piece.png",
  road: "/game-assets/pieces/road-piece.png",
  settlement: "/game-assets/pieces/settlement-piece.png",
} as const;

/**
 * Settlement and city art for the board. Player-colored parts are painted in a key magenta that
 * the board swaps for each seat color (board-piece-art.ts). Roads are drawn in code from
 * ROAD_TEXTURE_ASSET_PATH so they join at corners. The HUD shows the build cards instead.
 */
export const BOARD_PIECE_ART_PATHS = {
  city: "/game-assets/pieces/board/city.png",
  settlement: "/game-assets/pieces/board/settlement.png",
} as const;

/** Painted wood tiled along each road, recolored per seat like the building art. */
export const ROAD_TEXTURE_ASSET_PATH = "/game-assets/pieces/board/road-texture.png";

export const ROBBER_ASSET_PATH = "/game-assets/pieces/robber-piece.png";

export const OCEAN_BOARD_ASSET_PATH = "/game-assets/ui/ocean-board-canvas.webp";
export const PORT_DOCK_ASSET_PATH = "/game-assets/ui/port-bridge.png";
/** The wooden pier laid from each harbor corner out to its ship. */
export const PORT_WALKWAY_ASSET_PATH = "/game-assets/ui/port-pier.png";
export const PORT_BOAT_ASSET_PATH = "/game-assets/ui/port-ship.png";
export const PORT_BOAT_RENDER_SIZE = {
  height: 112,
  width: 86,
} as const;
/** The plain part of the sail, in fractions of the ship image, where the trade is printed. */
export const PORT_BOAT_SAIL = {
  centerX: 0.49,
  centerY: 0.4,
  height: 0.37,
  width: 0.82,
} as const;
