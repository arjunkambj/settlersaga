import { describe, expect, test } from "bun:test";

import { describeVictoryPoints, splitDevelopmentHand } from "../src/lib/game/development-hand";

describe("development hand", () => {
  test("victory point cards leave the playable kinds and are counted on their own", () => {
    const hand = splitDevelopmentHand([
      "victory-point",
      "monopoly",
      "knight",
      "victory-point",
      "knight",
    ]);

    expect(hand.kinds.map(({ count, id }) => ({ count, id }))).toEqual([
      { count: 2, id: "knight" },
      { count: 1, id: "monopoly" },
    ]);
    // "Dev ×3": the playable kinds' cards only.
    expect(hand.total).toBe(3);
    expect(hand.victoryPoints).toBe(2);
  });

  test("the playable kinds keep hand order whatever order they were bought in", () => {
    const hand = splitDevelopmentHand([
      "monopoly",
      "year-of-plenty",
      "road-building",
      "victory-point",
      "knight",
    ]);

    expect(hand.kinds.map((kind) => kind.id)).toEqual([
      "knight",
      "road-building",
      "year-of-plenty",
      "monopoly",
    ]);
    expect(hand.kinds.every((kind) => kind.count === 1)).toBe(true);
    expect(hand.total).toBe(4);
    expect(hand.victoryPoints).toBe(1);
  });

  test("a hand of victory points alone has no kinds to fan or stack", () => {
    expect(splitDevelopmentHand(["victory-point", "victory-point"])).toEqual({
      kinds: [],
      total: 0,
      victoryPoints: 2,
    });
  });

  test("an empty hand has nothing either side", () => {
    expect(splitDevelopmentHand([])).toEqual({ kinds: [], total: 0, victoryPoints: 0 });
  });

  test("the victory point words count the cards and the points they are worth", () => {
    expect(describeVictoryPoints(1)).toBe(
      "1 victory point card, worth 1 point. Only you can see it.",
    );
    expect(describeVictoryPoints(2)).toBe(
      "2 victory point cards, worth 2 points. Only you can see them.",
    );
  });
});
