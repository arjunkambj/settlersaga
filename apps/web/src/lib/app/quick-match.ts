import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";

/** A quick match is a default Island where bots fill every seat but the player's. */
export const QUICK_MATCH_SETTINGS = DEFAULT_BASE_GAME_SETTINGS;

export const QUICK_MATCH_BOT_COUNT = QUICK_MATCH_SETTINGS.maxPlayers - 1;
