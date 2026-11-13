import type { PlayerColor } from "@settersaga/game";

const PLAYER_PORTRAIT_PATHS: Readonly<Record<PlayerColor, string>> = {
  blue: "/game-assets/portraits/blue-cartographer.png",
  green: "/game-assets/portraits/green-botanist.png",
  orange: "/game-assets/portraits/orange-builder.png",
  pink: "/game-assets/portraits/pink-pathfinder.png",
  purple: "/game-assets/portraits/purple-astronomer.png",
  red: "/game-assets/portraits/red-navigator.png",
  teal: "/game-assets/portraits/teal-shipwright.png",
  yellow: "/game-assets/portraits/yellow-merchant.png",
};

export function getPlayerPortraitPath(playerColor: PlayerColor): string {
  return PLAYER_PORTRAIT_PATHS[playerColor];
}
