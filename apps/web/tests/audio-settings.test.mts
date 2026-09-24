import { describe, expect, test } from "bun:test";

import {
  DEFAULT_AUDIO_SETTINGS,
  normalizeAudioSettings,
  readAudioSettings,
  writeAudioSettings,
} from "../src/lib/audio-settings";

describe("audio settings", () => {
  test("normalizes each channel independently", () => {
    expect(
      normalizeAudioSettings({
        lobbyMusicVolume: 42.6,
        soundEffectsVolume: 150,
      }),
    ).toEqual({
      lobbyMusicVolume: 43,
      soundEffectsVolume: 100,
    });
  });

  test("falls back safely when stored settings are invalid", () => {
    expect(readAudioSettings({ getItem: () => "not-json" })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(readAudioSettings({ getItem: () => JSON.stringify({ lobbyMusicVolume: 20 }) })).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      lobbyMusicVolume: 20,
    });
  });

  test("writes normalized settings as one value", () => {
    let stored = "";
    writeAudioSettings(
      { setItem: (_key, value) => (stored = value) },
      { lobbyMusicVolume: 150, soundEffectsVolume: -3.2 },
    );

    expect(JSON.parse(stored)).toEqual({
      lobbyMusicVolume: 100,
      soundEffectsVolume: 0,
    });
  });
});
