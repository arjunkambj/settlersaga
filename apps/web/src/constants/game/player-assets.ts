import { PLAYER_COLORS, type PlayerColor } from "@settersaga/game";

export const PLAYER_PORTRAIT_PATHS: Readonly<Record<PlayerColor, string>> = {
  blue: "/game-assets/players/blue-cartographer.png",
  green: "/game-assets/players/green-botanist.png",
  orange: "/game-assets/players/orange-builder.png",
  pink: "/game-assets/players/pink-pathfinder.png",
  purple: "/game-assets/players/purple-astronomer.png",
  red: "/game-assets/players/red-navigator.png",
  teal: "/game-assets/players/teal-shipwright.png",
  yellow: "/game-assets/players/yellow-merchant.png",
};

export function getPlayerPortraitPath(playerColor: PlayerColor): string {
  return PLAYER_PORTRAIT_PATHS[playerColor];
}

export function getPlayerPortraitPathForSeat(seatIndex: number): string {
  return getPlayerPortraitPath(PLAYER_COLORS[seatIndex % PLAYER_COLORS.length] ?? "red");
}
