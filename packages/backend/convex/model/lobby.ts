import { DEFAULT_BASE_GAME_SETTINGS, chooseBotName, createDefaultGame } from "@settersaga/game";
import type { BaseGameSettings, BotDifficulty } from "@settersaga/game";

import { countOf } from "./commands";
import { DEFAULT_BOT_DIFFICULTY } from "./constants";
import { fail } from "./errors";
import { insertSystemEvent } from "./gameRecords";
import { normalizeDisplayName } from "./normalize";
import { allocateRoomCode } from "./roomQueries";
import { scheduleNextAutomatedAction } from "./scheduling";
import { serializeGameState } from "./storage";
import type { RoomDoc, RoomId, RoomRecord, SeatRecord, WriteCtx } from "./types";

export function createBotDisplayName(
  roomId: RoomId,
  seatIndex: number,
  seats: readonly Pick<SeatRecord, "displayName">[],
): string {
  return chooseBotName(
    `${roomId}:${seatIndex}`,
    seats.map((seat) => seat.displayName),
  );
}

function createPrivateGameSeed(): string {
  return Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36),
  ).join(":");
}

export async function createRoomRecord(
  ctx: WriteCtx,
  authUserId: string,
  rawDisplayName: string,
  settings: BaseGameSettings = DEFAULT_BASE_GAME_SETTINGS,
  botDifficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
): Promise<{ code: string; room: RoomRecord; seat: SeatRecord }> {
  const displayName = normalizeDisplayName(rawDisplayName);
  const code = await allocateRoomCode(ctx);
  const room = {
    botDifficulty,
    code,
    kickedAuthUserIds: [],
    settings,
    status: "waiting" as const,
    updatedAt: Date.now(),
  };
  const roomId = await ctx.db.insert("rooms", room);
  const seat = { authUserId, displayName, kind: "human" as const, roomId, seatIndex: 0 };
  const seatId = await ctx.db.insert("seats", seat);
  await ctx.db.patch("rooms", roomId, { hostSeatId: seatId });
  return {
    code,
    room: { ...room, _id: roomId, hostSeatId: seatId },
    seat: { ...seat, _id: seatId },
  };
}

/**
 * Seats the host first, then the other humans, then `botCount` bots, dropping or adding bots as
 * needed so the seat indexes run from zero without gaps.
 */
export async function reconcileWaitingSeats(
  ctx: WriteCtx,
  room: RoomRecord,
  settings: BaseGameSettings,
  botCount: number,
  seats: readonly SeatRecord[],
): Promise<SeatRecord[]> {
  const humans = seats.filter((seat) => seat.kind === "human");
  if (humans.length > settings.maxPlayers) {
    fail("TOO_MANY_PLAYERS", "The room has more human players than the selected player count.");
  }
  const botCapacity = settings.maxPlayers - humans.length;
  if (!Number.isSafeInteger(botCount) || botCount < 0 || botCount > botCapacity) {
    fail("INVALID_BOT_COUNT", `This table has room for 0 to ${botCapacity} bots.`);
  }

  const bots = seats
    .filter((seat) => seat.kind === "bot")
    .sort((left, right) => left.seatIndex - right.seatIndex);
  await Promise.all(bots.slice(botCount).map((seat) => ctx.db.delete("seats", seat._id)));

  const keptSeats = [...humans, ...bots.slice(0, botCount)].sort((left, right) => {
    if (left._id === room.hostSeatId) return -1;
    if (right._id === room.hostSeatId) return 1;
    if (left.kind !== right.kind) return left.kind === "human" ? -1 : 1;
    return left.seatIndex - right.seatIndex;
  });
  await Promise.all(
    keptSeats.flatMap((seat, seatIndex) =>
      seat.seatIndex === seatIndex ? [] : [ctx.db.patch("seats", seat._id, { seatIndex })],
    ),
  );

  const reconciled = keptSeats.map((seat, seatIndex) => ({ ...seat, seatIndex }));
  for (let seatIndex = reconciled.length; seatIndex < humans.length + botCount; seatIndex += 1) {
    const bot = {
      displayName: createBotDisplayName(room._id, seatIndex, reconciled),
      kind: "bot" as const,
      roomId: room._id,
      seatIndex,
    };
    reconciled.push({ ...bot, _id: await ctx.db.insert("seats", bot) });
  }
  return reconciled;
}

export async function startRoomGame(
  ctx: WriteCtx,
  room: RoomRecord,
  seats: readonly SeatRecord[],
): Promise<void> {
  const { hostSeatId, settings } = room;
  if (!hostSeatId) fail("NOT_HOST", "Room does not have a host seat.");
  if (
    seats.length !== settings.maxPlayers ||
    seats.some((seat, index) => seat.seatIndex !== index)
  ) {
    fail("ROOM_NOT_READY", `Fill all ${settings.maxPlayers} seats before starting.`);
  }

  const state = createDefaultGame(
    seats.map(({ _id: id, displayName, kind }) =>
      kind === "bot"
        ? { botDifficulty: room.botDifficulty, displayName, id, isBot: true as const }
        : { displayName, id, isBot: false as const },
    ),
    createPrivateGameSeed(),
    settings,
  );
  const now = Date.now();
  const game = {
    automationToken: 0,
    revision: state.actionNumber,
    roomId: room._id,
    stateJson: serializeGameState(state),
    status: "active" as const,
  };
  const gameId = await ctx.db.insert("games", game);
  const schedule = await scheduleNextAutomatedAction(ctx, { ...game, _id: gameId }, state, now);
  const humanCount = seats.filter((seat) => seat.kind === "human").length;
  const botCount = seats.length - humanCount;
  await Promise.all([
    ctx.db.patch("games", gameId, schedule),
    ctx.db.patch("rooms", room._id, { gameId, status: "active", updatedAt: now }),
    insertSystemEvent(
      ctx,
      { ...game, _id: gameId },
      {
        actorSeatId: hostSeatId,
        kind: "game_started",
        text: `Game started with ${countOf(humanCount, "human player")} and ${countOf(botCount, "bot")}.`,
      },
    ),
  ]);
}

/**
 * Closes a room that has no humans left: nobody can open it again, its game stops, and the
 * hourly purge deletes it together with everything that belongs to it.
 */
export async function closeRoom(ctx: WriteCtx, room: RoomDoc): Promise<void> {
  const game = room.gameId ? await ctx.db.get("games", room.gameId) : null;
  await Promise.all([
    ctx.db.patch("rooms", room._id, { status: "closed", updatedAt: Date.now() }),
    ...(game && game.status !== "finished"
      ? [
          ctx.db.patch("games", game._id, {
            nextActionAt: undefined,
            status: "finished",
            turnDeadlineAt: undefined,
          }),
        ]
      : []),
  ]);
}
