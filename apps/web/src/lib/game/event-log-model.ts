import type { RoomEventView } from "@/lib/game/types";

export const EVENT_LOG_LIMIT = 30;

/** Table-wide happenings: shown as a notice across the log, never folded into a player's moves. */
const NOTICE_KINDS: ReadonlySet<RoomEventView["kind"]> = new Set([
  "bot_control_started",
  "game_paused",
  "game_resumed",
  "game_started",
]);

export type EventLogEntry =
  | { actorPlayerId: string; events: RoomEventView[]; key: string; type: "moves" }
  | { event: RoomEventView; key: string; type: "notice" };

/** The newest events, oldest first: a player's back-to-back moves share one entry. */
export function groupRoomEvents(events: readonly RoomEventView[]): EventLogEntry[] {
  const entries: EventLogEntry[] = [];
  const newest = [...events].sort((left, right) => left.createdAt - right.createdAt);

  for (const event of newest.slice(-EVENT_LOG_LIMIT)) {
    if (NOTICE_KINDS.has(event.kind)) {
      entries.push({ event, key: event.id, type: "notice" });
      continue;
    }

    const last = entries.at(-1);
    if (last?.type === "moves" && last.actorPlayerId === event.actorPlayerId) {
      last.events.push(event);
      continue;
    }

    entries.push({
      actorPlayerId: event.actorPlayerId,
      events: [event],
      key: event.id,
      type: "moves",
    });
  }

  return entries;
}

const GAME_STARTED_TEXT = /^game started with (\d+) human players? and (\d+) bots?\.?$/i;

/**
 * A table notice in plain words. The server's "Game started with 3 human players and 1 bot."
 * reads "Game on: 3 people and 1 bot at the table."; every other notice stays as it is.
 */
export function noticeText(text: string): string {
  const trimmed = text.trim();
  const started = GAME_STARTED_TEXT.exec(trimmed);
  if (!started) {
    return trimmed;
  }
  const humans = Number(started[1]);
  const bots = Number(started[2]);
  const people = `${humans} ${humans === 1 ? "person" : "people"}`;
  return bots > 0
    ? `Game on: ${people} and ${bots} ${bots === 1 ? "bot" : "bots"} at the table.`
    : `Game on: ${people} at the table.`;
}

/** A move's text under its player's name: the name prefix goes, the rest reads as a sentence. */
export function eventActionLabel(text: string, displayName?: string): string {
  const trimmed = text.trim();
  if (!displayName) {
    return trimmed;
  }

  const candidates = [displayName, displayName.split(/\s+/)[0] ?? ""].filter(Boolean);
  for (const name of candidates) {
    const afterName = trimmed.slice(name.length);
    if (!trimmed.toLowerCase().startsWith(name.toLowerCase()) || /^[\p{L}\p{N}]/u.test(afterName)) {
      continue;
    }

    const rest = afterName.replace(/^[\s,:\-–—]+/, "");
    return rest ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)}` : trimmed;
  }

  return trimmed;
}
