import {
  DEFAULT_BASE_GAME_SETTINGS,
  GAME_MAP_IDS,
  assertGameState,
  createBoard,
  createDefaultGame,
  getRequiredPlayerIds,
  toPlayerView,
} from "@settersaga/game";
import type {
  BaseGameSettings,
  BotDifficulty,
  GameCommand,
  GamePlayerInput,
  GameState,
} from "@settersaga/game";

import {
  logicalTurnId,
  nextScheduledActionAt,
  nextTurnDeadlineAt,
} from "../../lib/game-scheduling";
import { internal } from "../_generated/api";
import type { HexclaveUser } from "../hexclave/auth";
import { commandEventKind, serializeCommand } from "./commands";
import { createBotDisplayName } from "../../lib/bot-names";
import { DEFAULT_BOT_DIFFICULTY } from "./constants";
import { fail } from "./errors";
import {
  createPrivateGameSeed,
  normalizeDisplayName,
  validateBotCount,
  validateGameSettings,
} from "./normalize";
import { allocateRoomCode, listSeats, nextOpenSeatIndex } from "./roomQueries";
import type { GameDoc, GameId, RoomDoc, RoomRecord, SeatDoc, SeatRecord, WriteCtx } from "./types";

const GAME_STATE_STORAGE_FORMAT = 1;

function restoreStoredGameState(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const stored = value as Record<string, unknown>;
  if (stored.storageFormat !== GAME_STATE_STORAGE_FORMAT) {
    return value;
  }
  if (typeof stored.state !== "object" || stored.state === null || Array.isArray(stored.state)) {
    return stored.state;
  }

  const state = stored.state as Record<string, unknown>;
  const board =
    typeof state.board === "object" && state.board !== null && !Array.isArray(state.board)
      ? (state.board as Record<string, unknown>)
      : null;
  const settings =
    typeof state.settings === "object" && state.settings !== null && !Array.isArray(state.settings)
      ? (state.settings as Record<string, unknown>)
      : null;
  const map = GAME_MAP_IDS.find((candidate) => candidate === settings?.map);
  if (!board || !map || typeof state.seed !== "string") {
    return state;
  }

  const staticBoard = createBoard(map, state.seed);
  return {
    ...state,
    board: {
      ...staticBoard,
      buildings: board.buildings,
      roads: board.roads,
      robberTileId: board.robberTileId,
    },
  };
}

export function parseGameState(stateJson: string): GameState {
  let state: unknown;
  try {
    state = JSON.parse(stateJson);
  } catch {
    fail("CORRUPT_GAME_STATE", "Stored game state is not valid JSON.");
  }

  try {
    state = restoreStoredGameState(state);
    assertGameState(state);
  } catch {
    fail("CORRUPT_GAME_STATE", "Stored game state has an invalid shape.");
  }
  return state;
}

export function serializeGameState(state: GameState): string {
  try {
    assertGameState(state);
  } catch {
    fail("CORRUPT_GAME_STATE", "Game state failed integrity validation before persistence.");
  }
  return JSON.stringify({
    storageFormat: GAME_STATE_STORAGE_FORMAT,
    state: {
      ...state,
      board: {
        buildings: state.board.buildings,
        roads: state.board.roads,
        robberTileId: state.board.robberTileId,
      },
    },
  });
}

export function gameStatus(state: GameState): "active" | "finished" {
  return state.status === "completed" ? "finished" : "active";
}

export function roomViewStatus(status: RoomDoc["status"]): "completed" | "in_progress" | "waiting" {
  if (status === "active") return "in_progress";
  if (status === "finished") return "completed";
  return "waiting";
}

export function requiredAutomatedActor(state: GameState) {
  if (state.status === "completed") return null;
  const requiredPlayerIds = getRequiredPlayerIds(state);
  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const playerId =
    requiredPlayerIds.find((requiredPlayerId) => playersById.get(requiredPlayerId)?.isBot) ??
    requiredPlayerIds[0];
  const player = playerId ? playersById.get(playerId) : undefined;
  return player ? { isBot: player.isBot, playerId: player.id } : null;
}

