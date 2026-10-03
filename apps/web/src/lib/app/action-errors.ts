import {
  CHAT_MESSAGE_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
} from "@settersaga/backend/convex/model/constants";
import type { ErrorCode } from "@settersaga/backend/convex/model/errors";
import { ConvexError } from "convex/values";

const GENERIC_ERROR_MESSAGE = "That didn't go through. Check your connection and try again.";

// Codes without an entry are internal failures whose server text is not meant for players.
const MESSAGES_BY_CODE: Partial<Record<string, string>> = {
  ACCOUNT_RESTRICTED: "Finish setting up your account to play.",
  CANNOT_REPLACE_SELF: "You can't hand your own seat to a bot.",
  GAME_ALREADY_FINISHED: "This game is already over.",
  GAME_NOT_FINISHED: "A rematch can start once the game ends.",
  GAME_PAUSED: "The game is paused. It picks up when the host resumes it.",
  INVALID_BOT_COUNT: "There aren't enough open seats for that many bots.",
  INVALID_DISPLAY_NAME: `Names can be 1 to ${DISPLAY_NAME_MAX_LENGTH} characters.`,
  INVALID_MESSAGE: `Messages can be 1 to ${CHAT_MESSAGE_MAX_LENGTH} characters.`,
  INVALID_ROOM_CODE: `Game codes are ${ROOM_CODE_LENGTH} letters or numbers.`,
  INVALID_SETTINGS: "Those settings can't be used. Try different ones.",
  KICKED: "The host removed you from this game.",
  NOT_HOST: "Only the host can do that.",
  NOT_ROOM_MEMBER: "You don't have a seat in this game.",
  RATE_LIMITED: "You're going too fast. Wait a moment and try again.",
  ROOM_CLOSED: "That game has closed.",
  ROOM_CODE_EXHAUSTED: "Every game code is taken right now. Try again in a moment.",
  ROOM_FULL: "That game is full.",
  ROOM_HAS_PLAYERS: "Other players are still in this game, so it can't be removed.",
  ROOM_NOT_FOUND: "No game has that code. Check it and try again.",
  ROOM_NOT_READY: "Fill every seat before starting.",
  ROOM_STARTED: "That game has already started.",
  TARGET_NOT_HUMAN: "A bot already plays that seat.",
  TARGET_SEAT_NOT_FOUND: "That player has already left.",
  TOO_MANY_PLAYERS: "There are more players here than seats. Remove a player first.",
  UNAUTHENTICATED: "Sign in again to keep playing.",
} satisfies Partial<Record<ErrorCode, string>>;

/** The code the backend attached to a rejected Convex call, if any. */
export function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ConvexError)) return undefined;
  const data: unknown = error.data;
  return typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof data.code === "string"
    ? data.code
    : undefined;
}

export function toActionableError(error: unknown): string {
  const code = getErrorCode(error);
  return (code && MESSAGES_BY_CODE[code]) || GENERIC_ERROR_MESSAGE;
}
