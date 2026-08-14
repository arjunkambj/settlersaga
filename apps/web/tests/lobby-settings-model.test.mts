import { describe, expect, test } from "bun:test";

import {
  getCompatiblePlayerCount,
  stepTableSize,
  tableSizeForPlayerCount,
} from "../src/lib/lobby/lobby-settings-model";

describe("lobby map settings", () => {
  test("moves an incompatible preference to the nearest supported player count", () => {
    expect(getCompatiblePlayerCount("base", 1, 8)).toBe(4);
    expect(getCompatiblePlayerCount("extended-6", 1, 4)).toBe(5);
    expect(getCompatiblePlayerCount("extended-8", 1, 6)).toBe(7);
  });

  test("rejects a board that cannot fit the current human players", () => {
    expect(getCompatiblePlayerCount("base", 5, 4)).toBeNull();
    expect(getCompatiblePlayerCount("extended-6", 7, 6)).toBeNull();
  });
});

describe("host table size", () => {
  test("maps a filled seat count onto the matching island", () => {
    expect(tableSizeForPlayerCount(3)).toEqual({ map: "base", maxPlayers: 3 });
    expect(tableSizeForPlayerCount(5)).toEqual({ map: "extended-6", maxPlayers: 5 });
    expect(tableSizeForPlayerCount(2)).toBeNull();
  });

  test("grows onto the next island when the current board is full", () => {
    expect(stepTableSize("base", 4, 1, 1)).toEqual({ map: "extended-6", maxPlayers: 5 });
    expect(stepTableSize("extended-6", 5, 1, -1)).toEqual({ map: "base", maxPlayers: 4 });
  });

  test("will not shrink below the humans already seated", () => {
    expect(stepTableSize("base", 4, 4, -1)).toBeNull();
    expect(stepTableSize("extended-6", 6, 6, -1)).toBeNull();
  });
});
