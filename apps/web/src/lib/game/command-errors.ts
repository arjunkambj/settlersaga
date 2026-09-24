import type { ErrorCode } from "@settersaga/backend/convex/model/errors";
import type { GameCommand } from "@settersaga/game";

import { getErrorCode, toActionableError } from "@/lib/app/action-errors";

/** A command the game did not apply: the server's error code, if any, and what to tell the player. */
export interface CommandRejection {
  code: string | undefined;
  message: string;
}

/** Sends a command. Resolves to null once the game applied it, or to why it did not. */
export type SendCommand = (
  command: GameCommand,
  successMessage: string,
) => Promise<CommandRejection | null>;

const GAME_PAUSED_MESSAGE = "The game is paused. It picks up when the host resumes it.";

// Codes without an entry fall back to the app-wide copy (connection, sign-in, rate limit…).
const MESSAGES_BY_CODE: Partial<Record<string, string>> = {
  BANK_OUT_OF_RESOURCE: "The bank is out of that resource. Pick a different one.",
  DEVELOPMENT_CARD_NOT_PLAYABLE: "That card can't be played yet. Try again on your next turn.",
  DISTANCE_RULE: "That spot is too close to another settlement.",
  GAME_ALREADY_FINISHED: "This game is already over.",
  GAME_FINISHED: "This game is already over.",
  GAME_PAUSED: GAME_PAUSED_MESSAGE,
  INSUFFICIENT_RESOURCES: "You're short on cards for that. Check your hand and try again.",
  INVALID_DISCARD: "That's not the right number of cards. Check your pick and try again.",
  INVALID_LOCATION: "You can't build there. Pick a glowing spot.",
  INVALID_PHASE: "That move isn't open right now. Check what the turn needs next.",
  INVALID_ROBBER_TILE: "The robber can't go there. Pick a glowing tile.",
  INVALID_TRADE: "That trade offer is no longer open.",
  INVALID_VICTIM: "You can't steal from that player. Pick another one.",
  LOCATION_OCCUPIED: "Someone already built there. Pick another spot.",
  NO_DEVELOPMENT_CARD_AVAILABLE: "The development deck is empty.",
  NO_PIECE_AVAILABLE: "You have no pieces of that kind left.",
  NOT_REQUIRED_ACTOR: "That move isn't open right now. Check what the turn needs next.",
  ROAD_NOT_CONNECTED: "Roads have to connect to your roads or buildings.",
  ROBBER_TILE_UNCHANGED: "The robber has to move to a new tile.",
  STALE_ACTION_NUMBER: "The game moved on before that landed. Check the board and try again.",
} satisfies Partial<Record<ErrorCode, string>>;

/** What sending a command resolves to while the game is paused (it is never sent). */
export const GAME_PAUSED_REJECTION: CommandRejection = {
  code: "GAME_PAUSED",
  message: GAME_PAUSED_MESSAGE,
};

export function getCommandErrorMessage(cause: unknown): string {
  return toCommandRejection(cause).message;
}

export function toCommandRejection(cause: unknown): CommandRejection {
  const code = getErrorCode(cause);
  return { code, message: (code && MESSAGES_BY_CODE[code]) || toActionableError(cause) };
}

/**
 * Rejections the control that sent the command shows beside itself (bank trades and Year of
 * Plenty with a hidden bank), so the table toast leaves them out.
 */
export function isShownBesideControl(rejection: CommandRejection): boolean {
  return rejection.code === "BANK_OUT_OF_RESOURCE";
}
