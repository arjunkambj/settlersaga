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

import { syncBackgroundMusic } from "@/lib/background-music";

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
  const [track, setTrack] = useState<Track | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track?.active) {
      audio.pause();
      return;
    }

    syncBackgroundMusic(audio, track.volume);

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
