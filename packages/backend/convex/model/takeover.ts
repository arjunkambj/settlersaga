import type { GameState } from "@settersaga/game";

import { insertSystemEvent, requireRoomGame } from "./gameRecords";
import { createBotDisplayName } from "./lobby";
import { clearPresence } from "./presence";
import { scheduleNextAutomatedAction } from "./scheduling";
import { parseGameState, serializeGameState } from "./storage";
import type { RoomDoc, SeatDoc, WriteCtx } from "./types";

/** Gives a human's seat to a bot and returns the bot's name. */
export async function releaseSeatToBot(
  ctx: WriteCtx,
  room: RoomDoc,
  seat: SeatDoc,
  seats: readonly SeatDoc[],
): Promise<string> {
  const displayName = createBotDisplayName(room._id, seat.seatIndex, seats);
  await Promise.all([
    ctx.db.patch("seats", seat._id, { authUserId: undefined, displayName, kind: "bot" }),
    clearPresence(ctx, room._id, seat.authUserId),
  ]);
  return displayName;
}

/** Hands a running game's seat to a bot, which takes the player's next required action. */
export async function convertGameSeatToBot(
  ctx: WriteCtx,
  room: RoomDoc,
  seat: SeatDoc,
  seats: readonly SeatDoc[],
  text: string,
): Promise<void> {
  const game = await requireRoomGame(ctx, room);
  const state = parseGameState(game.stateJson);
  const displayName = await releaseSeatToBot(ctx, room, seat, seats);
  const nextState: GameState = {
    ...state,
    players: state.players.map((player) =>
      player.id === seat._id
        ? { ...player, botDifficulty: room.botDifficulty, displayName, isBot: true }
        : player,
    ),
  };
  // A paused game keeps no clocks; resumeGame schedules the bot once play continues.
  const schedule =
    game.status === "paused"
      ? {}
      : await scheduleNextAutomatedAction(ctx, game, nextState, Date.now(), {
          jobConsumed: false,
          nextActionAt: game.nextActionAt,
          state,
          turnDeadlineAt: game.turnDeadlineAt,
        });
  await Promise.all([
    ctx.db.patch("games", game._id, { ...schedule, stateJson: serializeGameState(nextState) }),
    insertSystemEvent(ctx, game, { actorSeatId: seat._id, kind: "bot_control_started", text }),
  ]);
}
