import type { ResourceType } from "@settersaga/game";

export const RESOURCE_CARD_ASSET_PATHS: Readonly<Record<ResourceType, string>> = {
  brick: "/game-assets/cards/resources/brick-card.png",
  sheep: "/game-assets/cards/resources/sheep-card.png",
  stone: "/game-assets/cards/resources/stone-card.png",
  tree: "/game-assets/cards/resources/tree-card.png",
  wheat: "/game-assets/cards/resources/wheat-card.png",
};

export const DEVELOPMENT_CARD_BACK_ASSET_PATH =
  "/game-assets/cards/development/hidden-card-back.png";

export const UNKNOWN_RESOURCE_CARD_ASSET_PATH =
  "/game-assets/cards/resources/unknown-resource-card-purple.png";

export const ACTION_CARD_ASSET_PATHS = {
  city: "/game-assets/cards/actions/city.png",
  road: "/game-assets/cards/actions/road.png",
  settlement: "/game-assets/cards/actions/settlement.png",
  trade: "/game-assets/cards/actions/trade.png",
} as const;

export const DEVELOPMENT_CARD_ASSETS = [
  {
    description: "Move the robber and steal a resource.",
    id: "knight",
    label: "Knight",
    path: "/game-assets/cards/development/knight.png",
  },
  {
    description: "Build two roads without paying their resource costs.",
    id: "road-building",
    label: "Road Building",
    path: "/game-assets/cards/development/road-building.png",
  },
  {
    description: "Take two available resources from the bank.",
    id: "year-of-plenty",
    label: "Year of Plenty",
    path: "/game-assets/cards/development/year-of-plenty.png",
  },
  {
    description: "Collect one named resource from every opponent.",
    id: "monopoly",
    label: "Monopoly",
    path: "/game-assets/cards/development/monopoly.png",
  },
  {
    description: "A hidden victory point toward winning the game.",
    id: "victory-point",
    label: "Victory Point",
    path: "/game-assets/cards/development/victory-point.png",
  },
] as const;

export function getResourceCardAssetPath(resource: ResourceType): string {
  return RESOURCE_CARD_ASSET_PATHS[resource];
}
