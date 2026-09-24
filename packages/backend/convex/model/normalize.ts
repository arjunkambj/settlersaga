import { getGameSettingsProblem, type BaseGameSettings } from "@settersaga/game";

import { CHAT_MESSAGE_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from "./constants";
import { fail } from "./errors";

const CLIENT_ACTION_ID_MAX_LENGTH = 128;

export function normalizeDisplayName(value: string): string {
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 1 || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    fail(
      "INVALID_DISPLAY_NAME",
      `Display name must contain 1 to ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    );
  }
  return displayName;
}

/** Appends " 2", " 3", … until the name differs from every other name at the table. */
export function uniqueDisplayName(
  displayName: string,
  otherSeats: readonly { displayName: string }[],
): string {
  const taken = new Set(otherSeats.map((seat) => seat.displayName.toLocaleLowerCase()));
  let candidate = displayName;
  for (let suffix = 2; taken.has(candidate.toLocaleLowerCase()); suffix += 1) {
    const tail = ` ${suffix}`;
    candidate = `${displayName.slice(0, DISPLAY_NAME_MAX_LENGTH - tail.length).trimEnd()}${tail}`;
  }
  return candidate;
}

export function normalizeRoomCode(value: string): string {
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) {
    fail("INVALID_ROOM_CODE", `Room code must contain ${ROOM_CODE_LENGTH} characters.`);
  }
  return code;
}

export function validateClientActionId(clientActionId: string): void {
  if (clientActionId.length < 1 || clientActionId.length > CLIENT_ACTION_ID_MAX_LENGTH) {
    fail(
      "INVALID_CLIENT_ACTION_ID",
      `Client action ID must contain 1 to ${CLIENT_ACTION_ID_MAX_LENGTH} characters.`,
    );
  }
}

export function normalizeChatMessage(value: string): string {
  const body = value.trim();
  if (body.length < 1 || body.length > CHAT_MESSAGE_MAX_LENGTH) {
    fail("INVALID_MESSAGE", `Messages must contain 1 to ${CHAT_MESSAGE_MAX_LENGTH} characters.`);
  }
  return body;
}

/** Checks the settings the Convex validators cannot express: number ranges and map size. */
export function validateGameSettings(settings: BaseGameSettings): void {
  const problem = getGameSettingsProblem(settings);
  if (problem) fail("INVALID_SETTINGS", problem);
}
