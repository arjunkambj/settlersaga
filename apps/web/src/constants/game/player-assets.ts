import type { PlayerColor } from "@settersaga/game";

const PLAYER_PORTRAIT_PATHS: Readonly<Record<PlayerColor, string>> = {
  blue: "/game-assets/avatars/blue-cartographer.png",
  green: "/game-assets/avatars/green-botanist.png",
  orange: "/game-assets/avatars/orange-builder.png",
  pink: "/game-assets/avatars/pink-pathfinder.png",
  purple: "/game-assets/avatars/purple-astronomer.png",
  red: "/game-assets/avatars/red-navigator.png",
  teal: "/game-assets/avatars/teal-shipwright.png",
  yellow: "/game-assets/avatars/yellow-merchant.png",
};

export function getPlayerPortraitPath(playerColor: PlayerColor): string {
  return PLAYER_PORTRAIT_PATHS[playerColor];
}
