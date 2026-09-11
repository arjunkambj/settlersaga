import { describe, expect, test } from "bun:test";

import {
  DEFAULT_BASE_GAME_SETTINGS,
  applyCommand,
  chooseAutomatedCommand,
  createDefaultGame,
} from "@settersaga/game";
import type { GameState } from "@settersaga/game";

import {
  resumeAutomatedActionSchedule,
  scheduleNextAutomatedAction,
} from "../convex/model/gameState";
import {
  BOT_ACTION_DELAY_MS,
  isScheduledActionCurrentAndDue,
  logicalTurnId,
  nextScheduledActionAt,
  nextTurnDeadlineAt,
} from "../lib/game-scheduling";

const SETTINGS = { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 4 as const };
const THREE_PLAYER_SETTINGS = { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 3 as const };
const HUMAN_PLAYERS = ["a", "b", "c"].map((id) => ({
  displayName: id.toUpperCase(),
  id,
  isBot: false,
}));

function createHumanGame(): GameState {
  return createDefaultGame(HUMAN_PLAYERS, "scheduling-test", THREE_PLAYER_SETTINGS);
}

function applyAutomatedCommand(state: GameState): GameState {
  const command = chooseAutomatedCommand(state, state.activePlayerId);
  return applyCommand(state, state.activePlayerId, command);
}

