import type { GameCommand, GameState } from "@settersaga/game";

import type { Id } from "../_generated/dataModel";
import { commandEventKind, serializeCommand } from "./commands";
import { fail } from "./errors";
import { scheduleNextAutomatedAction } from "./scheduling";
import { serializeGameState } from "./storage";
import type { GameDoc, ReadCtx, RoomDoc, WriteCtx } from "./types";
import type { SystemEventKind } from "./validators";

interface SystemEvent {
  actorSeatId: Id<"seats">;
  kind: SystemEventKind;
  text: string;
}

function gameStatus(state: GameState): "active" | "finished" {
  return state.phase.kind === "finished" ? "finished" : "active";
}

export async function requireRoomGame(ctx: ReadCtx, room: RoomDoc): Promise<GameDoc> {
  const game = room.gameId ? await ctx.db.get("games", room.gameId) : null;
  if (!game) fail("GAME_NOT_STARTED", "Game has not started.");
  return game;
}

export async function insertSystemEvent(
  ctx: WriteCtx,
  game: Pick<GameDoc, "_id" | "revision">,
  { actorSeatId, kind, text }: SystemEvent,
): Promise<void> {
  await ctx.db.insert("gameActions", {
    actorSeatId,
    afterRevision: game.revision,
    eventKind: kind,
    gameId: game._id,
    text,
  });
}

/** Stops both clocks and keeps the time that was left on each for resumeGame. */
export async function pauseGameRecord(
  ctx: WriteCtx,
  game: GameDoc,
  event: Omit<SystemEvent, "kind">,
): Promise<void> {
  const now = Date.now();
  const remainingMs = (at: number | undefined) =>
    at === undefined ? undefined : Math.max(0, at - now);
  await Promise.all([
    ctx.db.patch("games", game._id, {
      nextActionAt: undefined,
      pausedNextActionRemainingMs: remainingMs(game.nextActionAt),
      pausedTurnDeadlineRemainingMs: remainingMs(game.turnDeadlineAt),
      status: "paused",
      turnDeadlineAt: undefined,
    }),
    insertSystemEvent(ctx, game, { ...event, kind: "game_paused" }),
  ]);
}

export async function persistAppliedCommand(
  ctx: WriteCtx,
  {
    actorSeatId,
    clientActionId,
    command,
    game,
    jobConsumed,
    nextState,
    state,
    text,
  }: {
    actorSeatId: Id<"seats">;
    clientActionId?: string;
    command: GameCommand;
    game: GameDoc;
    jobConsumed: boolean;
    nextState: GameState;
    state: GameState;
    text: string;
  },
): Promise<void> {
  const now = Date.now();
  const schedule = await scheduleNextAutomatedAction(ctx, game, nextState, now, {
    jobConsumed,
    nextActionAt: game.nextActionAt,
    state,
    turnDeadlineAt: game.turnDeadlineAt,
  });
  await Promise.all([
    ctx.db.patch("games", game._id, {
      ...schedule,
      revision: nextState.actionNumber,
      stateJson: serializeGameState(nextState),
      status: gameStatus(nextState),
    }),
    ctx.db.insert("gameActions", {
      actorSeatId,
      afterRevision: nextState.actionNumber,
      clientActionId,
      commandJson: serializeCommand(command),
      eventKind: commandEventKind(command, actorSeatId, state, nextState),
      gameId: game._id,
      text,
    }),
    ...(nextState.phase.kind === "finished"
      ? [ctx.db.patch("rooms", game.roomId, { status: "finished", updatedAt: now })]
      : []),
  ]);
}
