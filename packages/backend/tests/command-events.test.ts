import { describe, expect, test } from "bun:test";

import { createDefaultGame, type GameCommand, type GameState } from "@settersaga/game";

import { commandEventKind, commandText, serializeCommand } from "../convex/model/commands";

const STATE = createDefaultGame(
  ["one", "two", "three"].map((id, index) => ({
    displayName: `Player ${index + 1}`,
    id,
    isBot: false as const,
  })),
  "command-events",
);

function withResources(
  state: GameState,
  changes: Record<string, Partial<Record<"brick" | "tree" | "wheat", number>>>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      resources: { ...player.resources, ...changes[player.id] },
    })),
  };
}

describe("game command events", () => {
  test("reports an automatic robber theft as a compound event naming the victim", () => {
    const command: GameCommand = { kind: "move_robber", tileId: "tile:0:0" };
    const before = withResources(STATE, { two: { wheat: 2 } });
    const after = withResources(STATE, { one: { wheat: 1 }, two: { wheat: 1 } });

    expect(commandEventKind(command, "one", before, after)).toBe("move_robber_and_steal");
    expect(commandText(command, "one", before, after)).toBe(
      "Player 1 moved the robber and stole a resource from Player 2.",
    );
    expect(commandEventKind(command, "one", before, before)).toBe("move_robber");
    expect(commandText(command, "one", before, before)).toBe("Player 1 moved the robber.");
  });

  test("lists what each player produced after a roll", () => {
    const after: GameState = {
      ...withResources(STATE, { three: { brick: 1 }, two: { wheat: 2 } }),
      lastDiceRoll: { first: 3, second: 5, sum: 8 },
    };

    expect(commandText({ kind: "roll" }, "one", STATE, after)).toBe(
      "Player 1 rolled 3 + 5 (8). Player 2 +2 Wheat, Player 3 +1 Brick.",
    );
  });

  test("describes discards and bank trades with counts and resource names", () => {
    const before = withResources(STATE, { one: { tree: 4 } });
    const after = withResources(STATE, { one: { wheat: 1 } });

    expect(
      commandText(
        { kind: "discard", resources: { brick: 0, sheep: 1, stone: 0, tree: 3, wheat: 0 } },
        "one",
        before,
        after,
      ),
    ).toBe("Player 1 discarded 4 resources.");
    expect(
      commandText({ give: "tree", kind: "trade_bank", receive: "wheat" }, "one", before, after),
    ).toBe("Player 1 traded 4 Wood for 1 Wheat.");
  });

  test("names the partner of a confirmed player trade", () => {
    expect(
      commandText(
        { kind: "confirm_trade", offerActionNumber: 4, partnerPlayerId: "three" },
        "one",
        STATE,
        STATE,
      ),
    ).toBe("Player 1 traded with Player 3.");
  });

  test("serializes a retried command identically whatever its key order", () => {
    expect(
      serializeCommand({
        kind: "discard",
        resources: { brick: 1, sheep: 0, stone: 0, tree: 2, wheat: 0 },
      }),
    ).toBe(
      serializeCommand({
        resources: { wheat: 0, tree: 2, stone: 0, sheep: 0, brick: 1 },
        kind: "discard",
      }),
    );
  });
});
