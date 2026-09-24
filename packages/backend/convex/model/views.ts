import { PLAYER_COLORS, toPlayerView, type GameState, type PlayerColor } from "@settersaga/game";

import { fail } from "./errors";
import { requiredAutomatedActor, resumedRemainingMs } from "./scheduling";
import { parseGameState } from "./storage";
import type { GameDoc, GameEventView, GameId, ReadCtx, RoomDoc, RoomView, SeatDoc } from "./types";

const EVENT_LIMIT = 40;

export function seatColor(seatIndex: number): PlayerColor {
  const color = PLAYER_COLORS[seatIndex];
  if (!color) fail("CORRUPT_GAME_STATE", `Seat ${seatIndex} has no player color.`);
  return color;
}

async function listGameEvents(ctx: ReadCtx, gameId: GameId): Promise<GameEventView[]> {
  const events = await ctx.db
    .query("gameActions")
    .withIndex("by_game_and_after_revision", (index) => index.eq("gameId", gameId))
    .order("desc")
    .take(EVENT_LIMIT);
  return events.reverse().map((event) => ({
    actorPlayerId: event.actorSeatId,
    createdAt: event._creationTime,
    id: event._id,
    kind: event.eventKind,
    text: event.text,
  }));
}

/** What the paused clock shows: the time left for the next move once play resumes. */
function pausedClockMs(game: GameDoc, state: GameState): number | undefined {
  const { nextActionMs, turnDeadlineMs } = resumedRemainingMs(game, state);
  return nextActionMs ?? turnDeadlineMs;
}

export async function toRoomView(
  ctx: ReadCtx,
  room: RoomDoc,
  viewerSeat: SeatDoc,
  seats: readonly SeatDoc[],
): Promise<RoomView> {
  const base: RoomView = {
    botDifficulty: room.botDifficulty,
    botThinking: false,
    code: room.code,
    events: [],
    isHost: viewerSeat._id === room.hostSeatId,
    isPaused: false,
    members: seats.map((member) => ({
      controller: member.kind === "bot" ? "bot" : "player",
      displayName: member.displayName,
      id: member._id,
      isViewer: member._id === viewerSeat._id,
      playerColor: seatColor(member.seatIndex),
      role: member._id === room.hostSeatId ? "host" : "player",
      seatIndex: member.seatIndex,
    })),
    settings: room.settings,
    status: room.status,
  };
  if (!room.gameId) return base;

  const [game, events] = await Promise.all([
    ctx.db.get("games", room.gameId),
    listGameEvents(ctx, room.gameId),
  ]);
  if (!game) fail("CORRUPT_GAME_STATE", "Room points to a missing game.");
  const state = parseGameState(game.stateJson);
  const isPaused = game.status === "paused";
  return {
    ...base,
    botThinking:
      game.status === "active" &&
      requiredAutomatedActor(state)?.isBot === true &&
      game.nextActionAt !== undefined,
    events,
    gameJson: JSON.stringify(toPlayerView(state, viewerSeat._id)),
    isPaused,
    nextActionAt: game.nextActionAt,
    pausedRemainingMs: isPaused ? pausedClockMs(game, state) : undefined,
  };
}
