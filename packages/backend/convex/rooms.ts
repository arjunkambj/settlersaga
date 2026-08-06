import { v } from "convex/values";
import type { GameState } from "@settersaga/game";

import { mutation, query } from "./_generated/server";
import { requireCurrentHexclaveUser } from "./hexclave/auth";
import { fail } from "./model/errors";
import { createBotDisplayName } from "../lib/bot_names";
import {
  convertGameSeatToBot,
  createRoomRecord,
  fitWaitingSeatsToSettings,
  gameStatus,
  parseGameState,
  serializeGameState,
  setWaitingBotCount,
  transferPlayerToBot,
} from "./model/gameState";
import {
  normalizeDisplayName,
  normalizeSeatId,
  normalizeRoomCode,
  validateGameSettings,
} from "./model/normalize";
import {
  findRoom,
  findSeatByAuthUser,
  listSeats,
  nextOpenSeatIndex,
  requireHumanSeatFromList,
  requireRoom,
  requireWaitingHost,
} from "./model/roomQueries";
import { botDifficultyValidator, baseGameSettingsValidator } from "./schema";
import { roomViewValidator } from "./model/validators";
import { toRoomView } from "./model/views";

export const createRoom = mutation({
  args: {
    displayName: v.string(),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const { code } = await createRoomRecord(ctx, user, args.displayName);
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
    const { room, seats } = await requireWaitingHost(ctx, args.code, user.id);
    const settings = validateGameSettings(args.settings);
    const fittedSeats = await fitWaitingSeatsToSettings(ctx, room, settings, seats);
    await Promise.all([
      setWaitingBotCount(ctx, { ...room, settings }, args.botCount, fittedSeats),
      ctx.db.patch("rooms", room._id, {
        botDifficulty: args.botDifficulty,
        settings,
        updatedAt: Date.now(),
      }),
    ]);
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
    const existingSeat = await findSeatByAuthUser(ctx, room._id, user.id);
    if (existingSeat) return { code: room.code };
    if (room.status !== "waiting") fail("ROOM_STARTED", "Game has already started.");

    const seats = await listSeats(ctx, room._id);
    const displayName = normalizeDisplayName(args.displayName);
    const now = Date.now();
    if (seats.length < room.settings.maxPlayers) {
      const seatIndex = nextOpenSeatIndex(seats, room.settings.maxPlayers);
      await ctx.db.insert("seats", {
        authUserId: user.id,
        displayName,
        joinedAt: now,
        kind: "human",
        roomId: room._id,
        seatIndex,
      });
    } else {
      const replaceableBot = seats
        .filter((seat) => seat.kind === "bot")
        .sort((left, right) => right.seatIndex - left.seatIndex)[0];
      if (!replaceableBot) fail("ROOM_FULL", "Room is full.");
      await ctx.db.patch("seats", replaceableBot._id, {
        authUserId: user.id,
        displayName,
        joinedAt: now,
        kind: "human",
      });
    }
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
    const room = await requireRoom(ctx, args.code);
    const seats = await listSeats(ctx, room._id);
    const seat = requireHumanSeatFromList(seats, user.id);

    if (room.status === "waiting") {
      if (seat._id === room.hostSeatId) {
        await Promise.all([
          ...seats.map((waitingSeat) => ctx.db.delete("seats", waitingSeat._id)),
          ctx.db.delete("rooms", room._id),
        ]);
        return null;
      }

      await ctx.db.delete("seats", seat._id);
      return null;
    }

    const remainingHumans = seats.filter(
      (candidate) => candidate.kind === "human" && candidate._id !== seat._id,
    );
    if (room.status === "active" && remainingHumans.length === 0) {
      if (!room.gameId) fail("CORRUPT_GAME_STATE", "Active room does not have a game.");
      const game = await ctx.db.get("games", room.gameId);
      if (!game) fail("CORRUPT_GAME_STATE", "Room points to a missing game.");
      validateGameSettings(game.settings);
      const state = parseGameState(game.stateJson);
      if (game.revision !== state.actionNumber) {
        fail("CORRUPT_GAME_STATE", "Stored game revision does not match its state.");
      }
      const botDisplayName = createBotDisplayName(room._id, seat.seatIndex, seats);
      const nextState: GameState = {
        ...transferPlayerToBot(state, seat, room.botDifficulty, botDisplayName),
        phase: { kind: "finished" },
        status: "completed",
        tradeOffer: null,
        winnerPlayerId: null,
      };
      const now = Date.now();
      await Promise.all([
        ctx.db.patch("seats", seat._id, {
          authUserId: undefined,
          displayName: botDisplayName,
          kind: "bot",
        }),
        ctx.db.patch("games", game._id, {
          nextActionAt: undefined,
          pausedNextActionRemainingMs: undefined,
          pausedTurnDeadlineRemainingMs: undefined,
          stateJson: serializeGameState(nextState),
          status: gameStatus(nextState),
          turnDeadlineAt: undefined,
          updatedAt: now,
        }),
        ctx.db.patch("rooms", room._id, {
          status: gameStatus(nextState),
          updatedAt: now,
        }),
        ctx.db.insert("gameActions", {
          actorSeatId: seat._id,
          afterRevision: game.revision,
          beforeRevision: game.revision,
          clientActionId: `system:game-abandoned:${game.revision}`,
          commandJson: JSON.stringify({ kind: "game_abandoned" }),
          createdAt: now,
          gameId: game._id,
          text: `${seat.displayName} left. The game closed because no human players remain.`,
        }),
      ]);
      return null;
    }

    let eventText = `${seat.displayName} left the game and is now controlled by a bot.`;
    if (room.status === "active" && seat._id === room.hostSeatId) {
      const nextHost = remainingHumans[0];
      if (nextHost) {
        await ctx.db.patch("rooms", room._id, { hostSeatId: nextHost._id });
        eventText = `${eventText} ${nextHost.displayName} is now the room host.`;
      }
    }

    await convertGameSeatToBot(ctx, room, seat, eventText, seats);
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
    if (hostSeat._id !== room.hostSeatId) {
      fail("NOT_HOST", "Only the room host can replace a player with a bot.");
    }

    const targetSeatId = normalizeSeatId(args.targetSeatId);
    const targetSeat = seats.find((seat) => String(seat._id) === targetSeatId);
    if (!targetSeat) {
      fail("TARGET_SEAT_NOT_FOUND", "Target seat does not belong to this room.");
    }
    if (targetSeat._id === hostSeat._id) {
      fail("CANNOT_REPLACE_SELF", "The host cannot replace their own seat.");
    }
    if (targetSeat._id === room.hostSeatId) {
      fail("CANNOT_REPLACE_HOST", "The host seat cannot be replaced.");
    }
    if (targetSeat.kind !== "human") {
      fail("TARGET_NOT_HUMAN", "Target seat is not controlled by a human player.");
    }

    if (room.status === "waiting") {
      const botDisplayName = createBotDisplayName(room._id, targetSeat.seatIndex, seats);
      await ctx.db.patch("seats", targetSeat._id, {
        authUserId: undefined,
        displayName: botDisplayName,
        joinedAt: Date.now(),
        kind: "bot",
      });
      return null;
    }
    if (room.status === "finished") {
      fail("GAME_ALREADY_FINISHED", "A completed game cannot replace player control.");
    }

    await convertGameSeatToBot(
      ctx,
      room,
      targetSeat,
      `${hostSeat.displayName} replaced ${targetSeat.displayName} with a bot.`,
      seats,
    );
    return null;
  },
});

export const getRoom = query({
  args: {
    code: v.string(),
  },
  returns: v.union(v.null(), roomViewValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const code = normalizeRoomCode(args.code);
    const room = await findRoom(ctx, code);
    if (!room) return null;
    const seats = await listSeats(ctx, room._id);
    const seat = seats.find((candidate) => candidate.authUserId === user.id);
    if (!seat || seat.kind !== "human") return null;
    return await toRoomView(ctx, room, seat, seats);
  },
});
