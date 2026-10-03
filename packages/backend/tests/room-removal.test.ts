import { describe, expect, test } from "bun:test";

import { canHostRemoveRoom } from "../convex/model/roomQueries";
import type { SeatRecord } from "../convex/model/types";

function seat(id: string, seatIndex: number, kind: SeatRecord["kind"]): SeatRecord {
  return {
    _id: id as never,
    authUserId: kind === "human" ? id : undefined,
    displayName: id,
    kind,
    roomId: "room" as never,
    seatIndex,
  };
}

const HOST = seat("host", 0, "human");
const GUEST = seat("guest", 1, "human");
const BOT = seat("bot", 2, "bot");

describe("canHostRemoveRoom", () => {
  test("a lobby can always be removed, even with other players waiting", () => {
    expect(canHostRemoveRoom({ status: "waiting" }, [HOST, GUEST, BOT], HOST)).toBe(true);
  });

  test("a running game with only bots left can be removed", () => {
    expect(canHostRemoveRoom({ status: "active" }, [HOST, BOT], HOST)).toBe(true);
  });

  test("a running game another player is in can't be removed", () => {
    expect(canHostRemoveRoom({ status: "active" }, [HOST, GUEST, BOT], HOST)).toBe(false);
  });
});
