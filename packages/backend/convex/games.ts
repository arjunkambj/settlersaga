import {
  DEFAULT_BASE_GAME_SETTINGS,
  GameRuleError,
  applyCommand as applyGameCommand,
} from "@settersaga/game";
import type { GameCommand } from "@settersaga/game";
import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireCurrentHexclaveUser } from "./hexclave/auth";
import { commandText, serializeCommand, validateCommandBounds } from "./model/commands";
import { fail } from "./model/errors";
import {
  createRoomRecord,
  parseGameState,
  persistAppliedCommand,
  resumeAutomatedActionSchedule,
  setWaitingBotCount,
  startRoomGame,
} from "./model/gameState";
import {
  validateActionNumber,
  validateBotCount,
  validateClientActionId,
  validateGameSettings,
} from "./model/normalize";
import {
  listSeats,
  requireHumanSeat,
  requireHumanSeatFromList,
  requireRoom,
} from "./model/roomQueries";
import { commandValidator } from "./model/validators";
import { baseGameSettingsValidator, botDifficultyValidator } from "./schema";
import { DEFAULT_BOT_DIFFICULTY } from "./model/constants";

export const startGame = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seats = await listSeats(ctx, room._id);
    const seat = requireHumanSeatFromList(seats, user.id);
    if (seat._id !== room.hostSeatId) fail("NOT_HOST", "Only the room host can start the game.");
    await startRoomGame(ctx, room, seats);
    return null;
  },
});

export const createQuickGame = mutation({
  args: {
    botCount: v.optional(v.number()),
    botDifficulty: v.optional(botDifficultyValidator),
    displayName: v.string(),
    settings: v.optional(baseGameSettingsValidator),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const settings = validateGameSettings(args.settings ?? DEFAULT_BASE_GAME_SETTINGS);
    const botCount = validateBotCount(
      args.botCount ?? settings.maxPlayers - 1,
      settings.maxPlayers,
    );
    if (botCount + 1 !== settings.maxPlayers) {
      fail(
        "INVALID_BOT_COUNT",
        `A solo ${settings.maxPlayers}-player game requires ${settings.maxPlayers - 1} bots.`,
      );
    }
    const botDifficulty = args.botDifficulty ?? DEFAULT_BOT_DIFFICULTY;
    const { code, room, seat } = await createRoomRecord(
      ctx,
      user,
      args.displayName,
      settings,
      botDifficulty,
    );
    const seats = await setWaitingBotCount(ctx, room, botCount, [seat]);
    await startRoomGame(ctx, room, seats);
    return { code };
  },
});

export const pauseGame = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seat = await requireHumanSeat(ctx, room._id, user.id);
    if (seat._id !== room.hostSeatId) fail("NOT_HOST", "Only the room host can pause the game.");
    if (!room.gameId) fail("GAME_NOT_STARTED", "Game has not started.");

    const game = await ctx.db.get("games", room.gameId);
    if (!game) fail("GAME_NOT_STARTED", "Game has not started.");
    if (game.status === "paused") return null;
    if (game.status === "finished") fail("GAME_ALREADY_FINISHED", "Game has already finished.");

    const state = parseGameState(game.stateJson);
    if (game.revision !== state.actionNumber) {
      fail("CORRUPT_GAME_STATE", "Stored game revision does not match its state.");
    }

    const now = Date.now();
    await Promise.all([
      ctx.db.patch("games", game._id, {
        nextActionAt: undefined,
        pausedNextActionRemainingMs:
          game.nextActionAt === undefined ? undefined : Math.max(0, game.nextActionAt - now),
        pausedTurnDeadlineRemainingMs:
          game.turnDeadlineAt === undefined ? undefined : Math.max(0, game.turnDeadlineAt - now),
        status: "paused",
        turnDeadlineAt: undefined,
        updatedAt: now,
      }),
      ctx.db.insert("gameActions", {
        actorSeatId: seat._id,
        afterRevision: game.revision,
        beforeRevision: game.revision,
        clientActionId: `system:game-paused:${game.revision}:${now}`,
        commandJson: JSON.stringify({ kind: "pause_game" }),
        createdAt: now,
        eventKind: "game_paused",
        gameId: game._id,
        text: `${seat.displayName} paused the game.`,
      }),
    ]);
    return null;
  },
});

