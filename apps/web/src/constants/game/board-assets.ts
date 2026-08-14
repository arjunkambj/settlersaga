export const BOARD_TILE = {
  radius: 145,
  renderSize: 364,
} as const;

export const TERRAIN_ATLAS_ASSET_PATH = "/game-assets/terrain/terrain-atlas.png";

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
  rows: 6,
  variantCount: 3,
  variantRowCount: 2,
} as const;

export type TerrainAtlasTerrain = keyof typeof TERRAIN_ATLAS.frames;

const TERRAIN_VARIANT_SCALE: Readonly<
  Partial<Record<TerrainAtlasTerrain, readonly [number, number, number]>>
> = {
  forest: [1, 1.1, 1],
  hills: [1, 1, 1.03],
  mountains: [1, 1.08, 1],
  pasture: [1, 1, 1.06],
};

export function getTerrainAtlasFrame(terrain: TerrainAtlasTerrain, variationKey: string) {
  const frame = TERRAIN_ATLAS.frames[terrain];
  const variant = hashTerrainVariation(variationKey) % TERRAIN_ATLAS.variantCount;

  return {
    column: frame.column,
    row: frame.row + variant * TERRAIN_ATLAS.variantRowCount,
    scale: TERRAIN_VARIANT_SCALE[terrain]?.[variant] ?? 1,
  };
}

function hashTerrainVariation(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export const OCEAN_BOARD_ASSET_PATH = "/game-assets/ui/ocean-board-canvas.webp";
export const PORT_DOCK_ASSET_PATH = "/game-assets/ui/port-bridge.png";
export const PORT_BOAT_ASSET_PATH = "/game-assets/ui/port-merchant.png";
export const PORT_BOAT_RENDER_SIZE = {
  height: 138,
  width: 80,
} as const;

export const ROAD_ASSET_ROTATION_OFFSET = 0 as const;
