import type { DevelopmentCardType, PlayableDevelopmentCardType } from "@settersaga/game";

import { DEVELOPMENT_CARD_ASSETS } from "@/constants/game/card-assets";

type DevelopmentCardAsset = (typeof DEVELOPMENT_CARD_ASSETS)[number];

/** One kind of development card the player can play some day, and how many they hold. */
export type DevelopmentKind = Extract<DevelopmentCardAsset, { id: PlayableDevelopmentCardType }> & {
  count: number;
};

export interface DevelopmentHand {
  /** The kinds held that can be played, in hand order (Knight, Road Building, Year of Plenty, Monopoly). */
  kinds: DevelopmentKind[];
  /** How many cards those kinds hold together: the "Dev ×N" count. */
  total: number;
  /** Victory point cards held. Each is a point, none is ever played, and only the player sees them. */
  victoryPoints: number;
}

/**
 * A player's development cards split in two: the kinds that can be played, which fan out (or
 * stack) together in the hand, and the victory point cards, which only count toward the score and
 * so sit apart on a card of their own.
 */
export function splitDevelopmentHand(cards: readonly DevelopmentCardType[]): DevelopmentHand {
  const countOf = (id: DevelopmentCardType) => cards.filter((card) => card === id).length;
  const kinds = DEVELOPMENT_CARD_ASSETS.flatMap((asset): DevelopmentKind[] => {
    if (asset.id === "victory-point") {
      return [];
    }
    const count = countOf(asset.id);
    return count > 0 ? [{ ...asset, count }] : [];
  });
  return {
    kinds,
    total: kinds.reduce((total, kind) => total + kind.count, 0),
    victoryPoints: countOf("victory-point"),
  };
}

/** The victory point card's words, for its tooltip and accessible name: "2 victory point cards, …". */
export function describeVictoryPoints(count: number): string {
  return count === 1
    ? "1 victory point card, worth 1 point. Only you can see it."
    : `${count} victory point cards, worth ${count} points. Only you can see them.`;
}
