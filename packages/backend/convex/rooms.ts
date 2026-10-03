import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireCurrentHexclaveUser } from "./hexclave/auth";
import { fail } from "./model/errors";
import { closeRoom, createRoomRecord, reconcileWaitingSeats, startRoomGame } from "./model/lobby";
import {
  normalizeChatMessage,
  normalizeDisplayName,
  uniqueDisplayName,
  validateGameSettings,
} from "./model/normalize";
import { clearPresence, findPresence, recordHeartbeat, requireActingHost } from "./model/presence";
import {
  canHostRemoveRoom,
  findHumanMembership,
  listSeats,
  nextOpenSeatIndex,
  otherHumans,
  requireHost,
  requireHumanSeat,
  requireHumanSeatFromList,
  requireRoom,
  requireWaitingHost,
} from "./model/roomQueries";
import { convertGameSeatToBot, releaseSeatToBot } from "./model/takeover";
import {
  baseGameSettingsValidator,
  botDifficultyValidator,
  chatMessageViewValidator,
  presenceViewValidator,
  roomViewValidator,
} from "./model/validators";
import { seatColor, toRoomView } from "./model/views";

const CHAT_HISTORY_LIMIT = 100;
const CHAT_COOLDOWN_MS = 700;
/** Bounds how many lobbies a rename touches; the newest seats come first. */
const RENAMED_SEAT_LIMIT = 50;

export const createRoom = mutation({
  args: {
    displayName: v.string(),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const { code } = await createRoomRecord(ctx, user.id, args.displayName);
    return { code };
  },
});

export const updateLobbyConfiguration = mutation({
  args: {
    botCount: v.number(),
    botDifficulty: botDifficultyValidator,
    code: v.string(),
    settings: baseGameSettingsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const { room, seats } = await requireWaitingHost(
      ctx,
      args.code,
      user.id,
      "Only the room host can change lobby settings.",
    );
    validateGameSettings(args.settings);
    await Promise.all([
      reconcileWaitingSeats(ctx, room, args.settings, args.botCount, seats),
      ctx.db.patch("rooms", room._id, {
        botDifficulty: args.botDifficulty,
        settings: args.settings,
        updatedAt: Date.now(),
      }),
    ]);
    return null;
  },
});

export const startGame = mutation({
  args: {
    code: v.string(),
    fillEmptySeatsWithBots: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seats = await listSeats(ctx, room._id);
    requireHost(
      room,
      requireHumanSeatFromList(seats, user.id),
      "Only the room host can start the game.",
    );
    if (room.status === "active") return null;
    if (room.status === "finished") {
      fail("GAME_ALREADY_FINISHED", "Start a rematch to play again.");
    }

    const humanCount = seats.filter((seat) => seat.kind === "human").length;
    const startingSeats = args.fillEmptySeatsWithBots
      ? await reconcileWaitingSeats(
          ctx,
          room,
          room.settings,
          room.settings.maxPlayers - humanCount,
          seats,
        )
      : seats;
    await startRoomGame(ctx, room, startingSeats);
    return null;
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    displayName: v.string(),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seats = await listSeats(ctx, room._id);
    if (seats.some((seat) => seat.authUserId === user.id)) return { code: room.code };
    if (room.kickedAuthUserIds.includes(user.id)) {
      fail("KICKED", "The host removed you from this room.");
    }
    if (room.status !== "waiting") fail("ROOM_STARTED", "Game has already started.");

    const displayName = normalizeDisplayName(args.displayName);
    if (seats.length < room.settings.maxPlayers) {
      await ctx.db.insert("seats", {
        authUserId: user.id,
        displayName: uniqueDisplayName(displayName, seats),
        kind: "human",
        roomId: room._id,
        seatIndex: nextOpenSeatIndex(seats, room.settings.maxPlayers),
      });
    } else {
      const bots = seats.filter((seat) => seat.kind === "bot");
      const replacedBot = bots[bots.length - 1];
      if (!replacedBot) fail("ROOM_FULL", "Room is full.");
      await ctx.db.patch("seats", replacedBot._id, {
        authUserId: user.id,
        displayName: uniqueDisplayName(
          displayName,
          seats.filter((seat) => seat._id !== replacedBot._id),
        ),
        kind: "human",
      });
    }
    await ctx.db.patch("rooms", room._id, { updatedAt: Date.now() });
    return { code: room.code };
  },
});

