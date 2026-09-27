import { describe, expect, test } from "bun:test";

import { getPlayerPortraitSrc } from "../src/lib/game/hud-portraits";
import { getPlayerHudOrder } from "../src/lib/game/view";

describe("player HUD order", () => {
  test.each([
    {
      expected: ["blue", "orange", "green", "viewer"],
      turnOrder: ["viewer", "blue", "orange", "green"],
    },
    {
      expected: ["orange", "green", "blue", "viewer"],
      turnOrder: ["blue", "viewer", "orange", "green"],
    },
    {
      expected: ["blue", "orange", "green", "viewer"],
      turnOrder: ["blue", "orange", "green", "viewer"],
    },
  ])(
    "lists who plays after the viewer, then the viewer, for turn order $turnOrder",
    ({ expected, turnOrder }) => {
      const players = ["green", "viewer", "orange", "blue"].map((id) => ({
        id,
        isViewer: id === "viewer",
      }));

      expect(getPlayerHudOrder(players, turnOrder).map((player) => player.id)).toEqual([
        ...expected,
      ]);
    },
  );

  test("keeps plain turn order when the viewer has no seat", () => {
    const players = ["green", "orange", "blue"].map((id) => ({ id, isViewer: false }));

    expect(
      getPlayerHudOrder(players, ["blue", "orange", "green"]).map((player) => player.id),
    ).toEqual(["blue", "orange", "green"]);
  });
});

describe("player portraits", () => {
  const sources = { botDifficulty: "hard" as const, viewerProfileImageUrl: "/me.png" };

  test("shows the viewer's profile photo", () => {
    expect(getPlayerPortraitSrc({ isBot: false, isViewer: true, seatIndex: 0 }, sources)).toBe(
      "/me.png",
    );
  });

  test("shows a bot's difficulty art", () => {
    expect(getPlayerPortraitSrc({ isBot: true, isViewer: false, seatIndex: 1 }, sources)).toBe(
      "/game-assets/avatars/bot-hard.png",
    );
  });

  test("falls back to the seat's emblem for a person without a photo", () => {
    expect(
      getPlayerPortraitSrc(
        { isBot: false, isViewer: true, seatIndex: 1 },
        { ...sources, viewerProfileImageUrl: null },
      ),
    ).toBe("/game-assets/avatars/blue-cartographer.png");
    expect(getPlayerPortraitSrc({ isBot: false, isViewer: false, seatIndex: 0 }, sources)).toBe(
      "/game-assets/avatars/red-navigator.png",
    );
  });
});
