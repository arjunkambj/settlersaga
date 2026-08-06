"use client";
import musicIcon from "@iconify-icons/solar/music-note-2-bold-duotone";
import volumeIcon from "@iconify-icons/solar/volume-loud-outline";
import { Icon } from "@iconify/react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { AudioSettings } from "@/lib/audio-settings";

const AUDIO_CHANNELS = [
  {
    icon: musicIcon,
    key: "lobbyMusicVolume",
    label: "Lobby Music",
  },
  {
    icon: volumeIcon,
    key: "soundEffectsVolume",
    label: "Sound Effects",
  },
] as const;

export function AudioSettingsControls({
  onChange,
  settings,
}: {
  onChange(settings: AudioSettings): void;
  settings: AudioSettings;
}) {
  return (
    <section aria-labelledby="audio-settings-title" className="space-y-4">
      <h3 className="text-sm font-semibold" id="audio-settings-title">
        Audio
      </h3>
      {AUDIO_CHANNELS.map((channel) => (
        <div key={channel.key} className="space-y-2">
          <Label
            htmlFor={`${channel.key}-slider`}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Icon aria-hidden="true" icon={channel.icon} /> {channel.label}
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              id={`${channel.key}-slider`}
              max={100}
              min={0}
              step={1}
              value={[settings[channel.key]]}
              onValueChange={(value) => {
                const nextVolume = Array.isArray(value) ? value[0] : value;
                onChange({ ...settings, [channel.key]: nextVolume });
              }}
              className="flex-1"
            />
            <output className="text-sm font-mono text-muted-foreground">
              {settings[channel.key]}%
            </output>
          </div>
        </div>
      ))}
    </section>
  );
}
