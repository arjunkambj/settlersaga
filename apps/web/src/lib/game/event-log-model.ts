import type { RoomEventView } from "@/lib/game/types";

export const EVENT_LOG_LIMIT = 30;

export type EventLogTone = "build" | "card" | "combat" | "move" | "roll" | "system" | "trade";

export interface EventLogGroup<TEvent extends RoomEventView = RoomEventView> {
  actorPlayerId: string;
  events: TEvent[];
  key: string;
}

export function groupRoomEvents<TEvent extends RoomEventView>(
  events: readonly TEvent[],
): EventLogGroup<TEvent>[] {
  const groups: EventLogGroup<TEvent>[] = [];

  for (const event of events.slice(-EVENT_LOG_LIMIT)) {
    const last = groups.at(-1);
    if (last && last.actorPlayerId === event.actorPlayerId) {
      last.events.push(event);
      continue;
    }

    groups.push({
      actorPlayerId: event.actorPlayerId,
      events: [event],
      key: String(event.sequence),
    });
  }

  return groups;
}

export function eventActionLabel(text: string, displayName?: string): string {
  const trimmed = text.trim();
  if (!displayName) {
    return trimmed;
  }

  const candidates = [displayName, displayName.split(/\s+/)[0] ?? ""].filter(Boolean);
  for (const name of candidates) {
    if (!trimmed.toLowerCase().startsWith(name.toLowerCase())) {
      continue;
    }

    const rest = trimmed.slice(name.length).replace(/^[\s,:\-–—]+/, "");
    return rest || trimmed;
  }

  return trimmed;
}

export function getEventTone(kind: string): EventLogTone {
  switch (kind) {
    case "place_settlement":
    case "place_road":
    case "build_city":
      return "build";
    case "roll":
      return "roll";
    case "move_robber":
    case "move_robber_and_steal":
    case "steal":
    case "play_knight":
      return "combat";
    case "trade_bank":
    case "propose_trade":
    case "respond_trade":
    case "cancel_trade":
      return "trade";
    case "buy_development_card":
    case "play_monopoly":
    case "play_road_building":
    case "play_year_of_plenty":
      return "card";
    case "game_paused":
    case "game_resumed":
    case "end_turn":
      return "system";
    default:
      return "move";
  }
}
