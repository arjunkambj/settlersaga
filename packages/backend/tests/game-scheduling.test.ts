import { describe, expect, test } from "bun:test";

import {
  DEFAULT_BASE_GAME_SETTINGS,
  applyCommand,
  chooseAutomatedCommand,
  createDefaultGame,
} from "@settersaga/game";
import type { GameState } from "@settersaga/game";

import {
  BOT_ACTION_DELAY_MS,
  logicalTurnId,
  nextScheduledActionAt,
  nextTurnDeadlineAt,
  planNextSchedule,
  resumedRemainingMs,
  resumedScheduleTimes,
  scheduleNextAutomatedAction,
} from "../convex/model/scheduling";

const SETTINGS = { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 4 as const };
const THREE_PLAYER_SETTINGS = { ...DEFAULT_BASE_GAME_SETTINGS, maxPlayers: 3 as const };
const HUMAN_PLAYERS = ["a", "b", "c"].map((id) => ({
  displayName: id.toUpperCase(),
  id,
  isBot: false as const,
}));

function createHumanGame(settings = THREE_PLAYER_SETTINGS): GameState {
  return createDefaultGame(HUMAN_PLAYERS, "scheduling-test", settings);
}

/** A seated player other than the one whose turn it is; the engine draws the turn order. */
function waitingPlayerId(state: GameState): string {
  const player = state.players.find((candidate) => candidate.id !== state.activePlayerId);
  if (!player) throw new Error("Test game needs a second player");
  return player.id;
}

function applyAutomatedCommand(state: GameState): GameState {
  const command = chooseAutomatedCommand(state, state.activePlayerId);
  return applyCommand(state, state.activePlayerId, command);
}

function handToBot(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, botDifficulty: "medium" as const, isBot: true as const }
        : player,
    ),
  };
}

function createSchedulerSpy() {
  const jobs: { args: unknown; at: number }[] = [];
  const ctx = {
    scheduler: {
      runAt: async (at: number, _reference: unknown, args: unknown) => {
        jobs.push({ args, at });
      },
    },
  };
  return { ctx: ctx as never, jobs };
}

