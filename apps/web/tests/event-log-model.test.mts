import { describe, expect, test } from "bun:test";

import {
  EVENT_LOG_LIMIT,
  eventActionLabel,
  groupRoomEvents,
  type EventLogEntry,
} from "../src/lib/game/event-log-model";
import type { RoomEventView } from "../src/lib/game/types";

let clock = 0;

function event(
  actorPlayerId: string,
  id: string,
  text: string,
  kind: RoomEventView["kind"] = "place_road",
  createdAt = ++clock,
): RoomEventView {
  return {
    actorPlayerId,
    createdAt,
    // Convex document ids are branded strings; any string stands in for one here.
    id: id as RoomEventView["id"],
    kind,
    text,
  };
}

function moves(entry: EventLogEntry | undefined): string[] {
  return entry?.type === "moves" ? entry.events.map((item) => item.text) : [];
}

describe("groupRoomEvents", () => {
  test("keeps consecutive actions from the same player in one entry", () => {
    const entries = groupRoomEvents([
      event("p1", "e1", "Arjun placed a settlement."),
      event("p1", "e2", "Arjun placed a road."),
      event("p2", "e3", "Kara Bot placed a settlement."),
    ]);

    expect(entries.map((entry) => entry.type)).toEqual(["moves", "moves"]);
    expect(moves(entries[0])).toEqual(["Arjun placed a settlement.", "Arjun placed a road."]);
    expect(entries[0]?.key).toBe("e1");
    expect(moves(entries[1])).toEqual(["Kara Bot placed a settlement."]);
  });

  test("starts a new entry when the actor changes and then returns", () => {
    const entries = groupRoomEvents([
      event("p1", "e1", "Arjun rolled 3 + 4 (7)."),
      event("p2", "e2", "Kara Bot discarded 4 resources."),
      event("p1", "e3", "Arjun ended the turn."),
    ]);

    expect(entries.map((entry) => (entry.type === "moves" ? entry.actorPlayerId : ""))).toEqual([
      "p1",
      "p2",
      "p1",
    ]);
  });

  test("orders events by when they happened", () => {
    const entries = groupRoomEvents([
      event("p2", "late", "Kara Bot ended the turn.", "end_turn", 30),
      event("p1", "early", "Arjun rolled 2 + 2 (4).", "roll", 10),
      event("p1", "middle", "Arjun ended the turn.", "end_turn", 20),
    ]);

    expect(entries.map((entry) => entry.key)).toEqual(["early", "late"]);
    expect(moves(entries[0])).toEqual(["Arjun rolled 2 + 2 (4).", "Arjun ended the turn."]);
  });

  test("shows table events as notices that split a player's moves", () => {
    const entries = groupRoomEvents([
      event("p1", "e1", "Arjun placed a road."),
      event("p1", "e2", "Arjun paused the game.", "game_paused"),
      event("p1", "e3", "Arjun resumed the game.", "game_resumed"),
      event("p1", "e4", "Arjun ended the turn.", "end_turn"),
    ]);

    expect(entries.map((entry) => entry.type)).toEqual(["moves", "notice", "notice", "moves"]);
    expect(entries[1]?.type === "notice" && entries[1].event.text).toBe("Arjun paused the game.");
  });

  test("keeps only the newest events", () => {
    const events = Array.from({ length: EVENT_LOG_LIMIT + 5 }, (_, index) =>
      event("p1", `e${index + 1}`, `Arjun action ${index + 1}`),
    );

    const entries = groupRoomEvents(events);

    expect(entries).toHaveLength(1);
    expect(moves(entries[0])).toHaveLength(EVENT_LOG_LIMIT);
    expect(moves(entries[0])[0]).toBe("Arjun action 6");
    expect(moves(entries[0]).at(-1)).toBe(`Arjun action ${EVENT_LOG_LIMIT + 5}`);
  });
});

describe("eventActionLabel", () => {
  test("strips a full display name prefix and starts the sentence", () => {
    expect(eventActionLabel("Arjun Kamboj placed a road.", "Arjun Kamboj")).toBe("Placed a road.");
  });

  test("strips a first-name prefix used in table copy", () => {
    expect(eventActionLabel("Arjun placed a Settlement", "Arjun Kamboj")).toBe(
      "Placed a Settlement",
    );
  });

  test("keeps richer text after the name as it is", () => {
    expect(eventActionLabel("Ana rolled 3 + 5 (8). Ben +2 Wheat, Cy +1 Brick.", "Ana")).toBe(
      "Rolled 3 + 5 (8). Ben +2 Wheat, Cy +1 Brick.",
    );
  });

  test("does not strip a name that only starts another word", () => {
    expect(eventActionLabel("Arjunita placed a road.", "Arjun")).toBe("Arjunita placed a road.");
  });

  test("returns the original text when no name matches", () => {
    expect(eventActionLabel("The robber blocked the ore hill.", "Arjun Kamboj")).toBe(
      "The robber blocked the ore hill.",
    );
  });
});
