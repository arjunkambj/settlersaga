import { PRESENCE_AWAY_AFTER_MS } from "./constants";
import { fail } from "./errors";
import type { ReadCtx, RoomDoc, RoomId, SeatDoc, WriteCtx } from "./types";

/** Heartbeats closer together than this are dropped, capping presence at one write per interval. */
const PRESENCE_WRITE_INTERVAL_MS = 10_000;

export async function findPresence(ctx: ReadCtx, roomId: RoomId, authUserId: string) {
  return await ctx.db
    .query("presence")
    .withIndex("by_room_and_auth_user_id", (index) =>
      index.eq("roomId", roomId).eq("authUserId", authUserId),
    )
    .unique();
}

export async function recordHeartbeat(
  ctx: WriteCtx,
  roomId: RoomId,
  authUserId: string,
  now: number,
): Promise<void> {
  const presence = await findPresence(ctx, roomId, authUserId);
  if (!presence) {
    await ctx.db.insert("presence", { authUserId, lastSeenAt: now, roomId });
    return;
  }
  if (now - presence.lastSeenAt >= PRESENCE_WRITE_INTERVAL_MS) {
    await ctx.db.patch("presence", presence._id, { lastSeenAt: now });
  }
}

export async function clearPresence(
  ctx: WriteCtx,
  roomId: RoomId,
  authUserId: string | undefined,
): Promise<void> {
  const presence = authUserId === undefined ? null : await findPresence(ctx, roomId, authUserId);
  if (presence) await ctx.db.delete("presence", presence._id);
}

/**
 * Lets the host act, or hands the host role to `seat` once the host has stopped sending
 * heartbeats, so a table whose host disconnected can still pause, resume, and rematch.
 */
export async function requireActingHost(
  ctx: WriteCtx,
  room: RoomDoc,
  seats: readonly SeatDoc[],
  seat: SeatDoc,
  message: string,
): Promise<void> {
  if (seat._id === room.hostSeatId) return;
  const host = seats.find((candidate) => candidate._id === room.hostSeatId);
  if (host?.authUserId === undefined) fail("NOT_HOST", message);
  const hostPresence = await findPresence(ctx, room._id, host.authUserId);
  // A host who never sent a heartbeat, e.g. one whose tab closed first, has been silent since the
  // room opened.
  const hostLastSeenAt = hostPresence?.lastSeenAt ?? room._creationTime;
  if (Date.now() - hostLastSeenAt < PRESENCE_AWAY_AFTER_MS) fail("NOT_HOST", message);
  await ctx.db.patch("rooms", room._id, { hostSeatId: seat._id });
}
