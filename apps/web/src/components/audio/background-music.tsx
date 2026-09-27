"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { installAudioUnlock, subscribeToMusicDuck } from "@/components/audio/sound-engine";
import { syncBackgroundMusic } from "@/lib/background-music";

/** Music dips to about -7 dB under a big cue, quickly, and comes back gently. */
const DUCK_LEVEL = 0.45;
const DUCK_ATTACK_MS = 80;
const DUCK_RELEASE_MS = 450;

interface Track {
  active: boolean;
  src: string;
  volume: number;
}

const MusicContext = createContext<Dispatch<SetStateAction<Track | null>> | null>(null);

/**
 * Owns the single <audio> element for background music. It sits above the pages, so screens
 * that play the same track one after another (home, then a lobby) keep it going instead of
 * restarting it, and a track that stops resumes where it left off.
 */
export function MusicHost({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const baseVolumeRef = useRef(0);
  const [track, setTrack] = useState<Track | null>(null);

  // The first tap anywhere in the app also unlocks the sound effects, so the first in-game cue
  // plays at once.
  useEffect(() => {
    installAudioUnlock();
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastFrameAt = 0;
    let level = 1;
    let duckUntil = 0;
    const step = (now: number) => {
      const elapsed = lastFrameAt ? now - lastFrameAt : 16;
      lastFrameAt = now;
      const ducking = now < duckUntil;
      const travel = (1 - DUCK_LEVEL) * (elapsed / (ducking ? DUCK_ATTACK_MS : DUCK_RELEASE_MS));
      level = ducking ? Math.max(DUCK_LEVEL, level - travel) : Math.min(1, level + travel);
      const audio = audioRef.current;
      if (audio && !audio.paused) audio.volume = baseVolumeRef.current * level;
      if (!ducking && level === 1) {
        frame = 0;
        lastFrameAt = 0;
        return;
      }
      frame = requestAnimationFrame(step);
    };
    const unsubscribe = subscribeToMusicDuck((holdMs) => {
      duckUntil = Math.max(duckUntil, performance.now() + holdMs);
      if (!frame) frame = requestAnimationFrame(step);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track?.active) {
      audio.pause();
      return;
    }

    syncBackgroundMusic(audio, track.volume);
    baseVolumeRef.current = track.volume / 100;

    // Browsers block autoplay until the visitor interacts with the page.
    const startPlayback = () => {
      if (audio.paused && audio.volume > 0) {
        void audio.play().catch(() => undefined);
      }
    };
    document.addEventListener("keydown", startPlayback, true);
    document.addEventListener("pointerdown", startPlayback, true);
    return () => {
      document.removeEventListener("keydown", startPlayback, true);
      document.removeEventListener("pointerdown", startPlayback, true);
    };
  }, [track]);

  return (
    <MusicContext.Provider value={setTrack}>
      {children}
      <audio loop preload="auto" ref={audioRef} src={track?.src} />
    </MusicContext.Provider>
  );
}

function useSetTrack() {
  const setTrack = useContext(MusicContext);
  if (!setTrack) {
    throw new Error("BackgroundMusic must be rendered inside a MusicHost");
  }
  return setTrack;
}

/** Plays `src` on loop while mounted. */
export function BackgroundMusic({ src, volume }: { src: string; volume: number }) {
  const setTrack = useSetTrack();

  useEffect(() => {
    setTrack({ active: true, src, volume });
  }, [setTrack, src, volume]);

  // Deactivating on unmount (not on every volume change) lets the next screen claim the track in
  // the same commit without a gap.
  useEffect(
    () => () => setTrack((current) => current && { ...current, active: false }),
    [setTrack],
  );

  return null;
}
