import { describe, expect, test } from "bun:test";

import { createDefaultGame, type GameCommand, type GameState } from "@settersaga/game";

import { commandEventKind, commandText, parseCommandKind } from "../convex/model/commands";
import { commandValidator } from "../convex/model/validators";

describe("game command boundary", () => {
  test("accepts and describes development-card purchases", () => {
    expect(JSON.stringify(commandValidator)).toContain("buy_development_card");
    const state = createDefaultGame(
      Array.from({ length: 3 }, (_, index) => ({
        displayName: `Player ${index + 1}`,
        id: `player-${index + 1}`,
        isBot: true,
      })),
      "development-card-event",
    );
    const command: GameCommand = { kind: "buy_development_card" };

    expect(commandEventKind(command, state, state)).toBe("buy_development_card");
    expect(commandText(command, "Player 1", state, state)).toBe(
      "Player 1 bought a development card.",
    );
  });

  test("accepts and describes every development-card play command", () => {
    const validatorJson = JSON.stringify(commandValidator);
    for (const kind of [
      "play_knight",
      "play_monopoly",
      "play_road_building",
      "play_year_of_plenty",
    ]) {
      expect(validatorJson).toContain(kind);
    }
    const state = createDefaultGame(
      Array.from({ length: 3 }, (_, index) => ({
        displayName: `Player ${index + 1}`,
        id: `player-${index + 1}`,
        isBot: true,
      })),
      "development-card-play-events",
    );
    const commands: GameCommand[] = [
      { kind: "play_knight" },
      { kind: "play_monopoly", resource: "wheat" },
      { kind: "play_road_building" },
      {
        kind: "play_year_of_plenty",
        resources: { brick: 1, sheep: 0, stone: 0, tree: 0, wheat: 1 },
      },
    ];

    expect(commands.map((command) => commandEventKind(command, state, state))).toEqual(
      commands.map((command) => command.kind),
    );
    expect(commands.map((command) => commandText(command, "Player 1", state, state))).toEqual([
      "Player 1 played a Knight.",
      "Player 1 played Monopoly on wheat.",
      "Player 1 played Road Building.",
      "Player 1 played Year of Plenty.",
    ]);
  });

  test("reads the command kind used by presentation event cues", () => {
    expect(parseCommandKind('{"kind":"place_road","edgeKey":"1:2"}')).toBe("place_road");
    expect(parseCommandKind("invalid")).toBe("unknown");
    expect(parseCommandKind('{"kind":42}')).toBe("unknown");
  });

  test("reports an automatic robber theft as a compound event", () => {
    const state = createDefaultGame(
      Array.from({ length: 3 }, (_, index) => ({
        displayName: `Player ${index + 1}`,
        id: `player-${index + 1}`,
        isBot: true,
      })),
      "automatic-robber-event",
    );
    const command: GameCommand = { kind: "move_robber", tileId: "tile:0:0" };
    const nextState: GameState = { ...state, randomIndex: state.randomIndex + 1 };

    expect(commandEventKind(command, state, nextState)).toBe("move_robber_and_steal");
    expect(commandText(command, "Player 1", state, nextState)).toBe(
      "Player 1 moved the robber and stole a resource.",
    );
    expect(commandEventKind(command, state, state)).toBe("move_robber");
    expect(commandText(command, "Player 1", state, state)).toBe("Player 1 moved the robber.");
  });
});
