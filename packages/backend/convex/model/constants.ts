import { PLAYER_COLORS, type BotDifficulty } from "@settersaga/game";

export const MAX_SEATS = PLAYER_COLORS.length;
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = "medium";
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DISPLAY_NAME_MAX_LENGTH = 24;
export const CHAT_MESSAGE_MAX_LENGTH = 300;
/** A player silent this long is away, and an away host can be replaced by any other human. */
export const PRESENCE_AWAY_AFTER_MS = 60_000;
