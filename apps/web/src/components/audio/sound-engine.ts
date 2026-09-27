import {
  createCueGate,
  getCueVariation,
  SOUND_EFFECT_MIX,
  SOUND_EFFECT_PATHS,
  SOUND_EFFECTS,
  type SoundEffect,
} from "@/lib/game/audio-cues";

/**
 * Plays sound effects through one shared Web Audio context. Each cue is fetched and decoded once,
 * so a play starts in a few milliseconds instead of waiting on an <audio> element to seek and
 * buffer. Until the first gesture unlocks the context, where Web Audio is missing, or while a cue's
 * file has not loaded, cues fall back to <audio> elements. A cue whose fetch failed is fetched again
 * on a later play, after a short wait that doubles with each failure. While sound effects are
 * muted the context is suspended, so it holds no audio output open.
 */

type AudioContextConstructor = typeof AudioContext;

/** The wait before refetching a cue after its first failed fetch; it doubles up to the cap. */
const FETCH_RETRY_BASE_MS = 1_000;
const FETCH_RETRY_MAX_MS = 30_000;

interface FetchFailure {
  attempts: number;
  /** `performance.now()` time from which a play may fetch the cue again. */
  retryAt: number;
}

interface EngineState {
  bus: GainNode | null;
  context: AudioContext | null;
  decoded: Map<SoundEffect, AudioBuffer>;
  decoding: Map<SoundEffect, Promise<void>>;
  encoded: Map<SoundEffect, Promise<ArrayBuffer | null>>;
  fallbacks: Map<SoundEffect, HTMLAudioElement>;
  fetchFailures: Map<SoundEffect, FetchFailure>;
  muted: boolean;
  unlockInstalled: boolean;
}

const engine: EngineState = {
  bus: null,
  context: null,
  decoded: new Map(),
  decoding: new Map(),
  encoded: new Map(),
  fallbacks: new Map(),
  fetchFailures: new Map(),
  muted: false,
  unlockInstalled: false,
};
const gate = createCueGate();
const duckListeners = new Set<(holdMs: number) => void>();

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const webkitWindow = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? webkitWindow.webkitAudioContext ?? null;
}

/** Only called from a user gesture, so browsers let the context start. */
function ensureContext(): AudioContext | null {
  if (engine.context) return engine.context;
  const Context = audioContextConstructor();
  if (!Context) return null;
  try {
    const context = new Context({ latencyHint: "interactive" });
    // A safety limiter on the effects bus: single cues peak below its threshold, so it only acts
    // when several cues land together.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const bus = context.createGain();
    bus.connect(limiter).connect(context.destination);
    engine.context = context;
    engine.bus = bus;
  } catch {
    return null;
  }
  for (const sound of engine.encoded.keys()) void decode(sound);
  return engine.context;
}

/**
 * The cue's file, fetched once. A failed fetch resolves to null and is forgotten, so a later call
 * fetches again, once the backoff since the last failure has passed; until then this resolves to
 * null without a request.
 */
function fetchEncoded(sound: SoundEffect): Promise<ArrayBuffer | null> {
  const cached = engine.encoded.get(sound);
  if (cached) return cached;
  const failure = engine.fetchFailures.get(sound);
  if (failure && performance.now() < failure.retryAt) return Promise.resolve(null);

  const request: Promise<ArrayBuffer | null> = fetch(SOUND_EFFECT_PATHS[sound])
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => {
      engine.fetchFailures.delete(sound);
      return data;
    })
    .catch(() => {
      if (engine.encoded.get(sound) === request) engine.encoded.delete(sound);
      const attempts = (failure?.attempts ?? 0) + 1;
      const waitMs = Math.min(FETCH_RETRY_BASE_MS * 2 ** (attempts - 1), FETCH_RETRY_MAX_MS);
      engine.fetchFailures.set(sound, { attempts, retryAt: performance.now() + waitMs });
      return null;
    });
  engine.encoded.set(sound, request);
  return request;
}

