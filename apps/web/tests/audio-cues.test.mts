import { emptyInventory, type TradeOffer } from "@settersaga/game";
import { describe, expect, test } from "bun:test";

import {
  getEventSound,
  getTradeOfferSound,
  getViewerEventSound,
  shouldPlayVictory,
} from "../src/lib/game/audio-cues";

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

  test("plays the victory fanfare only for the player who just won", () => {
    expect(shouldPlayVictory(null, "me", "me")).toBe(true);
    expect(shouldPlayVictory(null, "other", "me")).toBe(false);
    expect(shouldPlayVictory("me", "me", "me")).toBe(false);
    expect(shouldPlayVictory(null, null, "me")).toBe(false);
  });
});
