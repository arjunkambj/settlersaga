import { getRequiredPlayerIds } from "@settersaga/game";
import type { BaseGameSettings, GameState } from "@settersaga/game";

import { internal } from "../_generated/api";
import type { GameDoc, WriteCtx } from "./types";

export const BOT_ACTION_DELAY_MS = 950;

export interface AutomatedActor {
  isBot: boolean;
  playerId: string;
}

interface HumanDeadline {
  actorPlayerId: string;
  deadlineAt: number;
  turnId: string;
}

interface SchedulingContext {
  previousHumanDeadline?: HumanDeadline;
  turnDeadlineAt?: number;
  turnId?: string;
}

interface ScheduleTimes {
  nextActionAt?: number;
  turnDeadlineAt?: number;
}

interface GameSchedule extends ScheduleTimes {
  automationToken: number;
}

interface PreviousSchedule extends ScheduleTimes {
  state: GameState;
  /** The pending automation job has just run, so it cannot cover the next deadline. */
  jobConsumed: boolean;
}

type AutomationGame = Pick<GameDoc, "_id" | "automationToken">;
type PausedClocks = Pick<GameDoc, "pausedNextActionRemainingMs" | "pausedTurnDeadlineRemainingMs">;

export function logicalTurnId(state: GameState): string {
  if (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
    return `setup:${state.phase.setupIndex}`;
  }
  return `turn:${state.turnNumber}:${state.activePlayerId}`;
}

/** The player the table is waiting on; a waiting bot goes first so it never blocks a human. */
export function requiredAutomatedActor(state: GameState): AutomatedActor | null {
  const requiredPlayerIds = getRequiredPlayerIds(state);
  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const playerId =
    requiredPlayerIds.find((requiredPlayerId) => playersById.get(requiredPlayerId)?.isBot) ??
    requiredPlayerIds[0];
  const player = playerId ? playersById.get(playerId) : undefined;
  return player ? { isBot: player.isBot, playerId: player.id } : null;
}

function activeTurnOwner(state: GameState): AutomatedActor | null {
  if (state.phase.kind === "finished") return null;
  const player = state.players.find((candidate) => candidate.id === state.activePlayerId);
  return player ? { isBot: player.isBot, playerId: player.id } : null;
}

export function nextTurnDeadlineAt(
  activePlayer: AutomatedActor | null,
  settings: BaseGameSettings,
  now: number,
  turnId: string,
  previous?: HumanDeadline,
): number | undefined {
  if (!activePlayer || activePlayer.isBot || settings.turnTimerSeconds === 0) {
    return undefined;
  }
  return previous?.actorPlayerId === activePlayer.playerId && previous.turnId === turnId
    ? previous.deadlineAt
    : now + settings.turnTimerSeconds * 1_000;
}

export function nextScheduledActionAt(
  actor: AutomatedActor | null,
  settings: BaseGameSettings,
  now: number,
  context: SchedulingContext = {},
): number | undefined {
  if (!actor) {
    return undefined;
  }
  if (actor.isBot) {
    const delayedActionAt = now + BOT_ACTION_DELAY_MS;
    return context.turnDeadlineAt === undefined
      ? delayedActionAt
      : Math.min(delayedActionAt, context.turnDeadlineAt);
  }
  if (settings.turnTimerSeconds === 0) {
    return undefined;
  }
  if (context.turnDeadlineAt !== undefined) {
    return context.turnDeadlineAt;
  }
  return context.previousHumanDeadline?.actorPlayerId === actor.playerId &&
    context.previousHumanDeadline.turnId === context.turnId
    ? context.previousHumanDeadline.deadlineAt
    : now + settings.turnTimerSeconds * 1_000;
}

/**
 * Works out the deadlines after `state` was reached from `previous`, and whether the job that was
 * already pending still fires at the right time for the right player.
 */