function decode(sound: SoundEffect): Promise<void> {
  const context = engine.context;
  if (!context || engine.decoded.has(sound)) return Promise.resolve();
  let pending = engine.decoding.get(sound);
  if (!pending) {
    pending = fetchEncoded(sound)
      .then(async (data) => {
        if (!data) {
          // The fetch failed (or is waiting out its backoff); the cue's next play tries again.
          engine.decoding.delete(sound);
          return;
        }
        // decodeAudioData detaches its input; the copy keeps the fetched bytes reusable.
        engine.decoded.set(sound, await context.decodeAudioData(data.slice(0)));
      })
      .catch(() => {
        // The <audio> fallback still plays a cue that failed to decode.
        engine.decoding.delete(sound);
      });
    engine.decoding.set(sound, pending);
  }
  return pending;
}

function unlock() {
  const context = ensureContext();
  if (!context) return;
  if (context.state !== "running") {
    void context.resume().catch(() => undefined);
  }
  // iOS Safari starts output only once a buffer plays inside the gesture.
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.start();
  } catch {
    // Nothing to unlock on this browser.
  }
}

/**
 * Starts or resumes the shared context on the next gesture. The listeners stay, because mobile
 * browsers suspend the context again when the page goes to the background.
 */
export function installAudioUnlock(): void {
  if (engine.unlockInstalled || typeof document === "undefined") return;
  engine.unlockInstalled = true;
  const onGesture = () => {
    if (!engine.muted && engine.context?.state !== "running") unlock();
  };
  for (const type of ["pointerdown", "keydown", "touchend"]) {
    document.addEventListener(type, onGesture, { capture: true, passive: true });
  }
}

/** Fetches every cue now and decodes it as soon as the context exists. */
export function preloadSoundEffects(sounds: readonly SoundEffect[] = SOUND_EFFECTS): void {
  if (typeof window === "undefined") return;
  for (const sound of sounds) {
    void fetchEncoded(sound);
    void decode(sound);
  }
}

/**
 * Suspends the shared context while sound effects are muted, and resumes it when they are not. A
 * resume the browser refuses (no gesture yet) happens on the next gesture instead.
 */
export function setSoundEffectsMuted(muted: boolean): void {
  if (engine.muted === muted) return;
  engine.muted = muted;
  const context = engine.context;
  if (!context || context.state === "closed") return;
  if (muted) {
    void context.suspend().catch(() => undefined);
  } else if (context.state !== "running") {
    void context.resume().catch(() => undefined);
  }
}

/** Lets the music host dip the music while a big cue plays. Returns the unsubscribe. */
export function subscribeToMusicDuck(listener: (holdMs: number) => void): () => void {
  duckListeners.add(listener);
  return () => {
    duckListeners.delete(listener);
  };
}

function playFallback(sound: SoundEffect, level: number) {
  let audio = engine.fallbacks.get(sound);
  if (!audio) {
    audio = new Audio(SOUND_EFFECT_PATHS[sound]);
    audio.preload = "auto";
    engine.fallbacks.set(sound, audio);
  }
  audio.currentTime = 0;
  audio.volume = Math.min(1, level);
  void audio.play().catch(() => undefined);
}

/**
 * Plays `sound` at `volume` (0 to 100, the sound effects setting). Zero is muted. Repeats inside a
 * cue's cooldown are dropped, so a burst of identical events plays one cue.
 */
export function playSoundEffect(sound: SoundEffect, volume: number): void {
  if (typeof window === "undefined" || volume <= 0) return;
  if (!gate.tryStart(sound, performance.now())) return;

  const { gain, playbackRate } = getCueVariation(sound);
  const level = (Math.min(100, volume) / 100) * gain;
  const { bus, context } = engine;
  const buffer = engine.decoded.get(sound);

  if (context && bus && buffer && context.state === "running") {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    const voice = context.createGain();
    voice.gain.value = level;
    source.connect(voice).connect(bus);
    source.addEventListener("ended", () => voice.disconnect(), { once: true });
    source.start();
  } else {
    if (context) void decode(sound);
    playFallback(sound, level);
  }

  const { duckMs } = SOUND_EFFECT_MIX[sound];
  if (duckMs > 0) {
    for (const listener of duckListeners) listener(duckMs);
  }
}
