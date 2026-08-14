import { describe, expect, test } from "bun:test";

import {
  EVENT_LOG_LIMIT,
  eventActionLabel,
  getEventTone,
  groupRoomEvents,
} from "../src/lib/game/event-log-model";
import type { RoomEventView } from "../src/lib/game/types";

function event(
  overrides: Partial<RoomEventView> & Pick<RoomEventView, "actorPlayerId" | "sequence" | "text">,
): RoomEventView {
  return {
    createdAt: 1,
    kind: "place_road",
    ...overrides,
  };
}

describe("groupRoomEvents", () => {
  test("keeps consecutive actions from the same player in one group", () => {
    const groups = groupRoomEvents([
      event({ actorPlayerId: "p1", sequence: 1, text: "Arjun placed a settlement." }),
      event({ actorPlayerId: "p1", sequence: 2, text: "Arjun placed a road." }),
      event({ actorPlayerId: "p2", sequence: 3, text: "Kara Bot placed a settlement." }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.actorPlayerId).toBe("p1");
    expect(groups[0]?.events.map((item) => item.sequence)).toEqual([1, 2]);
    expect(groups[1]?.actorPlayerId).toBe("p2");
  });

  test("starts a new group when the actor changes and then returns", () => {
    const groups = groupRoomEvents([
      event({ actorPlayerId: "p1", sequence: 1, text: "Arjun rolled 3 + 4 (7)." }),
      event({ actorPlayerId: "p2", sequence: 2, text: "Kara Bot discarded resources." }),
      event({ actorPlayerId: "p1", sequence: 3, text: "Arjun ended the turn." }),
    ]);

    expect(groups.map((group) => group.actorPlayerId)).toEqual(["p1", "p2", "p1"]);
  });

  test("keeps only the newest events", () => {
    const events = Array.from({ length: EVENT_LOG_LIMIT + 5 }, (_, index) =>
      event({
        actorPlayerId: "p1",
        sequence: index + 1,
        text: `Arjun action ${index + 1}`,
      }),
    );

    const groups = groupRoomEvents(events);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.events).toHaveLength(EVENT_LOG_LIMIT);
    expect(groups[0]?.events[0]?.sequence).toBe(6);
    expect(groups[0]?.events.at(-1)?.sequence).toBe(EVENT_LOG_LIMIT + 5);
  });
});

describe("eventActionLabel", () => {
  test("strips a full display name prefix", () => {
    expect(eventActionLabel("Arjun Kamboj placed a road.", "Arjun Kamboj")).toBe("placed a road.");
  });

  test("strips a first-name prefix used in table copy", () => {
    expect(eventActionLabel("Arjun placed a Settlement", "Arjun Kamboj")).toBe(
      "placed a Settlement",
    );
  });

  test("returns the original text when no name matches", () => {
    expect(eventActionLabel("The robber blocked the ore hill.", "Arjun Kamboj")).toBe(
      "The robber blocked the ore hill.",
    );
  });
});

describe("getEventTone", () => {
  test.each([
    ["place_settlement", "build"],
    ["roll", "roll"],
    ["play_knight", "combat"],
    ["propose_trade", "trade"],
    ["buy_development_card", "card"],
    ["game_paused", "system"],
    ["unknown", "move"],
  ] as const)("maps %s to %s", (kind, tone) => {
    expect(getEventTone(kind)).toBe(tone);
  });
});
