import type { ResourceType, TerrainType } from "@settersaga/game";

export const RESOURCE_LABELS: Readonly<Record<ResourceType, string>> = {
  brick: "Brick",
  sheep: "Sheep",
  stone: "Stone",
  tree: "Wood",
  wheat: "Wheat",
};

export const TERRAIN_LABELS: Readonly<Record<TerrainType, string>> = {
  desert: "Desert",
  fields: "Fields",
  forest: "Forest",
  hills: "Hills",
  mountains: "Mountains",
  pasture: "Pasture",
};
