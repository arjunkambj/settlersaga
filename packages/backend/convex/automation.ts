import { applyCommand, chooseAutomatedCommand } from "@settersaga/game";
import { v } from "convex/values";

import { isScheduledActionCurrentAndDue, logicalTurnId } from "../lib/game-scheduling";
import { internalMutation } from "./_generated/server";
import { commandText } from "./model/commands";
import { fail } from "./model/errors";
import { parseGameState, persistAppliedCommand, requiredAutomatedActor } from "./model/gameState";
import { validateActionNumber, validateGameSettings } from "./model/normalize";

export const runAutomatedAction = internalMutation({
  args: {
    expectedActionNumber: v.number(),
    expectedActorPlayerId: v.optional(v.string()),
    expectedTurnId: v.optional(v.string()),
    gameId: v.id("games"),
    scheduledFor: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const expectedActionNumber = validateActionNumber(args.expectedActionNumber);
    const game = await ctx.db.get("games", args.gameId);
    if (!game || game.status !== "active") {
      return null;
    }
    const state = args.expectedTurnId === undefined ? undefined : parseGameState(game.stateJson);
    if (
      !isScheduledActionCurrentAndDue({
        currentActionAt: game.nextActionAt,
        currentActionNumber: game.revision,
        currentTurnId: state ? logicalTurnId(state) : undefined,
        expectedActionNumber,
        expectedTurnId: args.expectedTurnId,
        now: Date.now(),
        scheduledFor: args.scheduledFor,
      })
    ) {
      return null;
    }

    const settings = validateGameSettings(game.settings);
    const currentState = state ?? parseGameState(game.stateJson);
    if (currentState.actionNumber !== game.revision) {
      fail("CORRUPT_GAME_STATE", "Stored game revision does not match its state.");
    }
    const actor = requiredAutomatedActor(currentState);
    if (
      !actor ||
      (args.expectedActorPlayerId !== undefined && actor.playerId !== args.expectedActorPlayerId) ||
      (!actor.isBot && settings.turnTimerSeconds === 0)
    ) {
      return null;
    }

    const actorSeatId = ctx.db.normalizeId("seats", actor.playerId);
    const actorSeat = actorSeatId ? await ctx.db.get("seats", actorSeatId) : null;
    if (!actorSeat || actorSeat.roomId !== game.roomId) {
      fail("CORRUPT_GAME_STATE", "Automated actor does not own a room seat.");
    }

    let command;
    let nextState;
    try {
      command = chooseAutomatedCommand(currentState, actor.playerId);
      nextState = applyCommand(currentState, actor.playerId, command);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Automated action failed.";
      fail("AUTOMATED_ACTION_FAILED", message);
    }

    const actionText = commandText(command, actorSeat.displayName, currentState, nextState);
    await persistAppliedCommand(
      ctx,
      game,
      currentState,
      nextState,
      actorSeat,
      command,
      `system:automated:${currentState.actionNumber}`,
      actor.isBot ? actionText : `${actorSeat.displayName} timed out. ${actionText}`,
    );
    return null;
  },
});
