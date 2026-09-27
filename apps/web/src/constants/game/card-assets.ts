import type { DevelopmentCardType, ResourceType } from "@settersaga/game";

export const RESOURCE_CARD_ASSET_PATHS: Readonly<Record<ResourceType, string>> = {
  brick: "/game-assets/card-art/resources/brick.png",
  sheep: "/game-assets/card-art/resources/sheep.png",
  stone: "/game-assets/card-art/resources/stone.png",
  tree: "/game-assets/card-art/resources/tree.png",
  wheat: "/game-assets/card-art/resources/wheat.png",
};

/** Each resource as a small icon (its terrain's own), for prices and what a player still needs. */
export const RESOURCE_ICON_ASSET_PATHS: Readonly<Record<ResourceType, string>> = {
  brick: "/game-assets/terrain/icons/hills.png",
  sheep: "/game-assets/terrain/icons/pasture.png",
  stone: "/game-assets/terrain/icons/mountains.png",
  tree: "/game-assets/terrain/icons/forest.png",
  wheat: "/game-assets/terrain/icons/fields.png",
};

export const DEVELOPMENT_CARD_BACK_ASSET_PATH = "/game-assets/card-art/development/card-back.png";

export const UNKNOWN_RESOURCE_CARD_ASSET_PATH = "/game-assets/card-art/resources/unknown.png";

export const ACTION_CARD_ASSET_PATHS = {
  city: "/game-assets/card-art/actions/city.png",
  road: "/game-assets/card-art/actions/road.png",
  settlement: "/game-assets/card-art/actions/settlement.png",
  trade: "/game-assets/card-art/actions/trade.png",
} as const;

export const DEVELOPMENT_CARD_ASSET_PATHS: Readonly<Record<DevelopmentCardType, string>> = {
  knight: "/game-assets/card-art/development/knight.png",
  monopoly: "/game-assets/card-art/development/monopoly.png",
  "road-building": "/game-assets/card-art/development/road-building.png",
  "victory-point": "/game-assets/card-art/development/victory-point.png",
  "year-of-plenty": "/game-assets/card-art/development/year-of-plenty.png",
};

export const DEVELOPMENT_CARD_ASSETS = [
  {
    description: "Move the robber and steal a resource.",
    id: "knight",
    label: "Knight",
    path: DEVELOPMENT_CARD_ASSET_PATHS.knight,
  },
  {
    description: "Build two roads for free.",
    id: "road-building",
    label: "Road Building",
    path: DEVELOPMENT_CARD_ASSET_PATHS["road-building"],
  },
  {
    description: "Take any two resources from the bank.",
    id: "year-of-plenty",
    label: "Year of Plenty",
    path: DEVELOPMENT_CARD_ASSET_PATHS["year-of-plenty"],
  },
  {
    description: "Name a resource. Every other player gives you all of theirs.",
    id: "monopoly",
    label: "Monopoly",
    path: DEVELOPMENT_CARD_ASSET_PATHS.monopoly,
  },
  {
    description: "Worth 1 victory point. Only you can see it.",
    id: "victory-point",
    label: "Victory Point",
    path: DEVELOPMENT_CARD_ASSET_PATHS["victory-point"],
  },
] as const;
