"use client";

import musicIcon from "@iconify-icons/solar/music-note-2-bold";
import volumeIcon from "@iconify-icons/solar/volume-loud-bold";
import { Icon } from "@iconify/react/offline";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { AudioSettings } from "@/lib/audio-settings";

const AUDIO_CHANNELS = [
  { icon: musicIcon, key: "lobbyMusicVolume", label: "Music" },
  { icon: volumeIcon, key: "soundEffectsVolume", label: "Sound effects" },
] as const;

export function AudioSettingsControls({
  onChange,
  settings,
}: {
  onChange(settings: AudioSettings): void;
  settings: AudioSettings;
}) {
  return (
    <section aria-labelledby="audio-settings-title" className="flex flex-col gap-3">
      <h3 className="font-display text-base tracking-wide" id="audio-settings-title">
        Sound
      </h3>
      {AUDIO_CHANNELS.map((channel) => (
        <div className="flex flex-col gap-2" key={channel.key}>
          <Label className="gap-2 text-sm font-semibold" htmlFor={`${channel.key}-slider`}>
            <Icon aria-hidden="true" className="size-4 text-accent" icon={channel.icon} />
            {channel.label}
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              className="flex-1"
              id={`${channel.key}-slider`}
              max={100}
              min={0}
              onValueChange={(value) => {
                const nextVolume = Array.isArray(value) ? value[0] : value;
                onChange({ ...settings, [channel.key]: nextVolume });
              }}
              step={1}
              value={[settings[channel.key]]}
            />
            <output className="w-12 rounded-full bg-well py-0.5 text-center font-display text-sm tabular-nums inset-shadow-well">
              {settings[channel.key]}%
            </output>
          </div>
        </div>
      ))}
    </section>
  );
}