function activeTurnOwner(state: GameState) {
  if (state.status === "completed") return null;
  const player = state.players.find((candidate) => candidate.id === state.activePlayerId);
  return player ? { isBot: player.isBot, playerId: player.id } : null;
}

export async function scheduleNextAutomatedAction(
  ctx: WriteCtx,
  gameId: GameId,
  state: GameState,
  settings: BaseGameSettings,
  now: number,
  previousState?: GameState,
  previousActionAt?: number,
  previousTurnDeadlineAt?: number,
): Promise<{ nextActionAt?: number; turnDeadlineAt?: number }> {
  const actor = requiredAutomatedActor(state);
  const activePlayer = activeTurnOwner(state);
  const turnId = logicalTurnId(state);
  const previousActor = previousState ? requiredAutomatedActor(previousState) : null;
  const previousTurnId = previousState ? logicalTurnId(previousState) : undefined;
  const previousHumanDeadline =
    previousActor &&
    !previousActor.isBot &&
    previousActionAt !== undefined &&
    previousTurnId !== undefined
      ? {
          actorPlayerId: previousActor.playerId,
          deadlineAt: previousActionAt,
          turnId: previousTurnId,
        }
      : undefined;
  const previousTurnDeadline =
    previousState && previousTurnDeadlineAt !== undefined && previousTurnId !== undefined
      ? {
          actorPlayerId: previousState.activePlayerId,
          deadlineAt: previousTurnDeadlineAt,
          turnId: previousTurnId,
        }
      : undefined;
  const turnDeadlineAt = nextTurnDeadlineAt(
    activePlayer,
    settings,
    now,
    turnId,
    previousTurnDeadline,
  );
  const nextActionAt = nextScheduledActionAt(actor, settings, now, {
    previousHumanDeadline,
    turnDeadlineAt,
    turnId,
  });
  const existingScheduleStillApplies =
    previousActor?.playerId === actor?.playerId &&
    previousActionAt === nextActionAt &&
    (previousState?.actionNumber === state.actionNumber ||
      (actor?.isBot === false && previousTurnId === turnId));
  if (nextActionAt !== undefined && actor && !existingScheduleStillApplies) {
    await ctx.scheduler.runAt(nextActionAt, internal.automation.runAutomatedAction, {
      expectedActionNumber: state.actionNumber,
      expectedActorPlayerId: actor.playerId,
      ...(actor.isBot ? {} : { expectedTurnId: turnId }),
      gameId,
      scheduledFor: nextActionAt,
    });
  }
  return { nextActionAt, turnDeadlineAt };
}

export async function resumeAutomatedActionSchedule(
  ctx: WriteCtx,
  gameId: GameId,
  state: GameState,
  now: number,
  nextActionRemainingMs?: number,
  turnDeadlineRemainingMs?: number,
): Promise<{ nextActionAt?: number; turnDeadlineAt?: number }> {
  const actor = requiredAutomatedActor(state);
  const nextActionAt =
    actor && nextActionRemainingMs !== undefined
      ? now + Math.max(0, nextActionRemainingMs)
      : undefined;
  const turnDeadlineAt =
    turnDeadlineRemainingMs === undefined ? undefined : now + Math.max(0, turnDeadlineRemainingMs);

  if (actor && nextActionAt !== undefined) {
    await ctx.scheduler.runAt(nextActionAt, internal.automation.runAutomatedAction, {
      expectedActionNumber: state.actionNumber,
      expectedActorPlayerId: actor.playerId,
      ...(actor.isBot ? {} : { expectedTurnId: logicalTurnId(state) }),
      gameId,
      scheduledFor: nextActionAt,
    });
  }

  return { nextActionAt, turnDeadlineAt };
}

