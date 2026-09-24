import { describe, expect, test } from "bun:test";

import { DEFAULT_BASE_GAME_SETTINGS, type BaseGameSettings } from "@settersaga/game";

import { validateGameSettings } from "../convex/model/normalize";

function withSettings(overrides: Partial<BaseGameSettings>): BaseGameSettings {
  return { ...DEFAULT_BASE_GAME_SETTINGS, ...overrides };
}

describe("game settings boundaries", () => {
  test("accepts the default settings", () => {
    expect(() => validateGameSettings(withSettings({}))).not.toThrow();
  });

  test("rejects settings outside the supported ranges", () => {
    expect(() => validateGameSettings(withSettings({ victoryPoints: 2 }))).toThrow();
    expect(() => validateGameSettings(withSettings({ victoryPoints: 10.5 }))).toThrow();
    expect(() => validateGameSettings(withSettings({ discardLimit: 4 }))).toThrow();
    expect(() => validateGameSettings(withSettings({ map: "base", maxPlayers: 6 }))).toThrow();
  });
});
