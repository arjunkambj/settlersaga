import { describe, expect, test } from "bun:test";

import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";

import { reconcileWaitingSeats } from "../convex/model/lobby";
import { uniqueDisplayName } from "../convex/model/normalize";
import type { RoomRecord, SeatRecord } from "../convex/model/types";

const ROOM: RoomRecord = {
  _id: "room" as never,
  botDifficulty: "medium",
  code: "ABC234",
  hostSeatId: "host" as never,
  kickedAuthUserIds: [],
  settings: DEFAULT_BASE_GAME_SETTINGS,
  status: "waiting",
  updatedAt: 1,
};

function seat(
  id: string,
  seatIndex: number,
  kind: SeatRecord["kind"],
  authUserId?: string,
): SeatRecord {
  return { _id: id as never, authUserId, displayName: id, kind, roomId: ROOM._id, seatIndex };
}

function createSeatWrites() {
  const writes = {
    deleted: [] as string[],
    inserted: [] as Record<string, unknown>[],
    moved: [] as { id: string; seatIndex: number }[],
  };
  const ctx = {
    db: {
      delete: async (_table: string, id: string) => {
        writes.deleted.push(id);
      },
      insert: async (_table: string, value: Record<string, unknown>) => {
        writes.inserted.push(value);
        return `bot-${writes.inserted.length}`;
      },
      patch: async (_table: string, id: string, value: { seatIndex: number }) => {
        writes.moved.push({ id, seatIndex: value.seatIndex });
      },
    },
  };
  return { ctx: ctx as never, writes };
}

describe("waiting-seat reconciliation", () => {
  test("fills bots into the seats after the humans", async () => {
    const { ctx, writes } = createSeatWrites();

    const seats = await reconcileWaitingSeats(ctx, ROOM, ROOM.settings, 3, [
      seat("host", 0, "human", "user"),
    ]);

    expect(writes.inserted).toHaveLength(3);
    expect(seats.map((candidate) => candidate.seatIndex)).toEqual([0, 1, 2, 3]);
    expect(seats.map((candidate) => candidate.kind)).toEqual(["human", "bot", "bot", "bot"]);
    expect(new Set(seats.map((candidate) => candidate.displayName)).size).toBe(4);
  });

  test("seats the host first, then humans, then bots, and only moves seats that change", async () => {
    const { ctx, writes } = createSeatWrites();
    const settings = { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 3 as const };

    const seats = await reconcileWaitingSeats(ctx, ROOM, settings, 1, [
      seat("bot", 0, "bot"),
      seat("guest", 1, "human", "guest-user"),
      seat("host", 2, "human", "host-user"),
    ]);

    expect(seats.map(({ displayName, seatIndex }) => ({ displayName, seatIndex }))).toEqual([
      { displayName: "host", seatIndex: 0 },
      { displayName: "guest", seatIndex: 1 },
      { displayName: "bot", seatIndex: 2 },
    ]);
    expect(writes.moved).toEqual([
      { id: "host", seatIndex: 0 },
      { id: "bot", seatIndex: 2 },
    ]);
  });

  test("removes the highest bots when fewer are requested", async () => {
    const { ctx, writes } = createSeatWrites();

    const seats = await reconcileWaitingSeats(ctx, ROOM, ROOM.settings, 1, [
      seat("host", 0, "human", "user"),
      seat("bot-a", 1, "bot"),
      seat("bot-b", 2, "bot"),
      seat("bot-c", 3, "bot"),
    ]);

    expect(writes.deleted).toEqual(["bot-b", "bot-c"]);
    expect(seats.map((candidate) => candidate.displayName)).toEqual(["host", "bot-a"]);
  });

  test("rejects more bots than the open seats can hold", async () => {
    const { ctx } = createSeatWrites();

    await expect(
      reconcileWaitingSeats(ctx, ROOM, ROOM.settings, 3, [
        seat("host", 0, "human", "user"),
        seat("guest", 1, "human", "guest-user"),
      ]),
    ).rejects.toThrow();
  });
});

describe("display names", () => {
  test("numbers a name that is already taken at the table", () => {
    expect(uniqueDisplayName("Explorer", [{ displayName: "Storm Bot" }])).toBe("Explorer");
    expect(uniqueDisplayName("Explorer", [{ displayName: "explorer" }])).toBe("Explorer 2");
    expect(
      uniqueDisplayName("Explorer", [{ displayName: "Explorer" }, { displayName: "Explorer 2" }]),
    ).toBe("Explorer 3");
  });

  test("keeps a numbered name within the display-name limit", () => {
    const longName = "Captain Explorer Of Isles";
    const numbered = uniqueDisplayName(longName.slice(0, 24), [
      { displayName: longName.slice(0, 24) },
    ]);

    expect(numbered).toBe("Captain Explorer Of Is 2");
    expect(numbered.length).toBeLessThanOrEqual(24);
  });
});