export function playerViewJson(state: GameState, seat: SeatDoc): string {
  const playerId = String(seat._id);
  if (!state.players.some((player) => player.id === playerId)) {
    fail("CORRUPT_GAME_STATE", "Room seat is missing from the game state.");
  }
  return JSON.stringify(toPlayerView(state, playerId));
}

export async function persistAppliedCommand(
  ctx: WriteCtx,
  game: GameDoc,
  state: GameState,
  nextState: GameState,
  actorSeat: SeatDoc,
  command: GameCommand,
  clientActionId: string,
  text: string,
): Promise<void> {
  if (nextState.actionNumber !== state.actionNumber + 1) {
    fail("CORRUPT_GAME_STATE", "An accepted command must advance exactly one action.");
  }

  const now = Date.now();
  const settings = validateGameSettings(game.settings);
  const schedule = await scheduleNextAutomatedAction(
    ctx,
    game._id,
    nextState,
    settings,
    now,
    state,
    game.nextActionAt,
    game.turnDeadlineAt,
  );
  await Promise.all([
    ctx.db.patch("games", game._id, {
      ...schedule,
      revision: nextState.actionNumber,
      stateJson: serializeGameState(nextState),
      status: gameStatus(nextState),
      updatedAt: now,
    }),
    ctx.db.insert("gameActions", {
      actorSeatId: actorSeat._id,
      afterRevision: nextState.actionNumber,
      beforeRevision: state.actionNumber,
      clientActionId,
      commandJson: serializeCommand(command),
      createdAt: now,
      eventKind: commandEventKind(command, state, nextState),
      gameId: game._id,
      text,
    }),
    ...(nextState.status === "completed"
      ? [
          ctx.db.patch("rooms", game.roomId, {
            status: "finished",
            updatedAt: now,
          }),
        ]
      : []),
  ]);
}

export async function setWaitingBotCount(
  ctx: WriteCtx,
  room: RoomRecord,
  botCount: number,
  seatsInput?: readonly SeatRecord[],
): Promise<SeatRecord[]> {
  const maxPlayers = room.settings.maxPlayers;
  validateBotCount(botCount, maxPlayers);
  const seats = seatsInput ? [...seatsInput] : await listSeats(ctx, room._id);
  const humanCount = seats.filter((seat) => seat.kind === "human").length;
  if (humanCount + botCount > maxPlayers) {
    fail(
      "ROOM_FULL",
      `${humanCount} human player${humanCount === 1 ? "" : "s"} leave room for at most ${maxPlayers - humanCount} bots.`,
    );
  }

  const bots = seats
    .filter((seat) => seat.kind === "bot")
    .sort((left, right) => right.seatIndex - left.seatIndex);
  const botsToRemove = bots.slice(0, Math.max(0, bots.length - botCount));
  await Promise.all(botsToRemove.map((seat) => ctx.db.delete("seats", seat._id)));

  const remainingSeats = seats.filter(
    (seat) => !botsToRemove.some((removed) => removed._id === seat._id),
  );
  for (let index = bots.length - botsToRemove.length; index < botCount; index += 1) {
    const seatIndex = nextOpenSeatIndex(remainingSeats, maxPlayers);
    const displayName = createBotDisplayName(room._id, seatIndex, remainingSeats);
    const joinedAt = Date.now();
    const seatId = await ctx.db.insert("seats", {
      displayName,
      joinedAt,
      kind: "bot",
      roomId: room._id,
      seatIndex,
    });
    remainingSeats.push({
      _id: seatId,
      displayName,
      joinedAt,
      kind: "bot",
      roomId: room._id,
      seatIndex,
    });
  }
  return remainingSeats;
}

