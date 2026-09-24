import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { applyCommand, chooseFallbackCommand, createDefaultGame } from "@settersaga/game";

import { chooseAutomatedMove } from "../convex/automation";

const STATE = createDefaultGame(
  ["one", "two", "three"].map((id, index) => ({
    botDifficulty: "hard" as const,
    displayName: `Bot ${index + 1}`,
    id,
    isBot: true as const,
  })),
  "automated-move",
);
const BOT_ID = STATE.activePlayerId;
const FALLBACK = chooseFallbackCommand(STATE, BOT_ID);

function brokenStrategy(): never {
  throw new Error("Strategy bug");
}

describe("automated moves", () => {
  let consoleError: ReturnType<typeof spyOn>;
  beforeEach(() => {
    consoleError = spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  test("falls back to the plainest legal move when the player's strategy throws", () => {
    expect(chooseAutomatedMove(STATE, BOT_ID, [brokenStrategy, chooseFallbackCommand])).toEqual({
      command: FALLBACK,
      nextState: applyCommand(STATE, BOT_ID, FALLBACK),
    });
  });

  test("falls back when the rules reject the strategy's command", () => {
    const move = chooseAutomatedMove(STATE, BOT_ID, [
      () => ({ kind: "end_turn" }),
      chooseFallbackCommand,
    ]);

    expect(move?.command).toEqual(FALLBACK);
  });

  test("finds no move when every chooser fails", () => {
    expect(chooseAutomatedMove(STATE, BOT_ID, [brokenStrategy])).toBeNull();
  });
});
