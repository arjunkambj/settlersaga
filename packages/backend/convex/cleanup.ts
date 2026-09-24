import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { MAX_SEATS } from "./model/constants";
import type { GameId, ReadCtx, RoomDoc, WriteCtx } from "./model/types";

const HOUR_MS = 60 * 60 * 1_000;
const WAITING_ROOM_IDLE_MS = 24 * HOUR_MS;
const PLAYED_ROOM_IDLE_MS = 7 * 24 * HOUR_MS;
/** Documents deleted per run, far below Convex's per-mutation write limit. */
const PURGE_BATCH_SIZE = 500;
const ROOM_SCAN_LIMIT = 100;

/** Deletes up to `budget` of a game's documents, the game last, and returns the unused budget. */
async function purgeGameDocuments(ctx: WriteCtx, gameId: GameId, budget: number): Promise<number> {
  const actions = await ctx.db
    .query("gameActions")
    .withIndex("by_game_and_after_revision", (index) => index.eq("gameId", gameId))
    .take(budget);
  await Promise.all(actions.map((action) => ctx.db.delete("gameActions", action._id)));
  const remaining = budget - actions.length;
  if (remaining === 0) return 0;
  await ctx.db.delete("games", gameId);
  return remaining - 1;
}

/** Deletes up to `budget` of a room's documents, the room last, and returns the unused budget. */
async function purgeRoomDocuments(ctx: WriteCtx, room: RoomDoc, budget: number): Promise<number> {
  let remaining = budget;
  const games = await ctx.db
    .query("games")
    .withIndex("by_room_id", (index) => index.eq("roomId", room._id))
    .take(remaining);
  for (const game of games) {
    remaining = await purgeGameDocuments(ctx, game._id, remaining);
    if (remaining === 0) return 0;
  }

  const messages = await ctx.db
    .query("roomMessages")
    .withIndex("by_room_id", (index) => index.eq("roomId", room._id))
    .take(remaining);
  await Promise.all(messages.map((message) => ctx.db.delete("roomMessages", message._id)));
  remaining -= messages.length;
  if (remaining === 0) return 0;

  const [presence, seats] = await Promise.all([
    ctx.db
      .query("presence")
      .withIndex("by_room_and_auth_user_id", (index) => index.eq("roomId", room._id))
      .take(MAX_SEATS),
    ctx.db
      .query("seats")
      .withIndex("by_room_and_seat_index", (index) => index.eq("roomId", room._id))
      .take(MAX_SEATS),
  ]);
  await Promise.all([
    ...presence.map((row) => ctx.db.delete("presence", row._id)),
    ...seats.map((seat) => ctx.db.delete("seats", seat._id)),
    ctx.db.delete("rooms", room._id),
  ]);
  return Math.max(0, remaining - presence.length - seats.length - 1);
}

/** The latest sign of life: lobby changes, members' heartbeats, or moves in the running game. */
async function lastActivityAt(ctx: ReadCtx, room: RoomDoc): Promise<number> {
  const { gameId } = room;
  if (room.status === "waiting") {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_room_and_auth_user_id", (index) => index.eq("roomId", room._id))
      .take(MAX_SEATS);
    return Math.max(room.updatedAt, ...presence.map((row) => row.lastSeenAt));
  }
  if (room.status === "active" && gameId) {
    const latestEvent = await ctx.db
      .query("gameActions")
      .withIndex("by_game_and_after_revision", (index) => index.eq("gameId", gameId))
      .order("desc")
      .first();
    return Math.max(room.updatedAt, latestEvent?._creationTime ?? 0);
  }
  return room.updatedAt;
}

export const purgeStaleRooms = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const staleCutoffs = [
      ["closed", now],
      ["waiting", now - WAITING_ROOM_IDLE_MS],
      ["finished", now - PLAYED_ROOM_IDLE_MS],
      ["active", now - PLAYED_ROOM_IDLE_MS],
    ] as const;
    let budget = PURGE_BATCH_SIZE;
    for (const [status, cutoff] of staleCutoffs) {
      const rooms = await ctx.db
        .query("rooms")
        .withIndex("by_status_and_updated_at", (index) =>
          index.eq("status", status).lte("updatedAt", cutoff),
        )
        .take(ROOM_SCAN_LIMIT);
      for (const room of rooms) {
        const activeAt = await lastActivityAt(ctx, room);
        if (activeAt > cutoff) {
          // Moves the room out of the stale range so later scans skip it.
          await ctx.db.patch("rooms", room._id, { updatedAt: activeAt });
          continue;
        }
        budget = await purgeRoomDocuments(ctx, room, budget);
        if (budget === 0) break;
      }
      if (budget === 0 || rooms.length === ROOM_SCAN_LIMIT) {
        await ctx.scheduler.runAfter(0, internal.cleanup.purgeStaleRooms, {});
        return null;
      }
    }
    return null;
  },
});

/** Deletes a game replaced by a rematch, rescheduling itself until its history is gone. */
export const purgeGame = internalMutation({
  args: {
    gameId: v.id("games"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get("games", args.gameId))) return null;
    if ((await purgeGameDocuments(ctx, args.gameId, PURGE_BATCH_SIZE)) === 0) {
      await ctx.scheduler.runAfter(0, internal.cleanup.purgeGame, args);
    }
    return null;
  },
});
