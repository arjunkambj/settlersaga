import {
  applyCommand,
  assertGameState,
  chooseAutomatedCommand,
  chooseFallbackCommand,
} from "@settersaga/game";
import type { GameCommand, GameState } from "@settersaga/game";
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { commandText } from "./model/commands";
import { fail } from "./model/errors";
import { pauseGameRecord, persistAppliedCommand } from "./model/gameRecords";
import { requiredAutomatedActor } from "./model/scheduling";
import { parseGameState } from "./model/storage";

type CommandChooser = (state: GameState, playerId: string) => GameCommand;

/**
 * The player's own policy first, then the engine's plainest legal move, so a bug in a bot strategy
 * or in the timeout heuristics costs a weaker move instead of stalling the table.
 */
const MOVE_CHOOSERS: readonly CommandChooser[] = [chooseAutomatedCommand, chooseFallbackCommand];

/** The first chooser's move that the rules accept and that leaves a valid state, if any. */
export function chooseAutomatedMove(
  state: GameState,
  playerId: string,
  choosers = MOVE_CHOOSERS,
): { command: GameCommand; nextState: GameState } | null {
  for (const choose of choosers) {
    try {
      const command = choose(state, playerId);
      const nextState = applyCommand(state, playerId, command);
      // Checked here as well as on storage, so an invalid result falls back instead of failing
      // the job and leaving the game with nothing scheduled.
      assertGameState(nextState);
      return { command, nextState };
    } catch (error) {
      console.error(`Automated move for ${playerId} failed`, error);
    }
  }
  return null;
}

export const runAutomatedAction = internalMutation({
  args: {
    automationToken: v.number(),
    gameId: v.id("games"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const game = await ctx.db.get("games", args.gameId);
    if (!game || game.status !== "active" || game.automationToken !== args.automationToken) {
      return null;
    }
    const state = parseGameState(game.stateJson);
    const actor = requiredAutomatedActor(state);
    if (!actor) return null;

    const actorSeatId = ctx.db.normalizeId("seats", actor.playerId);
    const actorSeat = actorSeatId ? await ctx.db.get("seats", actorSeatId) : null;
    if (!actorSeat || actorSeat.roomId !== game.roomId) {
      fail("CORRUPT_GAME_STATE", "Automated actor does not own a room seat.");
    }

    const move = chooseAutomatedMove(state, actor.playerId);
    if (!move) {
      // A stuck bot would stall the table silently, so the host gets a paused game instead; a
      // timed-out human only loses the clock and can still make the move themselves.
      if (actor.isBot) {
        await pauseGameRecord(ctx, game, {
          actorSeatId: actorSeat._id,
          text: `${actorSeat.displayName} couldn't make a move, so the game paused.`,
        });
      } else {
        await ctx.db.patch("games", game._id, { nextActionAt: undefined });
      }
      return null;
    }

    const actionText = commandText(move.command, actor.playerId, state, move.nextState);
    await persistAppliedCommand(ctx, {
      actorSeatId: actorSeat._id,
      command: move.command,
      game,
      jobConsumed: true,
      nextState: move.nextState,
      state,
      text: actor.isBot ? actionText : `${actorSeat.displayName} timed out. ${actionText}`,
    });
    return null;
  },
});