export const leaveRoom = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const membership = await findHumanMembership(ctx, args.code, user.id);
    if (!membership) return null;
    const { room, seat, seats } = membership;
    const nextHost = otherHumans(seats, seat)[0];
    if (!nextHost) {
      await closeRoom(ctx, room);
      return null;
    }
    const isHost = seat._id === room.hostSeatId;

    if (room.status === "waiting") {
      await Promise.all([
        ctx.db.delete("seats", seat._id),
        clearPresence(ctx, room._id, user.id),
        ctx.db.patch("rooms", room._id, {
          ...(isHost ? { hostSeatId: nextHost._id } : {}),
          updatedAt: Date.now(),
        }),
      ]);
      return null;
    }

    const handOverHost = isHost
      ? [ctx.db.patch("rooms", room._id, { hostSeatId: nextHost._id })]
      : [];
    if (room.status === "finished") {
      // The finished game stays untouched; the seat only goes to a bot for a rematch.
      await Promise.all([releaseSeatToBot(ctx, room, seat, seats), ...handOverHost]);
      return null;
    }

    const hostText = isHost ? ` ${nextHost.displayName} is the host now.` : "";
    await Promise.all([
      convertGameSeatToBot(
        ctx,
        room,
        seat,
        seats,
        `${seat.displayName} left the game, so a bot is playing for them.${hostText}`,
      ),
      ...handOverHost,
    ]);
    return null;
  },
});

/** The host closes the room for good, for everyone in it (see canHostRemoveRoom). */
export const removeRoom = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const membership = await findHumanMembership(ctx, args.code, user.id);
    if (!membership) return null;
    const { room, seat, seats } = membership;
    requireHost(room, seat, "Only the host can remove this game.");
    if (!canHostRemoveRoom(room, seats, seat)) {
      fail("ROOM_HAS_PLAYERS", "Other players are still in this game, so it can't be removed.");
    }
    await closeRoom(ctx, room);
    return null;
  },
});

export const replacePlayerWithBot = mutation({
  args: {
    code: v.string(),
    targetSeatId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seats = await listSeats(ctx, room._id);
    const hostSeat = requireHumanSeatFromList(seats, user.id);
    requireHost(room, hostSeat, "Only the room host can replace a player with a bot.");

    const targetSeatId = ctx.db.normalizeId("seats", args.targetSeatId);
    const targetSeat = seats.find((seat) => seat._id === targetSeatId);
    if (!targetSeat) {
      fail("TARGET_SEAT_NOT_FOUND", "Target seat does not belong to this room.");
    }
    if (targetSeat._id === hostSeat._id) {
      fail("CANNOT_REPLACE_SELF", "The host cannot replace their own seat.");
    }
    if (targetSeat.kind !== "human") {
      fail("TARGET_NOT_HUMAN", "Target seat is not controlled by a human player.");
    }
    if (room.status === "finished") {
      fail("GAME_ALREADY_FINISHED", "A completed game cannot replace player control.");
    }

    if (room.status === "waiting") {
      await Promise.all([
        releaseSeatToBot(ctx, room, targetSeat, seats),
        ctx.db.patch("rooms", room._id, {
          kickedAuthUserIds: targetSeat.authUserId
            ? [...room.kickedAuthUserIds, targetSeat.authUserId]
            : room.kickedAuthUserIds,
          updatedAt: Date.now(),
        }),
      ]);
      return null;
    }

    await convertGameSeatToBot(
      ctx,
      room,
      targetSeat,
      seats,
      `${hostSeat.displayName} replaced ${targetSeat.displayName} with a bot.`,
    );
    return null;
  },
});