describe("game scheduling", () => {
  test("every bot action receives a fresh delay", () => {
    const bot = { isBot: true, playerId: "bot" };
    const firstActionAt = nextScheduledActionAt(bot, SETTINGS, 10_000);
    const secondActionAt = nextScheduledActionAt(bot, SETTINGS, firstActionAt!);

    expect(firstActionAt).toBe(10_000 + BOT_ACTION_DELAY_MS);
    expect(secondActionAt).toBe(firstActionAt! + BOT_ACTION_DELAY_MS);
    expect(
      isScheduledActionCurrentAndDue({
        currentActionAt: firstActionAt,
        currentActionNumber: 4,
        expectedActionNumber: 4,
        now: firstActionAt!,
        scheduledFor: firstActionAt,
      }),
    ).toBe(true);
    expect(
      isScheduledActionCurrentAndDue({
        currentActionAt: secondActionAt,
        currentActionNumber: 5,
        expectedActionNumber: 4,
        now: secondActionAt!,
        scheduledFor: firstActionAt,
      }),
    ).toBe(false);
  });

  test("a required bot action does not outlive the active turn deadline", () => {
    const bot = { isBot: true, playerId: "bot" };

    expect(
      nextScheduledActionAt(bot, SETTINGS, 10_000, {
        turnDeadlineAt: 10_100,
      }),
    ).toBe(10_100);
    expect(
      nextScheduledActionAt(bot, SETTINGS, 10_000, {
        turnDeadlineAt: 20_000,
      }),
    ).toBe(10_000 + BOT_ACTION_DELAY_MS);
  });

  test("one human keeps one deadline only within the same logical turn", () => {
    const human = { isBot: false, playerId: "human" };
    const turnId = "turn:4:human";
    const deadline = nextTurnDeadlineAt(human, SETTINGS, 20_000, turnId);
    const preserved = nextTurnDeadlineAt(human, SETTINGS, 30_000, turnId, {
      actorPlayerId: human.playerId,
      deadlineAt: deadline!,
      turnId,
    });
    const nextTurnDeadline = nextTurnDeadlineAt(human, SETTINGS, 30_000, "turn:5:human", {
      actorPlayerId: human.playerId,
      deadlineAt: deadline!,
      turnId,
    });

    expect(preserved).toBe(deadline);
    expect(nextTurnDeadline).toBe(30_000 + SETTINGS.turnTimerSeconds * 1_000);
  });

  test("the snake pivot starts a new setup deadline for the same player", () => {
    let state = createHumanGame();
    for (let action = 0; action < 4; action += 1) {
      state = applyAutomatedCommand(state);
    }

    const firstSetupTurnId = logicalTurnId(state);
    const firstDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: state.activePlayerId },
      state.settings,
      10_000,
      firstSetupTurnId,
    );
    state = applyAutomatedCommand(applyAutomatedCommand(state));
    const secondSetupTurnId = logicalTurnId(state);
    const secondDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: state.activePlayerId },
      state.settings,
      20_000,
      secondSetupTurnId,
      {
        actorPlayerId: state.activePlayerId,
        deadlineAt: firstDeadline!,
        turnId: firstSetupTurnId,
      },
    );

    expect(firstSetupTurnId).toBe("setup:2");
    expect(secondSetupTurnId).toBe("setup:3");
    expect(secondDeadline).toBe(20_000 + state.settings.turnTimerSeconds * 1_000);
  });

  test("the first normal turn does not inherit the final setup deadline", () => {
    let state = createHumanGame();
    for (let action = 0; action < 10; action += 1) {
      state = applyAutomatedCommand(state);
    }

    const finalSetupTurnId = logicalTurnId(state);
    const setupDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: state.activePlayerId },
      state.settings,
      10_000,
      finalSetupTurnId,
    );
    state = applyAutomatedCommand(applyAutomatedCommand(state));
    const firstTurnId = logicalTurnId(state);
    const firstTurnDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: state.activePlayerId },
      state.settings,
      20_000,
      firstTurnId,
      {
        actorPlayerId: state.activePlayerId,
        deadlineAt: setupDeadline!,
        turnId: finalSetupTurnId,
      },
    );
    const afterRoll = applyAutomatedCommand(state);
    const afterRollDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: afterRoll.activePlayerId },
      afterRoll.settings,
      30_000,
      logicalTurnId(afterRoll),
      {
        actorPlayerId: state.activePlayerId,
        deadlineAt: firstTurnDeadline!,
        turnId: firstTurnId,
      },
    );

    expect(finalSetupTurnId).toBe("setup:5");
    expect(firstTurnId).toBe("turn:1:a");
    expect(firstTurnDeadline).toBe(20_000 + state.settings.turnTimerSeconds * 1_000);
    expect(afterRollDeadline).toBe(firstTurnDeadline);
  });

  test("the first committed action wins the deadline race", () => {
    const scheduledAction = {
      currentActionAt: 10_000,
      expectedActionNumber: 4,
      now: 10_000,
      scheduledFor: 10_000,
    };

    expect(isScheduledActionCurrentAndDue({ ...scheduledAction, currentActionNumber: 4 })).toBe(
      true,
    );
    expect(isScheduledActionCurrentAndDue({ ...scheduledAction, currentActionNumber: 5 })).toBe(
      false,
    );
  });

  test("one human timeout remains valid across commands in the same logical turn", () => {
    const scheduledAction = {
      currentActionAt: 10_000,
      currentActionNumber: 5,
      currentTurnId: "turn:2:human",
      expectedActionNumber: 4,
      expectedTurnId: "turn:2:human",
      now: 10_000,
      scheduledFor: 10_000,
    };

    expect(isScheduledActionCurrentAndDue(scheduledAction)).toBe(true);
    expect(
      isScheduledActionCurrentAndDue({
        ...scheduledAction,
        currentTurnId: "turn:3:human",
      }),
    ).toBe(false);
  });

  test("legacy, stale, and early scheduled jobs are distinguished", () => {
    expect(
      isScheduledActionCurrentAndDue({
        currentActionAt: 10_000,
        currentActionNumber: 4,
        expectedActionNumber: 4,
        now: 10_000,
        scheduledFor: undefined,
      }),
    ).toBe(true);
    expect(
      isScheduledActionCurrentAndDue({
        currentActionAt: 10_000,
        currentActionNumber: 4,
        expectedActionNumber: 4,
        now: 9_999,
        scheduledFor: undefined,
      }),
    ).toBe(false);
    expect(
      isScheduledActionCurrentAndDue({
        currentActionAt: 20_000,
        currentActionNumber: 4,
        expectedActionNumber: 4,
        now: 20_000,
        scheduledFor: 10_000,
      }),
    ).toBe(false);
    expect(
      isScheduledActionCurrentAndDue({
        currentActionAt: 20_000,
        currentActionNumber: 4,
        expectedActionNumber: 4,
        now: 19_999,
        scheduledFor: 20_000,
      }),
    ).toBe(false);
  });

  test("controller changes recompute turn ownership without duplicating an unchanged job", async () => {
    const initial = createHumanGame();
    const activePlayerId = initial.activePlayerId;
    const pendingPlayerId = initial.players[1]!.id;
    const previousState: GameState = {
      ...initial,
      phase: {
        kind: "discard",
        pending: [{ count: 1, playerId: pendingPlayerId }],
        rollerPlayerId: activePlayerId,
      },
      turnNumber: 1,
    };
    const nextState: GameState = {
      ...previousState,
      players: previousState.players.map((player) =>
        player.id === activePlayerId
          ? { ...player, botDifficulty: "medium" as const, isBot: true }
          : player,
      ),
    };
    const scheduledAt: number[] = [];
    const ctx = {
      scheduler: {
        runAt: async (timestamp: number) => {
          scheduledAt.push(timestamp);
        },
      },
    };

    const schedule = await scheduleNextAutomatedAction(
      ctx as never,
      "game" as never,
      nextState,
      nextState.settings,
      20_000,
      previousState,
      50_000,
      50_000,
    );

    expect(schedule).toEqual({ nextActionAt: 50_000, turnDeadlineAt: undefined });
    expect(scheduledAt).toEqual([]);
  });

  test("human commands in one turn do not schedule duplicate timeout jobs", async () => {
    const initial = createHumanGame();
    const previousState: GameState = {
      ...initial,
      actionNumber: 12,
      phase: { kind: "roll" },
      turnNumber: 2,
    };
    const nextState: GameState = {
      ...previousState,
      actionNumber: 13,
      phase: { kind: "build_and_trade" },
    };
    const scheduledAt: number[] = [];
    const ctx = {
      scheduler: {
        runAt: async (timestamp: number) => {
          scheduledAt.push(timestamp);
        },
      },
    };

    const schedule = await scheduleNextAutomatedAction(
      ctx as never,
      "game" as never,
      nextState,
      nextState.settings,
      20_000,
      previousState,
      50_000,
      50_000,
    );

    expect(schedule).toEqual({ nextActionAt: 50_000, turnDeadlineAt: 50_000 });
    expect(scheduledAt).toEqual([]);
  });

  test("resuming restores the remaining action and turn timer durations", async () => {
    const initial = createHumanGame();
    const state: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === initial.activePlayerId
          ? { ...player, botDifficulty: "medium" as const, isBot: true }
          : player,
      ),
    };
    const scheduledAt: number[] = [];
    const ctx = {
      scheduler: {
        runAt: async (timestamp: number) => {
          scheduledAt.push(timestamp);
        },
      },
    };

    const schedule = await resumeAutomatedActionSchedule(
      ctx as never,
      "game" as never,
      state,
      20_000,
      400,
      12_000,
    );

    expect(schedule).toEqual({ nextActionAt: 20_400, turnDeadlineAt: 32_000 });
    expect(scheduledAt).toEqual([20_400]);
  });
});
