/**
 * What the cards in the air still owe the screen (components/game/card-flight-layer.tsx).
 *
 * A count that cards fly to or from (a player's cards, a hand card's chip, a bank pile) keeps its
 * old number while they are in the air. It changes as the first of them lands, with the pulse and
 * the "+2", or as the first of them leaves, with the "−1". Only the change still in the air is
 * held back, so anything else that moves a count shows at once, and the game's own count is never
 * touched: what a count shows is the real one less its pending changes.
 *
 * The store also knows which cards each burst carries, so the hand leaves those to the flights,
 * and it tells its missed-listeners about the changes of a burst dropped before they landed, so
 * the hand can show them itself. Nothing is held past its time, a burst's release or
 * MAX_COUNT_HOLD_MS.
 */

/** One count's change: `delta` cards, shown from `at` on. */
export interface CountChange {
  /** When it shows, on the store's clock. */
  at: number;
  /** +2 as cards land, −1 as one leaves. */
  delta: number;
  /** The count, by its flight endpoint's key: "player:p2:resources", "hand:tree", "bank:wheat". */
  target: string;
}

/** A burst as the store holds it. */
export interface HeldBurst {
  actionNumber: number;
  /** The endpoints its cards fly from or to, by key. */
  carried: Iterable<string>;
  changes: readonly CountChange[];
}

export interface CardFlightClock {
  now(): number;
  /** Runs `callback` after `delayMs`; the function it returns cancels it. */
  schedule(callback: () => void, delayMs: number): () => void;
}

/** The longest a count waits for its cards, a queued burst's wait included. */
export const MAX_COUNT_HOLD_MS = 8_000;

/** The store at one moment; a new one after every change, so React can tell it has changed. */
export interface CardFlightSnapshot {
  /** Whether `owner` had been held by then. */
  knows(owner: object): boolean;
  /** The cards still to land on each count less those still to leave it, by target. */
  pending: ReadonlyMap<string, number>;
}

export interface CardFlightStore {
  /** The cards still to land on `target` less those still to leave it. */
  getPending(target: string): number;
  getSnapshot(): CardFlightSnapshot;
  /** Holds a burst's changes until their times, in place of anything it held before. */
  hold(owner: object, burst: HeldBurst): void;
  /** Whether the burst for `actionNumber` carries `target`'s cards, flying or waiting to. */
  isCarried(actionNumber: number, target: string): boolean;
  /** Whether `owner` has been held, even if everything it held has shown since. */
  knows(owner: object): boolean;
  /** Tells the missed-listeners about changes no card will show. */
  miss(changes: readonly CountChange[]): void;
  onMissed(listener: (changes: readonly CountChange[]) => void): () => void;
  /**
   * Shows a burst's changes now and forgets it. With `missed`, the changes that had not shown yet
   * go to the missed-listeners: the burst was dropped before its cards landed.
   */
  release(owner: object, missed?: boolean): void;
  /** Shows every change now and forgets every burst, telling nobody. */
  releaseAll(): void;
  subscribe(listener: () => void): () => void;
}

interface Entry {
  actionNumber: number;
  carried: ReadonlySet<string>;
  /** The changes not shown yet. */
  changes: CountChange[];
  /** The safety net: the entry goes then, whatever it still holds. */
  expiresAt: number;
}

const browserClock: CardFlightClock = {
  now: () => performance.now(),
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

export function createCardFlightStore(clock: CardFlightClock = browserClock): CardFlightStore {
  const entries = new Map<object, Entry>();
  /** Each owner ever held, by the change it was first held in. */
  const knownSince = new WeakMap<object, number>();
  const listeners = new Set<() => void>();
  const missedListeners = new Set<(changes: readonly CountChange[]) => void>();
  let cancelTimer: (() => void) | null = null;
  /** Counts the changes; each snapshot belongs to one. */
  let generation = 0;
  let snapshot: CardFlightSnapshot | null = null;

  const notify = () => {
    generation += 1;
    snapshot = null;
    for (const listener of listeners) listener();
  };

  const getPending = (target: string) => {
    let pending = 0;
    for (const entry of entries.values()) {
      for (const change of entry.changes) {
        if (change.target === target) pending += change.delta;
      }
    }
    return pending;
  };

  const tellMissed = (changes: readonly CountChange[]) => {
    if (changes.length > 0) {
      for (const listener of missedListeners) listener(changes);
    }
  };

  /** Shows what is due and drops what has expired; true if any count changes. */
  const settle = (): boolean => {
    const now = clock.now();
    let changed = false;
    for (const [owner, entry] of entries) {
      if (entry.expiresAt <= now) {
        entries.delete(owner);
        changed ||= entry.changes.length > 0;
        continue;
      }
      const pending = entry.changes.filter((change) => change.at > now);
      if (pending.length !== entry.changes.length) {
        entry.changes = pending;
        changed = true;
      }
    }
    return changed;
  };

  /** One timer, for the next change due or entry to expire. */
  const schedule = () => {
    cancelTimer?.();
    cancelTimer = null;
    let next = Number.POSITIVE_INFINITY;
    for (const entry of entries.values()) {
      next = Math.min(next, entry.expiresAt, ...entry.changes.map((change) => change.at));
    }
    if (next === Number.POSITIVE_INFINITY) {
      return;
    }
    cancelTimer = clock.schedule(
      () => {
        cancelTimer = null;
        if (settle()) {
          notify();
        }
        schedule();
      },
      Math.max(0, next - clock.now()),
    );
  };

  return {
    getPending,
    getSnapshot() {
      if (!snapshot) {
        const pending = new Map<string, number>();
        for (const entry of entries.values()) {
          for (const { delta, target } of entry.changes) {
            pending.set(target, (pending.get(target) ?? 0) + delta);
          }
        }
        const at = generation;
        snapshot = {
          knows: (owner) => (knownSince.get(owner) ?? Number.POSITIVE_INFINITY) <= at,
          pending,
        };
      }
      return snapshot;
    },
    hold(owner, { actionNumber, carried, changes }) {
      if (!knownSince.has(owner)) {
        knownSince.set(owner, generation + 1);
      }
      const now = clock.now();
      entries.set(owner, {
        actionNumber,
        carried: new Set(carried),
        changes: changes.filter((change) => change.delta !== 0 && change.at > now),
        expiresAt: now + MAX_COUNT_HOLD_MS,
      });
      notify();
      schedule();
    },
    isCarried(actionNumber, target) {
      for (const entry of entries.values()) {
        if (entry.actionNumber === actionNumber && entry.carried.has(target)) {
          return true;
        }
      }
      return false;
    },
    knows(owner) {
      return knownSince.has(owner);
    },
    miss: tellMissed,
    onMissed(listener) {
      missedListeners.add(listener);
      return () => {
        missedListeners.delete(listener);
      };
    },
    release(owner, missed = false) {
      const entry = entries.get(owner);
      if (!entry) {
        return;
      }
      entries.delete(owner);
      schedule();
      if (entry.changes.length > 0) {
        notify();
        if (missed) tellMissed(entry.changes);
      }
    },
    releaseAll() {
      const held = [...entries.values()].some((entry) => entry.changes.length > 0);
      entries.clear();
      cancelTimer?.();
      cancelTimer = null;
      if (held) {
        notify();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
