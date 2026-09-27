/// <reference lib="dom" />

import { afterAll, describe, expect, spyOn, test } from "bun:test";

/** A stand-in for the browser's AudioContext, recording what the engine asks of it. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  destination = {};
  sampleRate = 44_100;
  started = 0;
  state: AudioContextState = "suspended";

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createBuffer() {
    return {};
  }
  createBufferSource() {
    return {
      addEventListener() {},
      buffer: null,
      connect: (node: unknown) => node,
      playbackRate: { value: 1 },
      start: () => {
        this.started += 1;
      },
    };
  }
  createDynamicsCompressor() {
    const param = () => ({ value: 0 });
    return {
      attack: param(),
      connect: (node: unknown) => node,
      knee: param(),
      ratio: param(),
      release: param(),
      threshold: param(),
    };
  }
  createGain() {
    return { connect: (node: unknown) => node, disconnect() {}, gain: { value: 1 } };
  }
  decodeAudioData(data: ArrayBuffer) {
    return Promise.resolve({ length: data.byteLength });
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
}

const gestureListeners: (() => void)[] = [];
let fallbackPlays = 0;
let fetchCount = 0;
let fetchWorks = false;
let now = 0;

const globals = globalThis as unknown as Record<string, unknown>;
const saved = Object.fromEntries(
  ["Audio", "document", "fetch", "window"].map((key) => [key, globals[key]]),
);
globals.window = { AudioContext: FakeAudioContext };
globals.document = {
  addEventListener(_type: string, listener: () => void) {
    gestureListeners.push(listener);
  },
};
globals.Audio = class {
  currentTime = 0;
  preload = "";
  volume = 1;
  play() {
    fallbackPlays += 1;
    return Promise.resolve();
  }
};
globals.fetch = () => {
  fetchCount += 1;
  return Promise.resolve(
    fetchWorks
      ? new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      : new Response(null, { status: 503 }),
  );
};
const clock = spyOn(performance, "now").mockImplementation(() => now);

const { installAudioUnlock, playSoundEffect, preloadSoundEffects, setSoundEffectsMuted } =
  await import("../src/components/audio/sound-engine");

afterAll(() => {
  clock.mockRestore();
  Object.assign(globals, saved);
});

async function settle() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

function gesture() {
  for (const listener of gestureListeners) listener();
}

describe("sound engine", () => {
  test("refetches a cue whose first fetch failed on a later play, after a backoff", async () => {
    installAudioUnlock();
    preloadSoundEffects(["action"]);
    await settle();
    expect(fetchCount).toBe(1);

    gesture();
    const [context] = FakeAudioContext.instances;
    expect(context?.state).toBe("running");

    // Inside the backoff the cue plays through <audio> and is not fetched again.
    now = 500;
    playSoundEffect("action", 50);
    await settle();
    expect(fallbackPlays).toBe(1);
    expect(fetchCount).toBe(1);

    // After it, the next play fetches the cue again; once decoded it plays through Web Audio.
    fetchWorks = true;
    now = 1_200;
    playSoundEffect("action", 50);
    await settle();
    expect(fallbackPlays).toBe(2);
    expect(fetchCount).toBe(2);

    now = 1_500;
    playSoundEffect("action", 50);
    expect(context?.started).toBe(2); // the unlock blip, then the cue
    expect(fallbackPlays).toBe(2);
  });

  test("suspends the context while muted and resumes it when unmuted", () => {
    const [context] = FakeAudioContext.instances;
    setSoundEffectsMuted(true);
    expect(context?.state).toBe("suspended");

    // A gesture while muted leaves it suspended.
    gesture();
    expect(context?.state).toBe("suspended");

    setSoundEffectsMuted(false);
    expect(context?.state).toBe("running");
  });
});
