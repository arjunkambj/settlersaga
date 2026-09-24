import { getGameMapDefinition, mapSupportsPlayerCount } from "./maps";
import type { BaseGameSettings } from "./types";

export const GAME_SETTINGS_LIMITS = {
  discardLimit: { max: 20, min: 5 },
  victoryPoints: { max: 13, min: 3 },
} as const;

export const DEFAULT_BASE_GAME_SETTINGS: Readonly<BaseGameSettings> = {
  balancedDice: true,
  discardLimit: 7,
  friendlyRobber: false,
  hideBankCards: false,
  map: "base",
  maxPlayers: 4,
  turnTimerSeconds: 60,
  victoryPoints: 10,
};

function isIntegerWithin(value: number, { max, min }: { max: number; min: number }) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

/** Returns a player-facing reason the settings cannot start a game, or null when they can. */
export function getGameSettingsProblem(settings: BaseGameSettings): string | null {
  const { discardLimit, victoryPoints } = GAME_SETTINGS_LIMITS;

  if (!isIntegerWithin(settings.victoryPoints, victoryPoints)) {
    return `Victory points must be an integer from ${victoryPoints.min} to ${victoryPoints.max}.`;
  }
  if (!isIntegerWithin(settings.discardLimit, discardLimit)) {
    return `Discard limit must be an integer from ${discardLimit.min} to ${discardLimit.max}.`;
  }
  if (!mapSupportsPlayerCount(settings.map, settings.maxPlayers)) {
    const { label } = getGameMapDefinition(settings.map);
    return `The ${label} does not support ${settings.maxPlayers} players.`;
  }
  return null;
}