export function planNextSchedule(
  state: GameState,
  now: number,
  previous?: PreviousSchedule,
): ScheduleTimes & { keepsPendingJob: boolean } {
  const actor = requiredAutomatedActor(state);
  const turnId = logicalTurnId(state);
  const before = previous && {
    ...previous,
    actor: requiredAutomatedActor(previous.state),
    turnId: logicalTurnId(previous.state),
  };
  const turnDeadlineAt = nextTurnDeadlineAt(
    activeTurnOwner(state),
    state.settings,
    now,
    turnId,
    before?.turnDeadlineAt === undefined
      ? undefined
      : {
          actorPlayerId: before.state.activePlayerId,
          deadlineAt: before.turnDeadlineAt,
          turnId: before.turnId,
        },
  );
  const nextActionAt = nextScheduledActionAt(actor, state.settings, now, {
    previousHumanDeadline:
      before?.actor && !before.actor.isBot && before.nextActionAt !== undefined
        ? {
            actorPlayerId: before.actor.playerId,
            deadlineAt: before.nextActionAt,
            turnId: before.turnId,
          }
        : undefined,
    turnDeadlineAt,
    turnId,
  });
  const keepsPendingJob =
    before !== undefined &&
    !before.jobConsumed &&
    before.nextActionAt === nextActionAt &&
    before.actor?.playerId === actor?.playerId &&
    (before.state.actionNumber === state.actionNumber ||
      (actor?.isBot === false && before.turnId === turnId));
  return { keepsPendingJob, nextActionAt, turnDeadlineAt };
}

/**
 * The time each clock will have once a paused game resumes. The saved times belong to whoever held
 * the seats at the pause, so a seat handed to a bot since then keeps no turn clock and its bot gets
 * a fresh delay.
 */
export function resumedRemainingMs(
  game: PausedClocks,
  state: GameState,
): { nextActionMs?: number; turnDeadlineMs?: number } {
  const activePlayer = activeTurnOwner(state);
  const turnDeadlineMs =
    activePlayer && !activePlayer.isBot ? game.pausedTurnDeadlineRemainingMs : undefined;
  const nextActionMs = requiredAutomatedActor(state)?.isBot
    ? Math.min(BOT_ACTION_DELAY_MS, turnDeadlineMs ?? BOT_ACTION_DELAY_MS)
    : game.pausedNextActionRemainingMs;
  return { nextActionMs, turnDeadlineMs };
}

/** Deadlines after a pause, rebuilt from the time that was left on each clock. */
export function resumedScheduleTimes(
  game: PausedClocks,
  state: GameState,
  now: number,
): ScheduleTimes {
  const { nextActionMs, turnDeadlineMs } = resumedRemainingMs(game, state);
  const fromNow = (remainingMs: number | undefined) =>
    remainingMs === undefined ? undefined : now + remainingMs;
  return { nextActionAt: fromNow(nextActionMs), turnDeadlineAt: fromNow(turnDeadlineMs) };
}

async function replaceAutomationJob(
  ctx: WriteCtx,
  game: AutomationGame,
  times: ScheduleTimes,
): Promise<GameSchedule> {
  // The new token retires every job scheduled before it, so only one job can act per deadline.
  const automationToken = game.automationToken + 1;
  if (times.nextActionAt !== undefined) {
    await ctx.scheduler.runAt(times.nextActionAt, internal.automation.runAutomatedAction, {
      automationToken,
      gameId: game._id,
    });
  }
  return { ...times, automationToken };
}

export async function scheduleNextAutomatedAction(
  ctx: WriteCtx,
  game: AutomationGame,
  state: GameState,
  now: number,
  previous?: PreviousSchedule,
): Promise<GameSchedule> {
  const { keepsPendingJob, ...times } = planNextSchedule(state, now, previous);
  return keepsPendingJob
    ? { ...times, automationToken: game.automationToken }
    : await replaceAutomationJob(ctx, game, times);
}

export async function resumeAutomatedActionSchedule(
  ctx: WriteCtx,
  game: AutomationGame & PausedClocks,
  state: GameState,
  now: number,
): Promise<GameSchedule> {
  return await replaceAutomationJob(ctx, game, resumedScheduleTimes(game, state, now));
}
