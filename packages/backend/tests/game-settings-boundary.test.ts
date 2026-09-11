import { describe, expect, test } from "bun:test";

import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import type { RegisteredMutation } from "convex/server";
import { type Infer } from "convex/values";

import { createQuickGame } from "../convex/games";
import { validateGameSettings } from "../convex/model/normalize";
import { roomViewValidator } from "../convex/model/validators";
import { updateLobbyConfiguration } from "../convex/rooms";

type MutationArgs<Value> =
  Value extends RegisteredMutation<infer _Visibility, infer Args, infer _Returns> ? Args : never;
type ContainsLegacyMap<Value> = "extended-10" extends Value ? true : false;
type AssertFalse<Value extends false> = Value;

type QuickGameMap = NonNullable<MutationArgs<typeof createQuickGame>["settings"]>["map"];
type LobbyConfigurationMap = MutationArgs<typeof updateLobbyConfiguration>["settings"]["map"];
type RoomViewMap = Infer<typeof roomViewValidator>["settings"]["map"];

// Compile-time guard: the retired map must not appear in any public boundary type.
export type NoLegacyMaps = AssertFalse<
  | ContainsLegacyMap<QuickGameMap>
  | ContainsLegacyMap<LobbyConfigurationMap>
  | ContainsLegacyMap<RoomViewMap>
>;

describe("game settings boundaries", () => {
  test("validateGameSettings accepts current settings", () => {
    expect(validateGameSettings({ ...DEFAULT_BASE_GAME_SETTINGS })).toEqual(
      DEFAULT_BASE_GAME_SETTINGS,
    );
  });

  test("validateGameSettings rejects out-of-range settings", () => {
    const withSettings = (overrides: Record<string, unknown>) =>
      ({
        ...DEFAULT_BASE_GAME_SETTINGS,
        ...overrides,
      }) as Parameters<typeof validateGameSettings>[0];

    expect(() => validateGameSettings(withSettings({ victoryPoints: 2 }))).toThrow();
    expect(() => validateGameSettings(withSettings({ discardLimit: 4 }))).toThrow();
    expect(() => validateGameSettings(withSettings({ turnTimerSeconds: 45 }))).toThrow();
    expect(() => validateGameSettings(withSettings({ map: "extended-10" }))).toThrow();
    expect(() => validateGameSettings(withSettings({ map: "base", maxPlayers: 6 }))).toThrow();
  });
});
