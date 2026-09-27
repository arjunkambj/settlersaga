import { emptyInventory, type TradeOffer } from "@settersaga/game";
import { describe, expect, test } from "bun:test";

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  CARD_GAIN_AFTER_DICE_MS,
  createCueGate,
  CUE_MASK_MS,
  getCueVariation,
  getEventSound,
  getGameEndSound,
  getTradeOfferSound,
  getViewerEventCues,
  getViewerEventSound,
  SOUND_EFFECT_MIX,
  SOUND_EFFECT_PATHS,
  SOUND_EFFECTS,
} from "../src/lib/game/audio-cues";

function hand(cards: Partial<Record<"brick" | "sheep" | "stone" | "tree" | "wheat", number>>) {
  return { ...emptyInventory(), ...cards };
}

function tradeOffer(overrides: Partial<TradeOffer> = {}): TradeOffer {
  return {
    acceptedPlayerIds: [],
    give: { ...emptyInventory(), stone: 1 },
    offerActionNumber: 17,
    proposerPlayerId: "proposer",
    recipientPlayerIds: ["me", "other"],
    rejectedPlayerIds: [],
    want: { ...emptyInventory(), wheat: 1 },
    ...overrides,
  };
}

describe("game audio cues", () => {
  test("ignores commands without a dedicated result cue", () => {
    expect(getEventSound("end_turn", "roll")).toBeNull();
    expect(getEventSound("buy_development_card", "build_and_trade")).toBeNull();
  });

  test("plays one placement cue for the combined setup settlement and road", () => {
    expect(getEventSound("place_settlement", "setup_road")).toBeNull();
    expect(getEventSound("place_road", "setup_settlement")).toBe("road");
  });

  test("keeps the trade cue for trades that move cards", () => {
    expect(getEventSound("confirm_trade", "build_and_trade")).toBe("trade");
    expect(getEventSound("trade_bank", "build_and_trade")).toBe("trade");
    expect(getEventSound("respond_trade", "build_and_trade")).toBe("action");
  });

  test("plays action cues only for the viewer's own actions", () => {
    const roll = { actorPlayerId: "me", kind: "roll" } as const;
    expect(getViewerEventSound(roll, "build_and_trade", "me", null, true)).toBe("dice");
    expect(
      getViewerEventSound({ ...roll, actorPlayerId: "other" }, "build_and_trade", "me", null, true),
    ).toBeNull();
    expect(
      getViewerEventSound(
        { actorPlayerId: "other", kind: "place_road" },
        "build_and_trade",
        "me",
        null,
        false,
      ),
    ).toBeNull();
  });

  test("plays the confirmed trade for the proposer and for the partner they picked", () => {
    const confirm = { actorPlayerId: "proposer", kind: "confirm_trade" } as const;
    const accepted = tradeOffer({ acceptedPlayerIds: ["me", "other"] });

    expect(getViewerEventSound(confirm, "build_and_trade", "proposer", accepted, true)).toBe(
      "trade",
    );
    expect(getViewerEventSound(confirm, "build_and_trade", "me", accepted, true)).toBe("trade");
    expect(
      getViewerEventSound(confirm, "build_and_trade", "bystander", accepted, false),
    ).toBeNull();
    expect(getViewerEventSound(confirm, "build_and_trade", "me", null, true)).toBeNull();
  });

  test("stays quiet for an acceptor the proposer did not pick", () => {
    const confirm = { actorPlayerId: "proposer", kind: "confirm_trade" } as const;
    const accepted = tradeOffer({ acceptedPlayerIds: ["me", "other"] });

    expect(getViewerEventSound(confirm, "build_and_trade", "other", accepted, false)).toBeNull();
  });

  test("announces a new offer only to its recipients", () => {
    expect(getTradeOfferSound(null, tradeOffer(), "me")).toBe("action");
    expect(getTradeOfferSound(null, tradeOffer(), "bystander")).toBeNull();
    expect(getTradeOfferSound(tradeOffer(), tradeOffer(), "me")).toBeNull();
    expect(getTradeOfferSound(tradeOffer(), null, "me")).toBeNull();
    expect(getTradeOfferSound(tradeOffer(), tradeOffer({ offerActionNumber: 21 }), "me")).toBe(
      "action",
    );
  });

  test("tells the proposer when a recipient accepts", () => {
    const accepted = tradeOffer({ acceptedPlayerIds: ["other"] });

    expect(getTradeOfferSound(tradeOffer(), accepted, "proposer")).toBe("action");
    expect(getTradeOfferSound(accepted, accepted, "proposer")).toBeNull();
    expect(
      getTradeOfferSound(tradeOffer(), tradeOffer({ rejectedPlayerIds: ["other"] }), "proposer"),
    ).toBeNull();
    expect(getTradeOfferSound(tradeOffer(), accepted, "me")).toBeNull();
  });

  test("plays the game-end cue once: the fanfare for the winner, a calm close for the rest", () => {
    expect(getGameEndSound(null, "me", "me")).toBe("victory");
    expect(getGameEndSound(null, "other", "me")).toBe("gameOver");
    expect(getGameEndSound("other", "other", "me")).toBeNull();
    expect(getGameEndSound(null, null, "me")).toBeNull();
  });
});