describe("game scheduling", () => {
  test("every bot action receives a fresh delay", () => {
    const bot = { isBot: true, playerId: "bot" };

    expect(nextScheduledActionAt(bot, SETTINGS, 10_000)).toBe(10_000 + BOT_ACTION_DELAY_MS);
    expect(nextScheduledActionAt(bot, SETTINGS, 20_000)).toBe(20_000 + BOT_ACTION_DELAY_MS);
  });

  test("a required bot action does not outlive the active turn deadline", () => {
    const bot = { isBot: true, playerId: "bot" };

    expect(nextScheduledActionAt(bot, SETTINGS, 10_000, { turnDeadlineAt: 10_100 })).toBe(10_100);
    expect(nextScheduledActionAt(bot, SETTINGS, 10_000, { turnDeadlineAt: 20_000 })).toBe(
      10_000 + BOT_ACTION_DELAY_MS,
    );
  });

  test("one human keeps one deadline only within the same logical turn", () => {
    const human = { isBot: false, playerId: "human" };
    const turnId = "turn:4:human";
    const previous = { actorPlayerId: human.playerId, deadlineAt: 80_000, turnId };

    expect(nextTurnDeadlineAt(human, SETTINGS, 30_000, turnId, previous)).toBe(80_000);
    expect(nextTurnDeadlineAt(human, SETTINGS, 30_000, "turn:5:human", previous)).toBe(
      30_000 + SETTINGS.turnTimerSeconds * 1_000,
    );
  });

  test("the snake pivot starts a new setup deadline for the same player", () => {
    let state = createHumanGame();
    for (let action = 0; action < 4; action += 1) {
      state = applyAutomatedCommand(state);
    }
    const firstSetup = { actorPlayerId: state.activePlayerId, turnId: logicalTurnId(state) };

    state = applyAutomatedCommand(applyAutomatedCommand(state));
    const secondDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: state.activePlayerId },
      state.settings,
      20_000,
      logicalTurnId(state),
      { ...firstSetup, deadlineAt: 70_000 },
    );

    expect(firstSetup.turnId).toBe("setup:2");
    expect(logicalTurnId(state)).toBe("setup:3");
    expect(secondDeadline).toBe(20_000 + state.settings.turnTimerSeconds * 1_000);
  });

  test("the first normal turn does not inherit the final setup deadline", () => {
    let state = createHumanGame();
    for (let action = 0; action < 10; action += 1) {
      state = applyAutomatedCommand(state);
    }
    const finalSetupTurnId = logicalTurnId(state);

    state = applyAutomatedCommand(applyAutomatedCommand(state));
    const firstTurnDeadline = nextTurnDeadlineAt(
      { isBot: false, playerId: state.activePlayerId },
      state.settings,
      20_000,
      logicalTurnId(state),
      { actorPlayerId: state.activePlayerId, deadlineAt: 70_000, turnId: finalSetupTurnId },
    );

    expect(finalSetupTurnId).toBe("setup:5");
    expect(logicalTurnId(state)).toBe(`turn:1:${state.activePlayerId}`);
    expect(firstTurnDeadline).toBe(20_000 + state.settings.turnTimerSeconds * 1_000);
  });

  test("a human's pending timeout still covers their later commands in the same turn", () => {
    const rolling: GameState = { ...createHumanGame(), phase: { kind: "roll" }, turnNumber: 2 };
    const building: GameState = {
      ...rolling,
      actionNumber: rolling.actionNumber + 1,
      phase: { kind: "build_and_trade" },
    };

    expect(
      planNextSchedule(building, 20_000, {
        jobConsumed: false,
        nextActionAt: 50_000,
        state: rolling,
        turnDeadlineAt: 50_000,
      }),
    ).toEqual({ keepsPendingJob: true, nextActionAt: 50_000, turnDeadlineAt: 50_000 });
  });

  test("a forced move that leaves the same human acting schedules the next one at the deadline", async () => {
    const setupSettlement = createHumanGame();
    const setupRoad = applyAutomatedCommand(setupSettlement);
    const { ctx, jobs } = createSchedulerSpy();

    const schedule = await scheduleNextAutomatedAction(
      ctx,
      { _id: "game" as never, automationToken: 3 },
      setupRoad,
      60_200,
      { jobConsumed: true, nextActionAt: 60_000, state: setupSettlement, turnDeadlineAt: 60_000 },
    );

    expect(logicalTurnId(setupRoad)).toBe(logicalTurnId(setupSettlement));
    expect(schedule).toEqual({ automationToken: 4, nextActionAt: 60_000, turnDeadlineAt: 60_000 });
    expect(jobs).toEqual([{ args: { automationToken: 4, gameId: "game" }, at: 60_000 }]);
  });

  test("returning the turn from a bot retires the human's earlier timeout job", async () => {
    const initial = createHumanGame();
    const botId = waitingPlayerId(initial);
    const building: GameState = {
      ...handToBot(initial, botId),
      phase: { kind: "build_and_trade" },
      turnNumber: 2,
    };
    const botDiscarding: GameState = {
      ...building,
      actionNumber: building.actionNumber + 1,
      phase: { kind: "discard", pending: [{ count: 4, playerId: botId }] },
    };
    const backToHuman: GameState = {
      ...building,
      actionNumber: botDiscarding.actionNumber + 1,
    };
    const { ctx, jobs } = createSchedulerSpy();

    const botTurn = await scheduleNextAutomatedAction(
      ctx,
      { _id: "game" as never, automationToken: 5 },
      botDiscarding,
      20_000,
      { jobConsumed: false, nextActionAt: 50_000, state: building, turnDeadlineAt: 50_000 },
    );
    const humanTurn = await scheduleNextAutomatedAction(
      ctx,
      { _id: "game" as never, automationToken: botTurn.automationToken },
      backToHuman,
      21_000,
      { jobConsumed: true, ...botTurn, state: botDiscarding },
    );

    expect(botTurn).toEqual({
      automationToken: 6,
      nextActionAt: 20_000 + BOT_ACTION_DELAY_MS,
      turnDeadlineAt: 50_000,
    });
    expect(humanTurn).toEqual({ automationToken: 7, nextActionAt: 50_000, turnDeadlineAt: 50_000 });
    expect(jobs.map(({ at }) => at)).toEqual([20_000 + BOT_ACTION_DELAY_MS, 50_000]);
  });

  test("handing a waiting player's seat to a bot keeps the job of the player who must act", () => {
    const initial = createHumanGame();
    const previous: GameState = {
      ...initial,
      phase: { kind: "discard", pending: [{ count: 1, playerId: waitingPlayerId(initial) }] },
      turnNumber: 1,
    };

    expect(
      planNextSchedule(handToBot(previous, initial.activePlayerId), 20_000, {
        jobConsumed: false,
        nextActionAt: 50_000,
        state: previous,
        turnDeadlineAt: 50_000,
      }),
    ).toEqual({ keepsPendingJob: true, nextActionAt: 50_000, turnDeadlineAt: undefined });
  });

  test("resuming restores the time left on a human's clocks", () => {
    const state: GameState = { ...createHumanGame(), phase: { kind: "roll" }, turnNumber: 2 };

    expect(
      resumedScheduleTimes(
        { pausedNextActionRemainingMs: 12_000, pausedTurnDeadlineRemainingMs: 12_000 },
        state,
        20_000,
      ),
    ).toEqual({ nextActionAt: 32_000, turnDeadlineAt: 32_000 });
  });

  test("resuming schedules a bot that took over a seat while the game was paused", () => {
    const untimed = createHumanGame({ ...THREE_PLAYER_SETTINGS, turnTimerSeconds: 0 });
    const state = handToBot(untimed, untimed.activePlayerId);

    expect(resumedScheduleTimes({}, state, 20_000)).toEqual({
      nextActionAt: 20_000 + BOT_ACTION_DELAY_MS,
      turnDeadlineAt: undefined,
    });
  });

  test("the paused clock shows the delay of a bot that took over the seat during the pause", () => {
    const initial = createHumanGame();
    const state = handToBot(initial, initial.activePlayerId);

    expect(
      resumedRemainingMs(
        { pausedNextActionRemainingMs: 45_000, pausedTurnDeadlineRemainingMs: 45_000 },
        state,
      ),
    ).toEqual({ nextActionMs: BOT_ACTION_DELAY_MS, turnDeadlineMs: undefined });
  });

  test("resuming drops the turn clock of a human replaced by a bot during the pause", () => {
    const initial = createHumanGame();
    const state = handToBot(initial, initial.activePlayerId);

    expect(
      resumedScheduleTimes(
        { pausedNextActionRemainingMs: 45_000, pausedTurnDeadlineRemainingMs: 45_000 },
        state,
        20_000,
      ),
    ).toEqual({ nextActionAt: 20_000 + BOT_ACTION_DELAY_MS, turnDeadlineAt: undefined });
  });
});
