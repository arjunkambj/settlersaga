"use client";

import { Button } from "@/components/ui/button";
import pauseIcon from "@iconify-icons/solar/pause-bold-duotone";
import playIcon from "@iconify-icons/solar/play-bold-duotone";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

export function AudioPlayButton({ name, src }: { name: string; src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play().catch(() => setIsPlaying(false));
      return;
    }

    audio.pause();
  };

  return (
    <>
      <Button
        aria-label={isPlaying ? `Pause ${name}` : `Play ${name}`}
        aria-pressed={isPlaying}
        className="gap-1.5 px-3 py-1 h-8 text-xs font-semibold rounded-lg"
        onClick={togglePlayback}
        size="sm"
        variant="secondary"
      >
        <Icon aria-hidden="true" icon={isPlaying ? pauseIcon : playIcon} />
        {isPlaying ? "Pause" : "Play"}
      </Button>
      <audio
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        preload="metadata"
        ref={audioRef}
        src={src}
      />
    </>
  );
}
