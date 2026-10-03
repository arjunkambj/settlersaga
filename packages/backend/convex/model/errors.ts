import type { GameRuleErrorCode } from "@settersaga/game";
import { ConvexError } from "convex/values";

export type ServerErrorCode =
  | "ACCOUNT_RESTRICTED"
  | "CANNOT_REPLACE_SELF"
  | "CLIENT_ACTION_CONFLICT"
  | "CORRUPT_GAME_STATE"
  | "GAME_ALREADY_FINISHED"
  | "GAME_NOT_FINISHED"
  | "GAME_NOT_STARTED"
  | "GAME_PAUSED"
  | "INVALID_BOT_COUNT"
  | "INVALID_CLIENT_ACTION_ID"
  | "INVALID_DISPLAY_NAME"
  | "INVALID_MESSAGE"
  | "INVALID_ROOM_CODE"
  | "INVALID_SETTINGS"
  | "KICKED"
  | "NOT_HOST"
  | "NOT_ROOM_MEMBER"
  | "RATE_LIMITED"
  | "ROOM_CLOSED"
  | "ROOM_CODE_EXHAUSTED"
  | "ROOM_FULL"
  | "ROOM_HAS_PLAYERS"
  | "ROOM_NOT_FOUND"
  | "ROOM_NOT_READY"
  | "ROOM_STARTED"
  | "STALE_ACTION_NUMBER"
  | "TARGET_NOT_HUMAN"
  | "TARGET_SEAT_NOT_FOUND"
  | "TOO_MANY_PLAYERS"
  | "UNAUTHENTICATED";

/** Every code a Convex function rejects with. Rejected game commands reuse the engine's codes. */
export type ErrorCode = GameRuleErrorCode | ServerErrorCode;

export type ErrorData = { code: ErrorCode; message: string };

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError<ErrorData>({ code, message });
}
