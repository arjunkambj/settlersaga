import { DEFAULT_BASE_GAME_SETTINGS } from "@settersaga/game";
import { describe, expect, test } from "bun:test";

import {
  createLobbySeatPreview,
  fitToRoom,
  getCompatiblePlayerCount,
  getLobbyStartOptions,
  tableSizeForPlayerCount,
  type LobbySeatMember,
  type LobbySettingsValue,
} from "../src/lib/lobby/lobby-settings-model";

const host: LobbySeatMember = {
  controller: "player",
  displayName: "Host",
  id: "host",
  isViewer: true,
  playerColor: "red",
  role: "host",
  seatIndex: 0,
};

function bot(seatIndex: number, displayName: string): LobbySeatMember {
  return {
    controller: "bot",
    displayName,
    id: `bot-${seatIndex}`,
    isViewer: false,
    playerColor: "blue",
    role: "player",
    seatIndex,
  };
}

function lobbyValue(botCount: number, maxPlayers: 3 | 4 | 5 | 6 = 4): LobbySettingsValue {
  return {
    botCount,
    botDifficulty: "medium",
    settings: {
      ...DEFAULT_BASE_GAME_SETTINGS,
      map: maxPlayers > 4 ? "extended-6" : "base",
      maxPlayers,
    },
  };
}

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

  test("maps a filled seat count onto the island that supports it", () => {
    expect(tableSizeForPlayerCount(3)).toEqual({ map: "base", maxPlayers: 3 });
    expect(tableSizeForPlayerCount(5)).toEqual({ map: "extended-6", maxPlayers: 5 });
    expect(tableSizeForPlayerCount(8)).toEqual({ map: "extended-8", maxPlayers: 8 });
    expect(tableSizeForPlayerCount(2)).toBeNull();
  });
});

describe("fitting a pending edit to the room", () => {
  test("keeps an edit that still fits the crew", () => {
    const value = lobbyValue(2);
    expect(fitToRoom(value, 2)).toEqual(value);
  });

  test("gives a bot's seat to a guest who joined after the edit", () => {
    const fitted = fitToRoom(lobbyValue(3), 2);

    expect(fitted.settings.maxPlayers).toBe(4);
    expect(fitted.botCount).toBe(2);
  });

  test("grows the table on the same island when the crew outgrew it", () => {
    const fitted = fitToRoom(lobbyValue(1, 5), 6);

    expect(fitted.settings).toMatchObject({ map: "extended-6", maxPlayers: 6 });
    expect(fitted.botCount).toBe(0);
  });
});

describe("lobby seat preview", () => {
  test("keeps seat indexes when the table size is unchanged", () => {
    const members = [host, bot(2, "Kara")];
    const seats = createLobbySeatPreview({
      botCount: 1,
      maxPlayers: 4,
      members,
      savedMaxPlayers: 4,
    });

    expect(seats.map((seat) => seat?.id)).toEqual(["host", undefined, "bot-2", undefined]);
  });

  test("adds draft bots to the lowest open seats with unique names", () => {
    const seats = createLobbySeatPreview({
      botCount: 3,
      maxPlayers: 4,
      members: [host],
      savedMaxPlayers: 4,
    });
    const bots = seats.slice(1);

    expect(bots.map((seat) => seat?.seatIndex)).toEqual([1, 2, 3]);
    expect(new Set(bots.map((seat) => seat?.displayName)).size).toBe(3);
  });

  test("shrinking the table seats the host first and drops the highest bots", () => {
    const guest: LobbySeatMember = {
      ...host,
      displayName: "Guest",
      id: "guest",
      isViewer: false,
      role: "player",
    };
    const members = [bot(0, "Kara"), { ...guest, seatIndex: 1 }, { ...host, seatIndex: 2 }];
    const seats = createLobbySeatPreview({
      botCount: 3,
      maxPlayers: 3,
      members: [...members, bot(3, "Clark"), bot(4, "Peter")],
      savedMaxPlayers: 5,
    });

    expect(seats.map((seat) => seat?.id)).toEqual(["host", "guest", "bot-0"]);
    expect(seats.map((seat) => seat?.seatIndex)).toEqual([0, 1, 2]);
  });

  test("never shows more bots than the open seats can hold", () => {
    const seats = createLobbySeatPreview({
      botCount: 7,
      maxPlayers: 3,
      members: [host],
      savedMaxPlayers: 3,
    });

    expect(seats.filter(Boolean)).toHaveLength(3);
  });
});

describe("lobby start options", () => {
  test("starts as-is once every seat is taken", () => {
    const value = lobbyValue(3);
    expect(getLobbyStartOptions(value, 4, 1)).toEqual([{ kind: "start", value }]);
  });

  test("offers a smaller island when the filled seats make a valid table", () => {
    const [shrink, fill] = getLobbyStartOptions(lobbyValue(2, 5), 3, 1);

    expect(shrink?.kind).toBe("shrink");
    expect(shrink?.value.settings).toMatchObject({ map: "base", maxPlayers: 3 });
    expect(shrink?.value.botCount).toBe(2);
    expect(fill).toEqual({ kind: "fill", value: lobbyValue(2, 5) });
  });

  test("can only fill the seats when too few are taken for any island", () => {
    const options = getLobbyStartOptions(lobbyValue(1), 2, 1);

    expect(options.map((option) => option.kind)).toEqual(["fill"]);
  });
});
