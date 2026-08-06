import type { api } from "@settersaga/backend/convex/_generated/api";
import { assertPlayerGameView, type PlayerGameView } from "@settersaga/game";
import type { FunctionReturnType } from "convex/server";

export type RoomView = NonNullable<FunctionReturnType<typeof api.rooms.getRoom>>;
export type RoomEventView = RoomView["events"][number];

export function parsePlayerView(serializedGame: string | undefined): PlayerGameView | null {
  if (!serializedGame) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(serializedGame);
    assertPlayerGameView(value);
    return value;
  } catch {
    return null;
  }
}
