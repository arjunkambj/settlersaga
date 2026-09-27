"use client";

import type { GamePhase, ResourceInventory, TradeOffer } from "@settersaga/game";
import { useCallback, useEffect, useRef } from "react";

import {
  installAudioUnlock,
  playSoundEffect,
  preloadSoundEffects,
  setSoundEffectsMuted,
} from "@/components/audio/sound-engine";
import {
  getGameEndSound,
  getTradeOfferSound,
  getViewerEventCues,
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
  /**
   * Tells a confirmed trade's partner from the other players who accepted it, and plays the cues for
   * cards the viewer gains or loses through other players' moves.
   */
  viewerResources: Readonly<ResourceInventory>;
  winnerPlayerId: string | null;
}) {
  const lastEventIdRef = useRef(events.at(-1)?.id);
  // A fresh game announces its opening turn; rejoining a game in progress stays quiet.
  const previousActivePlayerIdRef = useRef(actionNumber === 0 ? null : activePlayerId);
  const previousWinnerPlayerIdRef = useRef(winnerPlayerId);
  const previousTradeOfferRef = useRef(tradeOffer);
  const previousViewerResourcesRef = useRef(viewerResources);
  const soundEffectsVolumeRef = useRef(soundEffectsVolume);

  useEffect(() => {
    soundEffectsVolumeRef.current = soundEffectsVolume;
    setSoundEffectsMuted(soundEffectsVolume <= 0);
  }, [soundEffectsVolume]);

  const pendingCuesRef = useRef(new Set<number>());

  useEffect(() => {
    installAudioUnlock();
    preloadSoundEffects();
    const pendingCues = pendingCuesRef.current;
    return () => {
      for (const timeoutId of pendingCues) window.clearTimeout(timeoutId);
      pendingCues.clear();
    };
  }, []);

  // Reads the volume when the cue starts, so muting silences a cue that is still waiting.
  const playSound = useCallback((sound: SoundEffect, delayMs = 0) => {
    if (delayMs <= 0) {
      playSoundEffect(sound, soundEffectsVolumeRef.current);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      pendingCuesRef.current.delete(timeoutId);
      playSoundEffect(sound, soundEffectsVolumeRef.current);
    }, delayMs);
    pendingCuesRef.current.add(timeoutId);
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

    const cues = getViewerEventCues(
      newestEvent,
      phaseKind,
      viewerPlayerId,
      previousTradeOfferRef.current,
      previousViewerResources,
      viewerResources,
    );
    for (const cue of cues) {
      playSound(cue.sound, cue.delayMs);
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
    const sound = getGameEndSound(previousWinnerPlayerId, winnerPlayerId, viewerPlayerId);
    if (sound) {
      playSound(sound);
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
