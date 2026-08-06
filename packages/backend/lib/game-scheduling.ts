import type { BaseGameSettings, GameState } from "@settersaga/game";

export const BOT_ACTION_DELAY_MS = 950;

export interface AutomatedActor {
  isBot: boolean;
  playerId: string;
}

export interface PreviousHumanDeadline {
  actorPlayerId: string;
  deadlineAt: number;
  turnId: string;
}

export interface SchedulingContext {
  previousHumanDeadline?: PreviousHumanDeadline;
  turnDeadlineAt?: number;
  turnId?: string;
}

export function logicalTurnId(state: GameState): string {
  if (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
    return `setup:${state.phase.setupIndex}`;
  }
  return `turn:${state.turnNumber}:${state.activePlayerId}`;
}

export function nextTurnDeadlineAt(
  activePlayer: AutomatedActor | null,
  settings: BaseGameSettings,
  now: number,
  turnId: string,
  previous?: PreviousHumanDeadline,
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

export function isScheduledActionCurrentAndDue({
  currentActionAt,
  currentActionNumber,
  currentTurnId,
  expectedActionNumber,
  expectedTurnId,
  now,
  scheduledFor,
}: {
  currentActionAt: number | undefined;
  currentActionNumber: number;
  currentTurnId?: string;
  expectedActionNumber: number;
  expectedTurnId?: string;
  now: number;
  scheduledFor: number | undefined;
}): boolean {
  if (
    expectedTurnId === undefined
      ? currentActionNumber !== expectedActionNumber
      : currentTurnId !== expectedTurnId
  ) {
    return false;
  }
  const expectedActionAt = scheduledFor ?? currentActionAt;
  return (
    expectedActionAt !== undefined &&
    currentActionAt === expectedActionAt &&
    now >= expectedActionAt
  );
}
