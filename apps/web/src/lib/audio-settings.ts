export interface AudioSettings {
  lobbyMusicVolume: number;
  soundEffectsVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  lobbyMusicVolume: 21,
  soundEffectsVolume: 65,
};

const AUDIO_SETTINGS_STORAGE_KEY = "settersaga:audio-settings";

function normalizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(Math.min(100, Math.max(0, value)));
}

export function normalizeAudioSettings(value: Partial<AudioSettings>): AudioSettings {
  return {
    lobbyMusicVolume: normalizeVolume(
      value.lobbyMusicVolume,
      DEFAULT_AUDIO_SETTINGS.lobbyMusicVolume,
    ),
    soundEffectsVolume: normalizeVolume(
      value.soundEffectsVolume,
      DEFAULT_AUDIO_SETTINGS.soundEffectsVolume,
    ),
  };
}

export function readAudioSettings(storage: Pick<Storage, "getItem">): AudioSettings {
  try {
    const serialized = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (serialized === null) {
      return DEFAULT_AUDIO_SETTINGS;
    }

    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_AUDIO_SETTINGS;
    }

    return normalizeAudioSettings(parsed as Partial<AudioSettings>);
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function writeAudioSettings(
  storage: Pick<Storage, "setItem">,
  settings: AudioSettings,
): void {
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
  } catch {
    // The selected audio settings still apply for this visit when storage is unavailable.
  }
}