describe("viewer event cues", () => {
  const empty = hand({});

  test("chimes after the dice when the viewer's own roll pays them", () => {
    const roll = { actorPlayerId: "me", kind: "roll" } as const;
    expect(
      getViewerEventCues(roll, "build_and_trade", "me", null, empty, hand({ wheat: 2 })),
    ).toEqual([
      { delayMs: 0, sound: "dice" },
      { delayMs: CARD_GAIN_AFTER_DICE_MS, sound: "cardGain" },
    ]);
    expect(getViewerEventCues(roll, "build_and_trade", "me", null, empty, empty)).toEqual([
      { delayMs: 0, sound: "dice" },
    ]);
  });

  test("chimes when another player's roll pays the viewer, and stays quiet otherwise", () => {
    const roll = { actorPlayerId: "other", kind: "roll" } as const;
    expect(
      getViewerEventCues(roll, "build_and_trade", "me", null, empty, hand({ tree: 1 })),
    ).toEqual([{ delayMs: 0, sound: "cardGain" }]);
    expect(getViewerEventCues(roll, "build_and_trade", "me", null, empty, empty)).toEqual([]);
  });

  test("warns everyone else when a seven is rolled", () => {
    const roll = { actorPlayerId: "other", kind: "roll" } as const;
    expect(getViewerEventCues(roll, "discard", "me", null, empty, empty)).toEqual([
      { delayMs: 0, sound: "robber" },
    ]);
    expect(getViewerEventCues(roll, "move_robber", "me", null, empty, empty)).toEqual([
      { delayMs: 0, sound: "robber" },
    ]);
  });

  test("marks cards taken from the viewer by another player", () => {
    const steal = { actorPlayerId: "other", kind: "move_robber_and_steal" } as const;
    expect(
      getViewerEventCues(steal, "build_and_trade", "me", null, hand({ stone: 1 }), empty),
    ).toEqual([{ delayMs: 0, sound: "resource" }]);
  });

  test("keeps a single cue for the viewer's own moves that spend cards", () => {
    const build = { actorPlayerId: "me", kind: "build_city" } as const;
    expect(
      getViewerEventCues(build, "build_and_trade", "me", null, hand({ stone: 3, wheat: 2 }), empty),
    ).toEqual([{ delayMs: 0, sound: "city" }]);
  });

  test("chimes for the resources from the second setup settlement", () => {
    const settle = { actorPlayerId: "me", kind: "place_settlement" } as const;
    expect(
      getViewerEventCues(settle, "setup_road", "me", null, empty, hand({ brick: 1, tree: 1 })),
    ).toEqual([{ delayMs: 0, sound: "cardGain" }]);
  });
});

describe("cue gate", () => {
  test("drops a repeat of the same cue inside its cooldown", () => {
    const gate = createCueGate();
    const cooldown = SOUND_EFFECT_MIX.resource.cooldownMs;
    expect(gate.tryStart("resource", 1000)).toBe(true);
    expect(gate.tryStart("resource", 1000 + cooldown - 1)).toBe(false);
    expect(gate.tryStart("resource", 1000 + cooldown)).toBe(true);
  });

  test("keeps a small cue from burying a big one that just started", () => {
    const gate = createCueGate();
    expect(gate.tryStart("turn", 1000)).toBe(true);
    expect(gate.tryStart("action", 1000 + CUE_MASK_MS - 1)).toBe(false);
    expect(gate.tryStart("action", 1000 + CUE_MASK_MS)).toBe(true);
  });

  test("lets a big cue start over a small one", () => {
    const gate = createCueGate();
    expect(gate.tryStart("action", 1000)).toBe(true);
    expect(gate.tryStart("robber", 1010)).toBe(true);
  });
});

describe("cue variation", () => {
  test("varies frequent cues within a small range and leaves big moments untouched", () => {
    expect(getCueVariation("victory", () => 0)).toEqual({ gain: 1, playbackRate: 1 });
    for (const random of [0, 0.5, 0.999]) {
      const { gain, playbackRate } = getCueVariation("resource", () => random);
      expect(gain).toBeGreaterThan(0.8);
      expect(gain).toBeLessThan(1.2);
      expect(playbackRate).toBeGreaterThan(0.97);
      expect(playbackRate).toBeLessThan(1.03);
    }
  });
});

describe("sound effect files", () => {
  test("every cue has a file in public/sound-effects", () => {
    for (const sound of SOUND_EFFECTS) {
      expect(existsSync(join(import.meta.dir, "../public", SOUND_EFFECT_PATHS[sound]))).toBe(true);
    }
  });
});
