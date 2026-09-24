export const BOARD_TILE = {
  radius: 145,
  renderSize: 364,
} as const;

export const TERRAIN_ATLAS_ASSET_PATH = "/game-assets/terrain/terrain-atlas.webp";

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

export const ROBBER_ASSET_PATH = "/game-assets/pieces/robber-piece.png";

export const OCEAN_BOARD_ASSET_PATH = "/game-assets/ui/ocean-board-canvas.webp";
export const PORT_DOCK_ASSET_PATH = "/game-assets/ui/port-bridge.png";
export const PORT_BOAT_ASSET_PATH = "/game-assets/ui/port-merchant.png";
export const PORT_BOAT_RENDER_SIZE = {
  height: 120,
  width: 80,
} as const;
/** The trade-ratio plaque drawn under each harbor boat. */
export const PORT_TRADE_BADGE_SIZE = {
  height: 42,
  width: 78,
} as const;
