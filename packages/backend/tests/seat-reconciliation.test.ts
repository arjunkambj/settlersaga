import { describe, expect, test } from "bun:test";

import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";

import { fitWaitingSeatsToSettings, setWaitingBotCount } from "../convex/model/gameState";
import type { RoomRecord, SeatRecord } from "../convex/model/types";

const ROOM: RoomRecord = {
  _id: "room" as never,
  botDifficulty: "medium",
  code: "ABC234",
  createdAt: 1,
  hostSeatId: "host" as never,
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
  return {
    _id: id as never,
    authUserId,
    displayName: id,
    joinedAt: 1,
    kind,
    roomId: ROOM._id,
    seatIndex,
  };
}

describe("waiting-seat reconciliation", () => {
  test("creates bots from supplied seats without rereading the room seats", async () => {
    const inserted: Record<string, unknown>[] = [];
    const ctx = {
      db: {
        delete: async () => {},
        insert: async (_table: string, value: Record<string, unknown>) => {
          inserted.push(value);
          return `bot-${inserted.length}`;
        },
        query: () => {
          throw new Error("unexpected seat query");
        },
      },
    };

    const seats = await setWaitingBotCount(ctx as never, ROOM, 3, [
      seat("host", 0, "human", "user"),
    ]);

    expect(inserted).toHaveLength(3);
    expect(seats.map((candidate) => candidate.seatIndex)).toEqual([0, 1, 2, 3]);
    expect(seats.map((candidate) => candidate.kind)).toEqual(["human", "bot", "bot", "bot"]);
  });

  test("reindexes supplied seats without issuing a seat query", async () => {
    const patches: { id: string; seatIndex: number }[] = [];
    const ctx = {
      db: {
        delete: async () => {},
        patch: async (_table: string, id: string, value: { seatIndex: number }) => {
          patches.push({ id, seatIndex: value.seatIndex });
        },
        query: () => {
          throw new Error("unexpected seat query");
        },
      },
    };
    const settings = { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 3 as const };

    const seats = await fitWaitingSeatsToSettings(ctx as never, ROOM, settings, [
      seat("bot", 0, "bot"),
      seat("guest", 1, "human", "guest-user"),
      seat("host", 2, "human", "host-user"),
    ]);

    expect(seats.map(({ displayName, seatIndex }) => ({ displayName, seatIndex }))).toEqual([
      { displayName: "host", seatIndex: 0 },
      { displayName: "guest", seatIndex: 1 },
      { displayName: "bot", seatIndex: 2 },
    ]);
    expect(patches).toEqual([
      { id: "host", seatIndex: 0 },
      { id: "bot", seatIndex: 2 },
    ]);
  });
});
