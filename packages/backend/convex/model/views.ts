import { PLAYER_COLORS } from "./constants";
import { parseCommandKind } from "./commands";
import { fail } from "./errors";
import {
  parseGameState,
  playerViewJson,
  requiredAutomatedActor,
  roomViewStatus,
} from "./gameState";
import { validateGameSettings } from "./normalize";
import type { GameEventView, GameId, ReadCtx, RoomDoc, RoomView, SeatDoc } from "./types";

async function listGameEvents(ctx: ReadCtx, gameId: GameId): Promise<GameEventView[]> {
  const events = await ctx.db
    .query("gameActions")
    .withIndex("by_game_and_after_revision", (index) => index.eq("gameId", gameId))
    .order("desc")
    .take(40);
  return [...events].reverse().map((event) => ({
    actorPlayerId: String(event.actorSeatId),
    createdAt: event.createdAt,
    kind: event.eventKind ?? parseCommandKind(event.commandJson),
    sequence: event._creationTime,
    text: event.text,
  }));
}

export async function toRoomView(
  ctx: ReadCtx,
  room: RoomDoc,
  seat: SeatDoc,
  seats: readonly SeatDoc[],
): Promise<RoomView> {
  const roomSettings = validateGameSettings(room.settings);
  const members = seats.map((member) => ({
    controller: member.kind === "bot" ? ("bot" as const) : ("player" as const),
    displayName: member.displayName,
    id: String(member._id),
    playerColor: PLAYER_COLORS[member.seatIndex] ?? PLAYER_COLORS[0],
    ready: true,
    role: member._id === room.hostSeatId ? ("host" as const) : ("player" as const),
    seatIndex: member.seatIndex,
  }));
  const base: RoomView = {
    botDifficulty: room.botDifficulty,
    botThinking: false,
    code: room.code,
    events: [] as GameEventView[],
    isHost: seat._id === room.hostSeatId,
    isPaused: false,
    members,
    settings: roomSettings,
    status: roomViewStatus(room.status),
  };
  if (!room.gameId) return base;

  const [game, events] = await Promise.all([
    ctx.db.get("games", room.gameId),
    listGameEvents(ctx, room.gameId),
  ]);
  if (!game) fail("CORRUPT_GAME_STATE", "Room points to a missing game.");
  const gameSettings = validateGameSettings(game.settings);
  const state = parseGameState(game.stateJson);
  const automatedActor = requiredAutomatedActor(state);
  return {
    ...base,
    botDifficulty: game.botDifficulty,
    botThinking:
      game.status === "active" && automatedActor?.isBot === true && game.nextActionAt !== undefined,
    events,
    gameJson: playerViewJson(state, seat),
    isPaused: game.status === "paused",
    nextActionAt: game.nextActionAt,
    settings: gameSettings,
  };
}