export const rematch = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seats = await listSeats(ctx, room._id);
    const seat = requireHumanSeatFromList(seats, user.id);
    if (room.status === "waiting") return null;
    if (room.status !== "finished") {
      fail("GAME_NOT_FINISHED", "A rematch can start once the game has finished.");
    }
    await requireActingHost(ctx, room, seats, seat, "Only the room host can start a rematch.");

    await Promise.all([
      ctx.db.patch("rooms", room._id, {
        gameId: undefined,
        status: "waiting",
        updatedAt: Date.now(),
      }),
      ...(room.gameId
        ? [ctx.scheduler.runAfter(0, internal.cleanup.purgeGame, { gameId: room.gameId })]
        : []),
    ]);
    return null;
  },
});

export const updateDisplayName = mutation({
  args: {
    displayName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const displayName = normalizeDisplayName(args.displayName);
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_auth_user_id", (index) => index.eq("authUserId", user.id))
      .order("desc")
      .take(RENAMED_SEAT_LIMIT);
    await Promise.all(
      seats.map(async (seat) => {
        const room = await ctx.db.get("rooms", seat.roomId);
        if (room?.status !== "waiting") return;
        const roomSeats = await listSeats(ctx, room._id);
        await ctx.db.patch("seats", seat._id, {
          displayName: uniqueDisplayName(
            displayName,
            roomSeats.filter((other) => other._id !== seat._id),
          ),
        });
      }),
    );
    return null;
  },
});

export const sendChatMessage = mutation({
  args: {
    body: v.string(),
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seat = await requireHumanSeat(ctx, room._id, user.id);
    const body = normalizeChatMessage(args.body);
    const lastMessage = await ctx.db
      .query("roomMessages")
      .withIndex("by_room_and_auth_user_id", (index) =>
        index.eq("roomId", room._id).eq("authUserId", user.id),
      )
      .order("desc")
      .first();
    if (lastMessage && Date.now() - lastMessage._creationTime < CHAT_COOLDOWN_MS) {
      fail("RATE_LIMITED", "You are sending messages too quickly.");
    }

    await ctx.db.insert("roomMessages", {
      authUserId: user.id,
      authorSeatId: seat._id,
      body,
      displayName: seat.displayName,
      roomId: room._id,
      seatIndex: seat.seatIndex,
    });
    return null;
  },
});

export const listChatMessages = query({
  args: {
    code: v.string(),
  },
  returns: v.array(chatMessageViewValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const membership = await findHumanMembership(ctx, args.code, user.id);
    if (!membership) return [];
    const messages = await ctx.db
      .query("roomMessages")
      .withIndex("by_room_id", (index) => index.eq("roomId", membership.room._id))
      .order("desc")
      .take(CHAT_HISTORY_LIMIT);
    return messages.reverse().map((message) => {
      // Lobby seats are renumbered when the host changes the table, so color by the current seat.
      const seatIndex =
        membership.seats.find(
          (seat) => seat._id === message.authorSeatId && seat.authUserId === message.authUserId,
        )?.seatIndex ?? message.seatIndex;
      return {
        body: message.body,
        displayName: message.displayName,
        id: message._id,
        isMine: message.authUserId === user.id,
        playerColor: seatColor(seatIndex),
        seatIndex,
        sentAt: message._creationTime,
      };
    });
  },
});

export const heartbeat = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const membership = await findHumanMembership(ctx, args.code, user.id);
    if (membership) await recordHeartbeat(ctx, membership.room._id, user.id, Date.now());
    return null;
  },
});

export const listPresence = query({
  args: {
    code: v.string(),
  },
  returns: v.array(presenceViewValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const membership = await findHumanMembership(ctx, args.code, user.id);
    if (!membership) return [];
    const presence = await Promise.all(
      membership.seats.map(async (seat) => {
        const seen =
          seat.authUserId === undefined
            ? null
            : await findPresence(ctx, membership.room._id, seat.authUserId);
        return seen ? [{ lastSeenAt: seen.lastSeenAt, seatIndex: seat.seatIndex }] : [];
      }),
    );
    return presence.flat();
  },
});

export const getRoom = query({
  args: {
    code: v.string(),
  },
  returns: v.union(v.null(), roomViewValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const membership = await findHumanMembership(ctx, args.code, user.id);
    if (!membership) return null;
    return await toRoomView(ctx, membership.room, membership.seat, membership.seats);
  },
});
