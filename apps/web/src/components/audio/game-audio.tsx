"use client";

import {
  RESOURCE_ORDER,
  type GamePhase,
  type ResourceInventory,
  type TradeOffer,
} from "@settersaga/game";
import { useCallback, useEffect, useRef } from "react";

import {
  getTradeOfferSound,
  getViewerEventSound,
  shouldPlayVictory,
  SOUND_EFFECT_PATHS,
  type SoundEffect,
} from "@/lib/game/audio-cues";
import type { RoomEventView } from "@/lib/game/types";

const TURN_REMINDER_DELAY_MS = 25_000;

export function GameAudio({
  actionNumber,
  activePlayerId,
  events,
  phaseKind,
  soundEffectsVolume,
  tradeOffer,
  viewerPlayerId,
  viewerResources,
  winnerPlayerId,
}: {
  actionNumber: number;
  activePlayerId: string;
  events: readonly RoomEventView[];
  phaseKind: GamePhase["kind"];
  soundEffectsVolume: number;
  tradeOffer: TradeOffer | null;
  viewerPlayerId: string;
  /** Tells a confirmed trade's partner from the other players who accepted it. */
  viewerResources: Readonly<ResourceInventory>;
  winnerPlayerId: string | null;
}) {
  const audioElementsRef = useRef(new Map<SoundEffect, HTMLAudioElement>());
  const lastEventIdRef = useRef(events.at(-1)?.id);
  // A fresh game announces its opening turn; rejoining a game in progress stays quiet.
  const previousActivePlayerIdRef = useRef(actionNumber === 0 ? null : activePlayerId);
  const previousWinnerPlayerIdRef = useRef(winnerPlayerId);
  const previousTradeOfferRef = useRef(tradeOffer);
  const previousViewerResourcesRef = useRef(viewerResources);
  const soundEffectsVolumeRef = useRef(soundEffectsVolume);

  useEffect(() => {
    soundEffectsVolumeRef.current = soundEffectsVolume;
  }, [soundEffectsVolume]);

  const playSound = useCallback((sound: SoundEffect) => {
    const volume = soundEffectsVolumeRef.current;
    if (volume === 0) {
      return;
    }

    let audio = audioElementsRef.current.get(sound);
    if (!audio) {
      audio = new Audio(SOUND_EFFECT_PATHS[sound]);
      audio.preload = "auto";
      audioElementsRef.current.set(sound, audio);
    }

    audio.currentTime = 0;
    audio.volume = volume / 100;
    void audio.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    const previousViewerResources = previousViewerResourcesRef.current;
    previousViewerResourcesRef.current = viewerResources;
    const newestEvent = events.at(-1);
    if (!newestEvent || newestEvent.id === lastEventIdRef.current) {
      return;
    }

    lastEventIdRef.current = newestEvent.id;
    // The winning move is covered by the end-of-game cue.
    if (winnerPlayerId !== null) {
      return;
    }

    const sound = getViewerEventSound(
      newestEvent,
      phaseKind,
      viewerPlayerId,
      previousTradeOfferRef.current,
      RESOURCE_ORDER.some(
        (resource) => previousViewerResources[resource] !== viewerResources[resource],
      ),
    );
    if (sound) {
      playSound(sound);
    }
  }, [events, phaseKind, playSound, viewerPlayerId, viewerResources, winnerPlayerId]);

  // Runs after the event cue above, which reads the offer as it was before this update.
  useEffect(() => {
    const previousTradeOffer = previousTradeOfferRef.current;
    previousTradeOfferRef.current = tradeOffer;
    const sound = getTradeOfferSound(previousTradeOffer, tradeOffer, viewerPlayerId);
    if (sound) {
      playSound(sound);
    }
  }, [playSound, tradeOffer, viewerPlayerId]);

  useEffect(() => {
    const previousWinnerPlayerId = previousWinnerPlayerIdRef.current;
    previousWinnerPlayerIdRef.current = winnerPlayerId;
    if (shouldPlayVictory(previousWinnerPlayerId, winnerPlayerId, viewerPlayerId)) {
      playSound("victory");
    }
  }, [playSound, viewerPlayerId, winnerPlayerId]);

  useEffect(() => {
    const previousActivePlayerId = previousActivePlayerIdRef.current;
    previousActivePlayerIdRef.current = activePlayerId;
    if (previousActivePlayerId !== activePlayerId) {
      playSound(activePlayerId === viewerPlayerId ? "turn" : "nextTurn");
    }
  }, [activePlayerId, playSound, viewerPlayerId]);

  useEffect(() => {
    if (activePlayerId !== viewerPlayerId || winnerPlayerId !== null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      playSound("turn");
    }, TURN_REMINDER_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activePlayerId, events, phaseKind, playSound, viewerPlayerId, winnerPlayerId]);

  return null;
}
