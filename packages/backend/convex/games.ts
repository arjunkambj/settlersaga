import { GameRuleError, applyCommand as applyGameCommand } from "@settersaga/game";
import type { GameCommand, GameState } from "@settersaga/game";
import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireCurrentHexclaveUser } from "./hexclave/auth";
import { commandText, serializeCommand } from "./model/commands";
import { MAX_SEATS } from "./model/constants";
import { fail } from "./model/errors";
import {
  insertSystemEvent,
  pauseGameRecord,
  persistAppliedCommand,
  requireRoomGame,
} from "./model/gameRecords";
import { createRoomRecord, reconcileWaitingSeats, startRoomGame } from "./model/lobby";
import { validateClientActionId, validateGameSettings } from "./model/normalize";
import { requireActingHost } from "./model/presence";
import {
  listSeats,
  requireHumanSeat,
  requireHumanSeatFromList,
  requireRoom,
} from "./model/roomQueries";
import { resumeAutomatedActionSchedule } from "./model/scheduling";
import { parseGameState } from "./model/storage";
import type { GameDoc, ReadCtx } from "./model/types";
import {
  baseGameSettingsValidator,
  botDifficultyValidator,
  commandValidator,
} from "./model/validators";

/** Answers several players give at once, which do not depend on each other. */
const CONCURRENT_ANSWER_COMMANDS: ReadonlySet<GameCommand["kind"]> = new Set([
  "discard",
  "respond_trade",
]);

/**
 * Whether a concurrent answer made at an older revision only missed other answers of the same
 * kind, which leaves it valid; the engine still checks it against the current state. Anything else
 * in between makes it stale, such as a discard replayed from an offline queue into a later
 * discard phase.
 */
async function missedOnlyConcurrentAnswers(
  ctx: ReadCtx,
  game: GameDoc,
  kind: GameCommand["kind"],
  expectedActionNumber: number,
): Promise<boolean> {
  if (!CONCURRENT_ANSWER_COMMANDS.has(kind) || expectedActionNumber > game.revision) return false;
  // Every other seat answering first is the most that can land in between.
  const missed = await ctx.db
    .query("gameActions")
    .withIndex("by_game_and_after_revision", (index) =>
      index.eq("gameId", game._id).gt("afterRevision", expectedActionNumber),
    )
    .take(MAX_SEATS);
  return missed.length < MAX_SEATS && missed.every((action) => action.eventKind === kind);
}

export const createQuickGame = mutation({
  args: {
    botDifficulty: botDifficultyValidator,
    displayName: v.string(),
    settings: baseGameSettingsValidator,
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentHexclaveUser(ctx);
    validateGameSettings(args.settings);
    const { code, room, seat } = await createRoomRecord(
      ctx,
      user.id,
      args.displayName,
      args.settings,
      args.botDifficulty,
    );
    const seats = await reconcileWaitingSeats(
      ctx,
      room,
      args.settings,
      args.settings.maxPlayers - 1,
      [seat],
    );
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
    const seats = await listSeats(ctx, room._id);
    const seat = requireHumanSeatFromList(seats, user.id);
    const game = await requireRoomGame(ctx, room);
    if (game.status === "paused") return null;
    if (game.status === "finished") fail("GAME_ALREADY_FINISHED", "Game has already finished.");
    await requireActingHost(ctx, room, seats, seat, "Only the room host can pause the game.");

    await pauseGameRecord(ctx, game, {
      actorSeatId: seat._id,
      text: `${seat.displayName} paused the game.`,
    });
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
    const seats = await listSeats(ctx, room._id);
    const seat = requireHumanSeatFromList(seats, user.id);
    const game = await requireRoomGame(ctx, room);
    if (game.status === "active") return null;
    if (game.status === "finished") fail("GAME_ALREADY_FINISHED", "Game has already finished.");
    await requireActingHost(ctx, room, seats, seat, "Only the room host can resume the game.");

    const state = parseGameState(game.stateJson);
    const schedule = await resumeAutomatedActionSchedule(ctx, game, state, Date.now());
    await Promise.all([
      ctx.db.patch("games", game._id, {
        ...schedule,
        pausedNextActionRemainingMs: undefined,
        pausedTurnDeadlineRemainingMs: undefined,
        status: "active",
      }),
      insertSystemEvent(ctx, game, {
        actorSeatId: seat._id,
        kind: "game_resumed",
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
    const game = await requireRoomGame(ctx, room);
    validateClientActionId(args.clientActionId);
    const command: GameCommand = args.command;

    const existingAction = await ctx.db
      .query("gameActions")
      .withIndex("by_game_and_client_action_id", (index) =>
        index.eq("gameId", game._id).eq("clientActionId", args.clientActionId),
      )
      .unique();
    if (existingAction) {
      if (
        existingAction.actorSeatId !== seat._id ||
        existingAction.commandJson !== serializeCommand(command)
      ) {
        fail("CLIENT_ACTION_CONFLICT", "Client action ID was already used for another command.");
      }
      return null;
    }

    if (game.status === "paused") fail("GAME_PAUSED", "The game is paused.");
    if (game.status === "finished") fail("GAME_ALREADY_FINISHED", "Game has already finished.");
    // No wall-clock deadline check: a timeout job and a player's command race on the revision,
    // and the first to commit wins.
    if (
      args.expectedActionNumber !== game.revision &&
      !(await missedOnlyConcurrentAnswers(ctx, game, command.kind, args.expectedActionNumber))
    ) {
      fail(
        "STALE_ACTION_NUMBER",
        `Expected action ${args.expectedActionNumber}, but the game is at action ${game.revision}.`,
      );
    }

    const state = parseGameState(game.stateJson);
    let nextState: GameState;
    try {
      nextState = applyGameCommand(state, seat._id, command);
    } catch (error) {
      if (error instanceof GameRuleError) fail(error.code, error.message);
      throw error;
    }

    await persistAppliedCommand(ctx, {
      actorSeatId: seat._id,
      clientActionId: args.clientActionId,
      command,
      game,
      jobConsumed: false,
      nextState,
      state,
      text: commandText(command, seat._id, state, nextState),
    });
    return null;
  },
});
