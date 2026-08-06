import { describe, expect, test } from "bun:test";

import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import type { RegisteredMutation } from "convex/server";
import { type Infer } from "convex/values";

import { createQuickGame } from "../convex/games";
import { validateGameSettings } from "../convex/model/normalize";
import { roomViewValidator } from "../convex/model/validators";
import { updateLobbyConfiguration } from "../convex/rooms";
import schema, {
  baseGameSettingsValidator,
  storedBaseGameSettingsValidator,
} from "../convex/schema";

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
  test("no legacy maps are accepted in stored or public boundaries", () => {
    const serialized = JSON.stringify(baseGameSettingsValidator);
    expect(serialized).not.toContain("extended-10");
    expect(JSON.stringify(storedBaseGameSettingsValidator)).not.toContain("extended-10");
    expect(serializedTableDefinition("rooms")).not.toContain("extended-10");
    expect(serializedTableDefinition("games")).not.toContain("extended-10");
    expect(JSON.stringify(roomViewValidator)).not.toContain("extended-10");
  });

  test("does not expose the retired map through public inputs or room views", () => {
    const publicBoundariesExcludeLegacy: [
      AssertFalse<ContainsLegacyMap<QuickGameMap>>,
      AssertFalse<ContainsLegacyMap<LobbyConfigurationMap>>,
      AssertFalse<ContainsLegacyMap<RoomViewMap>>,
    ] = [false, false, false];

    expect(publicBoundariesExcludeLegacy).toEqual([false, false, false]);
    expect(JSON.stringify(roomViewValidator)).not.toContain("extended-10");
  });

  test("validateGameSettings accepts current settings", () => {
    expect(validateGameSettings({ ...DEFAULT_BASE_GAME_SETTINGS })).toEqual(
      DEFAULT_BASE_GAME_SETTINGS,
    );
  });
});
