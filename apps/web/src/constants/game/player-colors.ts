import type { PlayerColor } from "@settersaga/game";

/**
 * Canonical player palette for canvas and other non-CSS renderers.
 * Player colors for canvas rendering.
 */
export const PLAYER_COLOR_HEX: Readonly<Record<PlayerColor, string>> = {
  blue: "#2f8ee8",
  green: "#2fb86a",
  orange: "#f18c2c",
  pink: "#d74786",
  purple: "#8357d9",
  red: "#f04f49",
  teal: "#0f9696",
  yellow: "#bd8100",
};