export const resumeGame = mutation({
  args: {
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seat = await requireHumanSeat(ctx, room._id, user.id);
    if (seat._id !== room.hostSeatId) fail("NOT_HOST", "Only the room host can resume the game.");
    if (!room.gameId) fail("GAME_NOT_STARTED", "Game has not started.");

    const game = await ctx.db.get("games", room.gameId);
    if (!game) fail("GAME_NOT_STARTED", "Game has not started.");
    if (game.status === "active") return null;
    if (game.status === "finished") fail("GAME_ALREADY_FINISHED", "Game has already finished.");

    const state = parseGameState(game.stateJson);
    if (game.revision !== state.actionNumber) {
      fail("CORRUPT_GAME_STATE", "Stored game revision does not match its state.");
    }

    const now = Date.now();
    const schedule = await resumeAutomatedActionSchedule(
      ctx,
      game._id,
      state,
      now,
      game.pausedNextActionRemainingMs,
      game.pausedTurnDeadlineRemainingMs,
    );
    await Promise.all([
      ctx.db.patch("games", game._id, {
        ...schedule,
        pausedNextActionRemainingMs: undefined,
        pausedTurnDeadlineRemainingMs: undefined,
        status: "active",
        updatedAt: now,
      }),
      ctx.db.insert("gameActions", {
        actorSeatId: seat._id,
        afterRevision: game.revision,
        beforeRevision: game.revision,
        clientActionId: `system:game-resumed:${game.revision}:${now}`,
        commandJson: JSON.stringify({ kind: "resume_game" }),
        createdAt: now,
        eventKind: "game_resumed",
        gameId: game._id,
        text: `${seat.displayName} resumed the game.`,
      }),
    ]);
    return null;
  },
});

export const applyCommand = mutation({
  args: {
    clientActionId: v.string(),
    code: v.string(),
    command: commandValidator,
    expectedActionNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    const room = await requireRoom(ctx, args.code);
    const seat = await requireHumanSeat(ctx, room._id, user.id);
    if (!room.gameId) fail("GAME_NOT_STARTED", "Game has not started.");

    const game = await ctx.db.get("games", room.gameId);
    if (!game) fail("GAME_NOT_STARTED", "Game has not started.");
    if (game.status === "paused") fail("GAME_PAUSED", "The game is paused.");
    validateGameSettings(game.settings);
    const clientActionId = validateClientActionId(args.clientActionId);
    const command = args.command as GameCommand;
    validateCommandBounds(command);
    const commandJson = serializeCommand(command);

    const existingAction = await ctx.db
      .query("gameActions")
      .withIndex("by_game_and_client_action_id", (index) =>
        index.eq("gameId", game._id).eq("clientActionId", clientActionId),
      )
      .unique();
    if (existingAction) {
      if (existingAction.actorSeatId !== seat._id || existingAction.commandJson !== commandJson) {
        fail("CLIENT_ACTION_CONFLICT", "Client action ID was already used for another command.");
      }
      return null;
    }

    const expectedActionNumber = validateActionNumber(args.expectedActionNumber);
    const state = parseGameState(game.stateJson);
    if (game.revision !== state.actionNumber) {
      fail("CORRUPT_GAME_STATE", "Stored game revision does not match its state.");
    }
    if (expectedActionNumber !== game.revision) {
      fail(
        "STALE_ACTION_NUMBER",
        `Expected action ${expectedActionNumber}, but the game is at action ${game.revision}.`,
      );
    }
    if (state.status === "completed") fail("GAME_ALREADY_FINISHED", "Game has already finished.");

    // The timeout mutation competes through this same revision. Rejecting on wall-clock time
    // creates a dead zone when scheduler delivery is delayed; the first mutation to commit wins.

    let nextState;
    try {
      nextState = applyGameCommand(state, String(seat._id), command);
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      const message = error instanceof Error ? error.message : "Game command was rejected.";
      fail(error instanceof GameRuleError ? error.code : "INVALID_COMMAND", message);
    }

    await persistAppliedCommand(
      ctx,
      game,
      state,
      nextState,
      seat,
      command,
      clientActionId,
      commandText(command, seat.displayName, state, nextState),
    );
    return null;
  },
});