export async function fitWaitingSeatsToSettings(
  ctx: WriteCtx,
  room: RoomRecord,
  settings: BaseGameSettings,
  seatsInput?: readonly SeatRecord[],
): Promise<SeatRecord[]> {
  const seats = seatsInput ? [...seatsInput] : await listSeats(ctx, room._id);
  const humans = seats.filter((seat) => seat.kind === "human");
  if (humans.length > settings.maxPlayers) {
    fail("TOO_MANY_PLAYERS", "The room has more human players than the selected player count.");
  }

  const botCapacity = settings.maxPlayers - humans.length;
  const bots = seats
    .filter((seat) => seat.kind === "bot")
    .sort((left, right) => left.seatIndex - right.seatIndex);
  await Promise.all(bots.slice(botCapacity).map((seat) => ctx.db.delete("seats", seat._id)));

  const keptSeats = [...humans, ...bots.slice(0, botCapacity)].sort((left, right) => {
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
  return keptSeats.map((seat, seatIndex) =>
    seat.seatIndex === seatIndex ? seat : { ...seat, seatIndex },
  );
}

export async function createRoomRecord(
  ctx: WriteCtx,
  user: HexclaveUser,
  rawDisplayName: string,
  settings: BaseGameSettings = DEFAULT_BASE_GAME_SETTINGS,
  botDifficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
): Promise<{ code: string; room: RoomRecord; seat: SeatRecord }> {
  const displayName = normalizeDisplayName(rawDisplayName);
  const now = Date.now();
  const code = await allocateRoomCode(ctx, user.id, now);
  const validatedSettings = validateGameSettings(settings);
  const roomId = await ctx.db.insert("rooms", {
    botDifficulty,
    code,
    createdAt: now,
    settings: validatedSettings,
    status: "waiting",
    updatedAt: now,
  });
  const seatId = await ctx.db.insert("seats", {
    authUserId: user.id,
    displayName,
    joinedAt: now,
    kind: "human",
    roomId,
    seatIndex: 0,
  });
  await ctx.db.patch("rooms", roomId, { hostSeatId: seatId });

  return {
    code,
    room: {
      _id: roomId,
      botDifficulty,
      code,
      createdAt: now,
      hostSeatId: seatId,
      settings: validatedSettings,
      status: "waiting",
      updatedAt: now,
    },
    seat: {
      _id: seatId,
      authUserId: user.id,
      displayName,
      joinedAt: now,
      kind: "human",
      roomId,
      seatIndex: 0,
    },
  };
}

export async function startRoomGame(
  ctx: WriteCtx,
  room: RoomRecord,
  seatsInput?: readonly SeatRecord[],
): Promise<void> {
  if (room.gameId) {
    const existingGame = await ctx.db.get("games", room.gameId);
    if (existingGame) return;
  }
  if (room.status === "finished") fail("GAME_ALREADY_FINISHED", "Game has already finished.");
  if (room.status !== "waiting") fail("ROOM_STARTED", "Room is no longer waiting.");
  if (!room.hostSeatId) fail("NOT_HOST", "Room does not have a host seat.");

  const now = Date.now();
  const settings = validateGameSettings(room.settings);
  const seats = seatsInput ? [...seatsInput] : await listSeats(ctx, room._id);
  if (
    seats.length !== settings.maxPlayers ||
    seats.some((seat, index) => seat.seatIndex !== index)
  ) {
    fail(
      "ROOM_NOT_READY",
      `A ${settings.maxPlayers}-player game requires exactly ${settings.maxPlayers} configured seats.`,
    );
  }

  const players: GamePlayerInput[] = seats.map((seat) => ({
    botDifficulty: seat.kind === "bot" ? room.botDifficulty : undefined,
    displayName: seat.displayName,
    id: String(seat._id),
    isBot: seat.kind === "bot",
  }));
  const state = createDefaultGame(players, createPrivateGameSeed(), settings);
  const gameId = await ctx.db.insert("games", {
    botDifficulty: room.botDifficulty,
    createdAt: now,
    revision: state.actionNumber,
    roomId: room._id,
    settings,
    stateJson: serializeGameState(state),
    status: gameStatus(state),
    updatedAt: now,
  });
  const schedule = await scheduleNextAutomatedAction(ctx, gameId, state, settings, now);
  const humanCount = seats.filter((seat) => seat.kind === "human").length;
  const botCount = seats.length - humanCount;
  await Promise.all([
    ...(schedule.nextActionAt === undefined && schedule.turnDeadlineAt === undefined
      ? []
      : [ctx.db.patch("games", gameId, schedule)]),
    ctx.db.patch("rooms", room._id, {
      gameId,
      status: gameStatus(state),
      updatedAt: now,
    }),
    ctx.db.insert("gameActions", {
      actorSeatId: room.hostSeatId,
      afterRevision: state.actionNumber,
      beforeRevision: state.actionNumber,
      clientActionId: "system:game-started",
      commandJson: JSON.stringify({ kind: "game_started" }),
      createdAt: now,
      gameId,
      text: `Game started with ${humanCount} human player${humanCount === 1 ? "" : "s"} and ${botCount} bot${botCount === 1 ? "" : "s"}.`,
    }),
  ]);
}

export function transferPlayerToBot(
  state: GameState,
  seat: SeatDoc,
  botDifficulty: BotDifficulty,
  displayName: string,
): GameState {
  const playerId = String(seat._id);
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    fail("CORRUPT_GAME_STATE", "Room seat is missing from the game state.");
  }
  if (player.isBot) {
    fail("TARGET_NOT_HUMAN", "Target seat is already controlled by a bot.");
  }

  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? { ...candidate, botDifficulty, displayName, isBot: true }
        : candidate,
    ),
  };
}

