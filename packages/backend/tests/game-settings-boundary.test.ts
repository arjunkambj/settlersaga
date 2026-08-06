import { describe, expect, test } from "bun:test";

import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import type { RegisteredMutation } from "convex/server";
import { ConvexError, type Infer } from "convex/values";

import { createQuickGame } from "../convex/games";
import { migrateWaitingRoomSettings, validateGameSettings } from "../convex/model/normalize";
import { roomViewValidator } from "../convex/model/validators";
import { updateLobbyConfiguration } from "../convex/rooms";
import schema, {
  baseGameSettingsValidator,
  storedBaseGameSettingsValidator,
  type StoredBaseGameSettings,
} from "../convex/schema";

const LEGACY_MAP_ID = "extended-10";

function serializedTableDefinition(tableName: "games" | "rooms"): string {
  const { tables } = JSON.parse(JSON.stringify(schema)) as { tables: Record<string, unknown> };
  const table = tables[tableName];
  if (!table) throw new Error(`Missing ${tableName} table definition`);
  return JSON.stringify(table);
}

type MutationArgs<Value> =
  Value extends RegisteredMutation<infer _Visibility, infer Args, infer _Returns> ? Args : never;
type ContainsLegacyMap<Value> = "extended-10" extends Value ? true : false;
type AssertFalse<Value extends false> = Value;

type QuickGameMap = NonNullable<MutationArgs<typeof createQuickGame>["settings"]>["map"];
type LobbyConfigurationMap = MutationArgs<typeof updateLobbyConfiguration>["settings"]["map"];
type RoomViewMap = Infer<typeof roomViewValidator>["settings"]["map"];

describe("game settings boundaries", () => {
  test("allows the retired map only in stored room and game documents", () => {
    expect(JSON.stringify(baseGameSettingsValidator)).not.toContain(LEGACY_MAP_ID);
    expect(JSON.stringify(storedBaseGameSettingsValidator)).toContain(LEGACY_MAP_ID);
    expect(serializedTableDefinition("rooms")).toContain(LEGACY_MAP_ID);
    expect(serializedTableDefinition("games")).toContain(LEGACY_MAP_ID);
  });

  test("does not expose the retired map through public inputs or room views", () => {
    const publicBoundariesExcludeLegacy: [
      AssertFalse<ContainsLegacyMap<QuickGameMap>>,
      AssertFalse<ContainsLegacyMap<LobbyConfigurationMap>>,
      AssertFalse<ContainsLegacyMap<RoomViewMap>>,
    ] = [false, false, false];

    expect(publicBoundariesExcludeLegacy).toEqual([false, false, false]);
    expect(JSON.stringify(roomViewValidator)).not.toContain(LEGACY_MAP_ID);
  });

  test("rejects retired stored settings before they reach current game logic", () => {
    const legacySettings: StoredBaseGameSettings = {
      ...DEFAULT_BASE_GAME_SETTINGS,
      map: LEGACY_MAP_ID,
    };

    expect(validateGameSettings({ ...DEFAULT_BASE_GAME_SETTINGS })).toEqual(
      DEFAULT_BASE_GAME_SETTINGS,
    );
    try {
      validateGameSettings(legacySettings);
      throw new Error("Expected retired settings to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      if (!(error instanceof ConvexError)) throw error;
      expect(error.data).toEqual({
        code: "LEGACY_GAME_MAP",
        message:
          "This room uses a retired map. Waiting rooms can be migrated; started games must be retired.",
      });
    }
  });

  test("maps retired waiting rooms to the supported board for their player count", () => {
    for (const [maxPlayers, map] of [
      [3, "base"],
      [4, "base"],
      [5, "extended-6"],
      [6, "extended-6"],
      [7, "extended-8"],
      [8, "extended-8"],
    ] as const) {
      expect(
        migrateWaitingRoomSettings({
          ...DEFAULT_BASE_GAME_SETTINGS,
          map: LEGACY_MAP_ID,
          maxPlayers,
        }).map,
      ).toBe(map);
    }
  });
});
