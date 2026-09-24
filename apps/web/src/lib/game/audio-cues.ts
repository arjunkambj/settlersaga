import type { GamePhase, TradeOffer } from "@settersaga/game";

import type { RoomEventView } from "@/lib/game/types";

export const SOUND_EFFECT_PATHS = {
  action: "/sound-effects/action-feedback.mp3",
  city: "/sound-effects/city-placed.mp3",
  dice: "/sound-effects/magic-dice.mp3",
  resource: "/sound-effects/resource-change.mp3",
  robber: "/sound-effects/robber-alert.mp3",
  road: "/sound-effects/road-placed.mp3",
  settlement: "/sound-effects/settlement-placed.mp3",
  trade: "/sound-effects/trade-resolved.mp3",
  nextTurn: "/sound-effects/next-turn.mp3",
  turn: "/sound-effects/your-turn.mp3",
  victory: "/sound-effects/victory.mp3",
} as const;

export type SoundEffect = keyof typeof SOUND_EFFECT_PATHS;

export function getEventSound(
  kind: RoomEventView["kind"],
  currentPhaseKind: GamePhase["kind"],
): SoundEffect | null {
  // The opening settlement and its road land as one move; only the road plays.
  if (kind === "place_settlement" && currentPhaseKind === "setup_road") {
    return null;
  }

  switch (kind) {
    case "roll":
      return "dice";
    case "place_road":
      return "road";
    case "place_settlement":
      return "settlement";
    case "build_city":
      return "city";
    case "move_robber":
    case "move_robber_and_steal":
      return "robber";
    case "play_knight":
    case "play_monopoly":
    case "play_road_building":
    case "play_year_of_plenty":
      return "action";
    case "discard":
    case "steal":
      return "resource";
    case "confirm_trade":
    case "trade_bank":
      return "trade";
    case "cancel_trade":
    case "game_started":
    case "propose_trade":
    case "respond_trade":
      return "action";
    default:
      return null;
  }
}

/**
 * Cues play for the viewer's own moves, and for a confirmed trade the viewer was picked for: they
 * accepted `closedOffer` (the offer open before this event) and their cards changed with it.
 */
export function getViewerEventSound(
  event: Pick<RoomEventView, "actorPlayerId" | "kind">,
  currentPhaseKind: GamePhase["kind"],
  viewerPlayerId: string,
  closedOffer: TradeOffer | null,
  viewerHandChanged: boolean,
): SoundEffect | null {
  const involvesViewer =
    event.actorPlayerId === viewerPlayerId ||
    (event.kind === "confirm_trade" &&
      viewerHandChanged &&
      closedOffer?.acceptedPlayerIds.includes(viewerPlayerId) === true);
  return involvesViewer ? getEventSound(event.kind, currentPhaseKind) : null;
}

/**
 * A new offer the viewer is asked to answer, or a new acceptance of the viewer's own offer.
 */
export function getTradeOfferSound(
  previousOffer: TradeOffer | null,
  offer: TradeOffer | null,
  viewerPlayerId: string,
): SoundEffect | null {
  if (!offer) {
    return null;
  }
  if (offer.offerActionNumber !== previousOffer?.offerActionNumber) {
    return offer.recipientPlayerIds.includes(viewerPlayerId) ? "action" : null;
  }
  return offer.proposerPlayerId === viewerPlayerId &&
    offer.acceptedPlayerIds.length > previousOffer.acceptedPlayerIds.length
    ? "action"
    : null;
}

/** The fanfare is for the player who just won, not for everyone at the table. */
export function shouldPlayVictory(
  previousWinnerPlayerId: string | null,
  winnerPlayerId: string | null,
  viewerPlayerId: string,
): boolean {
  return previousWinnerPlayerId === null && winnerPlayerId === viewerPlayerId;
}