export async function convertGameSeatToBot(
  ctx: WriteCtx,
  room: RoomDoc,
  seat: SeatDoc,
  eventText: string,
  seatsInput?: readonly SeatRecord[],
): Promise<void> {
  if (seat.kind !== "human") {
    fail("TARGET_NOT_HUMAN", "Target seat is not controlled by a human player.");
  }
  if (!room.gameId) {
    fail("CORRUPT_GAME_STATE", "Active room does not have a game.");
  }

  const game = await ctx.db.get("games", room.gameId);
  if (!game) {
    fail("CORRUPT_GAME_STATE", "Room points to a missing game.");
  }
  const settings = validateGameSettings(game.settings);
  const state = parseGameState(game.stateJson);
  if (game.revision !== state.actionNumber) {
    fail("CORRUPT_GAME_STATE", "Stored game revision does not match its state.");
  }

  const seats = seatsInput ?? (await listSeats(ctx, room._id));
  const displayName = createBotDisplayName(room._id, seat.seatIndex, seats);
  const nextState = transferPlayerToBot(state, seat, room.botDifficulty, displayName);
  const now = Date.now();
  const schedule =
    game.status === "paused"
      ? { nextActionAt: undefined, turnDeadlineAt: undefined }
      : await scheduleNextAutomatedAction(
          ctx,
          game._id,
          nextState,
          settings,
          now,
          state,
          game.nextActionAt,
          game.turnDeadlineAt,
        );
  await Promise.all([
    ctx.db.patch("seats", seat._id, {
      authUserId: undefined,
      displayName,
      kind: "bot",
    }),
    ctx.db.patch("games", game._id, {
      ...schedule,
      revision: nextState.actionNumber,
      stateJson: serializeGameState(nextState),
      status: game.status === "paused" ? "paused" : gameStatus(nextState),
      updatedAt: now,
    }),
    ctx.db.insert("gameActions", {
      actorSeatId: seat._id,
      afterRevision: nextState.actionNumber,
      beforeRevision: state.actionNumber,
      clientActionId: `system:bot-control:${String(seat._id)}`,
      commandJson: JSON.stringify({ kind: "bot_control_started" }),
      createdAt: now,
      gameId: game._id,
      text: eventText,
    }),
  ]);
}
