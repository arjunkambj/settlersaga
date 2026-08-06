export const SESSION_STORAGE_KEY = "settersaga.session.v2";
export const SESSION_VERSION = 2;

export interface PlayerSession {
  activeCode?: string;
  displayName: string;
  userId: string;
  version: typeof SESSION_VERSION;
}

interface StorageReader {
  getItem(key: string): string | null;
}

interface StorageWriter extends StorageReader {
  setItem(key: string, value: string): void;
}

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizeRoomCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function isRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value);
}

export function createPlayerSession(userId: string, displayName: string): PlayerSession {
  return {
    displayName,
    userId,
    version: SESSION_VERSION,
  };
}

export function readPlayerSession(
  storage: StorageReader,
  userId: string,
  displayName: string,
): PlayerSession {
  const stored = storage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return createPlayerSession(userId, displayName);
  }

  try {
    const value: unknown = JSON.parse(stored);
    if (!isPlayerSession(value) || value.userId !== userId) {
      return createPlayerSession(userId, displayName);
    }
    return value;
  } catch {
    return createPlayerSession(userId, displayName);
  }
}

export function writePlayerSession(storage: StorageWriter, session: PlayerSession): void {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function isPlayerSession(value: unknown): value is PlayerSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<PlayerSession>;
  const hasValidCode = session.activeCode === undefined || isRoomCode(session.activeCode);

  return (
    session.version === SESSION_VERSION &&
    typeof session.userId === "string" &&
    session.userId.length > 0 &&
    typeof session.displayName === "string" &&
    session.displayName.length > 0 &&
    hasValidCode
  );
}
