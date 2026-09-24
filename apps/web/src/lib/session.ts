import { ROOM_CODE_LENGTH } from "@settersaga/backend/convex/model/constants";

import { cleanDisplayName } from "@/lib/app/display-name";

const SESSION_STORAGE_KEY = "settersaga:session";
const ROOM_CODE_PATTERN = new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`);

export interface PlayerSession {
  activeCode?: string;
  displayName: string;
  userId: string;
}

export function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value);
}

export function readPlayerSession(
  storage: Pick<Storage, "getItem">,
  userId: string,
  displayName: string,
): PlayerSession {
  const stored = parseStoredSession(storage.getItem(SESSION_STORAGE_KEY));
  if (!stored || stored.userId !== userId) {
    return { displayName, userId };
  }
  return { ...stored, displayName: cleanDisplayName(stored.displayName) };
}

export function writePlayerSession(
  storage: Pick<Storage, "setItem">,
  session: PlayerSession,
): void {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function parseStoredSession(stored: string | null): PlayerSession | null {
  if (!stored) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return null;
  }

  if (
    typeof value !== "object" ||
    value === null ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !("displayName" in value) ||
    typeof value.displayName !== "string"
  ) {
    return null;
  }

  const session: PlayerSession = { displayName: value.displayName, userId: value.userId };
  if (
    "activeCode" in value &&
    typeof value.activeCode === "string" &&
    isRoomCode(value.activeCode)
  ) {
    session.activeCode = value.activeCode;
  }
  return session;
}
