import {
  totalResources,
  type GamePhase,
  type ResourceInventory,
  type TradeOffer,
} from "@settersaga/game";

import type { RoomEventView } from "@/lib/game/types";

export const SOUND_EFFECT_PATHS = {
  action: "/sound-effects/action-feedback.mp3",
  cardGain: "/sound-effects/card-gain.mp3",
  city: "/sound-effects/city-placed.mp3",
  dice: "/sound-effects/magic-dice.mp3",
  gameOver: "/sound-effects/game-over.mp3",
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

export const SOUND_EFFECTS = Object.keys(SOUND_EFFECT_PATHS) as SoundEffect[];

interface SoundEffectMix {
  /** A repeat of the same cue inside this window is dropped instead of stacking. */
  cooldownMs: number;
  /** How long the music dips under the cue; 0 leaves the music alone. */
  duckMs: number;
  /** A cue briefly masks quieter-priority cues that arrive right after it. */
  priority: 0 | 1 | 2;
  /** Frequent cues vary slightly in pitch and level so repeats do not sound mechanical. */
  vary: boolean;
}

/**
 * Loudness is baked into the files (small cues sit near -21 LUFS, big moments near -16), so the
 * mix only decides how cues behave together.
 */
export const SOUND_EFFECT_MIX: Record<SoundEffect, SoundEffectMix> = {
  action: { cooldownMs: 120, duckMs: 0, priority: 0, vary: true },
  cardGain: { cooldownMs: 250, duckMs: 0, priority: 0, vary: true },
  city: { cooldownMs: 250, duckMs: 0, priority: 1, vary: false },
  dice: { cooldownMs: 400, duckMs: 0, priority: 1, vary: true },
  gameOver: { cooldownMs: 3000, duckMs: 1400, priority: 2, vary: false },
  nextTurn: { cooldownMs: 700, duckMs: 0, priority: 0, vary: false },
  resource: { cooldownMs: 250, duckMs: 0, priority: 0, vary: true },
  road: { cooldownMs: 150, duckMs: 0, priority: 1, vary: true },
  robber: { cooldownMs: 1500, duckMs: 900, priority: 2, vary: false },
  settlement: { cooldownMs: 250, duckMs: 0, priority: 1, vary: true },
  trade: { cooldownMs: 300, duckMs: 0, priority: 1, vary: true },
  turn: { cooldownMs: 1500, duckMs: 900, priority: 2, vary: false },
  victory: { cooldownMs: 3000, duckMs: 1800, priority: 2, vary: false },
};

/** How long a cue keeps lower-priority cues from starting on top of it. */
export const CUE_MASK_MS = 180;
/** On a roll that pays the viewer, the card chime lands as the dice settle. */
export const CARD_GAIN_AFTER_DICE_MS = 420;
const VARIATION_CENTS = 40;
const VARIATION_DB = 1.5;

export interface TimedCue {
  delayMs: number;
  sound: SoundEffect;
}

/**
 * Decides whether a cue may start now: the same cue never stacks inside its cooldown, and a big
 * cue is not buried under a small one that arrives in the same moment.
 */
export function createCueGate() {
  const lastStartedAt = new Map<SoundEffect, number>();
  let mask = { at: Number.NEGATIVE_INFINITY, priority: 0 };

  return {
    tryStart(sound: SoundEffect, now: number): boolean {
      const mix = SOUND_EFFECT_MIX[sound];
      if (now - (lastStartedAt.get(sound) ?? Number.NEGATIVE_INFINITY) < mix.cooldownMs) {
        return false;
      }
      const masked = now - mask.at < CUE_MASK_MS;
      if (masked && mix.priority < mask.priority) {
        return false;
      }
      lastStartedAt.set(sound, now);
      if (!masked || mix.priority >= mask.priority) {
        mask = { at: now, priority: mix.priority };
      }
      return true;
    },
  };
}

/** Playback rate and gain for one play, from `random` values in [0, 1). */
export function getCueVariation(
  sound: SoundEffect,
  random: () => number = Math.random,
): { gain: number; playbackRate: number } {
  if (!SOUND_EFFECT_MIX[sound].vary) {
    return { gain: 1, playbackRate: 1 };
  }
  const cents = (random() * 2 - 1) * VARIATION_CENTS;
  const decibels = (random() * 2 - 1) * VARIATION_DB;
  return { gain: 10 ** (decibels / 20), playbackRate: 2 ** (cents / 1200) };
}

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

/** A roll that leaves the game waiting on discards or the robber was a seven. */
function rolledSeven(kind: RoomEventView["kind"], currentPhaseKind: GamePhase["kind"]) {
  return kind === "roll" && (currentPhaseKind === "discard" || currentPhaseKind === "move_robber");
}

/**
 * Every cue for the newest event. Besides the viewer's own moves, the viewer hears cards they gain
 * or lose through other players' moves, and a warning when someone else rolls a seven.
 */
export function getViewerEventCues(
  event: Pick<RoomEventView, "actorPlayerId" | "kind">,
  currentPhaseKind: GamePhase["kind"],
  viewerPlayerId: string,
  closedOffer: TradeOffer | null,
  previousHand: Readonly<ResourceInventory>,
  hand: Readonly<ResourceInventory>,
): TimedCue[] {
  const handDelta = totalResources(hand) - totalResources(previousHand);
  const handChanged = (Object.keys(hand) as (keyof ResourceInventory)[]).some(
    (resource) => hand[resource] !== previousHand[resource],
  );
  const sound = getViewerEventSound(
    event,
    currentPhaseKind,
    viewerPlayerId,
    closedOffer,
    handChanged,
  );

  if (sound === "dice") {
    return handDelta > 0
      ? [
          { delayMs: 0, sound },
          { delayMs: CARD_GAIN_AFTER_DICE_MS, sound: "cardGain" },
        ]
      : [{ delayMs: 0, sound }];
  }
  if (sound) {
    return [{ delayMs: 0, sound }];
  }
  if (rolledSeven(event.kind, currentPhaseKind)) {
    return [{ delayMs: 0, sound: "robber" }];
  }
  if (handDelta > 0) {
    return [{ delayMs: 0, sound: "cardGain" }];
  }
  if (handDelta < 0) {
    return [{ delayMs: 0, sound: "resource" }];
  }
  return [];
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

/** The winner hears the fanfare; everyone else hears a calm close to the match. */
export function getGameEndSound(
  previousWinnerPlayerId: string | null,
  winnerPlayerId: string | null,
  viewerPlayerId: string,
): SoundEffect | null {
  if (previousWinnerPlayerId !== null || winnerPlayerId === null) {
    return null;
  }
  return winnerPlayerId === viewerPlayerId ? "victory" : "gameOver";
}
