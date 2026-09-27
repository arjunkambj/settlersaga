import { describe, expect, test } from "bun:test";

import {
  createCardFlightStore,
  MAX_COUNT_HOLD_MS,
  type CardFlightClock,
  type CountChange,
} from "../src/lib/game/card-flight-store";

/** A clock the test moves by hand; its timers fire, in order, as it passes them. */
function createFakeClock() {
  let now = 1_000;
  let nextId = 0;
  let timers: { at: number; callback: () => void; id: number }[] = [];
  const clock: CardFlightClock = {
    now: () => now,
    schedule(callback, delayMs) {
      const id = nextId++;
      timers.push({ at: now + delayMs, callback, id });
      return () => {
        timers = timers.filter((timer) => timer.id !== id);
      };
    },
  };
  return {
    advance(ms: number) {
      const until = now + ms;
      for (;;) {
        const [due] = timers
          .filter((timer) => timer.at <= until)
          .sort((left, right) => left.at - right.at);
        if (!due) break;
        timers = timers.filter((timer) => timer !== due);
        now = due.at;
        due.callback();
      }
      now = until;
    },
    clock,
    get now() {
      return now;
    },
    get timerCount() {
      return timers.length;
    },
  };
}

function setup() {
  const time = createFakeClock();
  const store = createCardFlightStore(time.clock);
  let notified = 0;
  store.subscribe(() => {
    notified += 1;
  });
  const missed: CountChange[][] = [];
  store.onMissed((changes) => missed.push([...changes]));
  return { missed, notified: () => notified, store, time };
}

const P2 = "player:p2:resources";

describe("card flight store", () => {
  test("a count holds its change until its cards land, then shows it", () => {
    const { notified, store, time } = setup();
    const owner = {};
    store.hold(owner, {
      actionNumber: 7,
      carried: [P2],
      changes: [{ at: time.now + 720, delta: 2, target: P2 }],
    });
    expect(store.getPending(P2)).toBe(2);
    expect(store.getPending("player:p3:resources")).toBe(0);
    const heldAt = notified();

    time.advance(719);
    expect(store.getPending(P2)).toBe(2);
    expect(notified()).toBe(heldAt);
    time.advance(1);
    expect(store.getPending(P2)).toBe(0);
    expect(notified()).toBe(heldAt + 1);
    // Still carried until the burst is released, so the hand leaves its cards alone.
    expect(store.isCarried(7, P2)).toBe(true);
  });

  test("a count that loses and gains in one burst steps down as cards leave, up as they land", () => {
    const { store, time } = setup();
    const owner = {};
    // Waiting its turn: nothing has left or landed.
    store.hold(owner, {
      actionNumber: 3,
      carried: [P2],
      changes: [
        { at: Number.POSITIVE_INFINITY, delta: -4, target: P2 },
        { at: Number.POSITIVE_INFINITY, delta: 1, target: P2 },
      ],
    });
    expect(store.getPending(P2)).toBe(-3);

    // Playing: the four leave now, the one lands a second later.
    store.hold(owner, {
      actionNumber: 3,
      carried: [P2],
      changes: [
        { at: time.now, delta: -4, target: P2 },
        { at: time.now + 1_000, delta: 1, target: P2 },
      ],
    });
    expect(store.getPending(P2)).toBe(1);
    time.advance(1_000);
    expect(store.getPending(P2)).toBe(0);
  });

  test("bursts add up, and each shows its own changes at its own time", () => {
    const { store, time } = setup();
    const first = {};
    const second = {};
    store.hold(first, {
      actionNumber: 1,
      carried: [],
      changes: [{ at: time.now + 500, delta: 2, target: P2 }],
    });
    store.hold(second, {
      actionNumber: 2,
      carried: [],
      changes: [{ at: time.now + 1_500, delta: 1, target: P2 }],
    });
    expect(store.getPending(P2)).toBe(3);
    time.advance(500);
    expect(store.getPending(P2)).toBe(1);
    time.advance(1_000);
    expect(store.getPending(P2)).toBe(0);
    expect(time.timerCount).toBe(1);
  });

  test("a dropped burst shows its counts at once and tells what never landed", () => {
    const { missed, notified, store, time } = setup();
    const owner = {};
    const tree = { at: time.now + 700, delta: 1, target: "hand:tree" };
    const row = { at: time.now + 700, delta: 1, target: "player:p1:resources" };
    const bank = { at: time.now, delta: -1, target: "bank:tree" };
    store.hold(owner, { actionNumber: 4, carried: ["hand:tree"], changes: [bank, tree, row] });
    time.advance(300);
    const before = notified();

    store.release(owner, true);
    expect(store.getPending("hand:tree")).toBe(0);
    expect(store.getPending("player:p1:resources")).toBe(0);
    expect(store.isCarried(4, "hand:tree")).toBe(false);
    expect(notified()).toBe(before + 1);
    // Only what had not shown yet; the bank's card had already left.
    expect(missed).toEqual([[tree, row]]);
  });

  test("a burst released after its cards landed, or without `missed`, tells nobody", () => {
    const { missed, store, time } = setup();
    const landed = {};
    store.hold(landed, {
      actionNumber: 1,
      carried: [],
      changes: [{ at: time.now + 100, delta: 1, target: P2 }],
    });
    time.advance(100);
    store.release(landed, true);

    const cut = {};
    store.hold(cut, {
      actionNumber: 2,
      carried: [],
      changes: [{ at: time.now + 100, delta: 1, target: P2 }],
    });
    store.release(cut);
    expect(store.getPending(P2)).toBe(0);
    expect(missed).toEqual([]);
  });

  test("releasing everything shows every count, tells nobody and leaves no timer", () => {
    const { missed, store, time } = setup();
    store.hold(
      {},
      { actionNumber: 1, carried: [P2], changes: [{ at: time.now + 400, delta: 2, target: P2 }] },
    );
    store.hold(
      {},
      {
        actionNumber: 2,
        carried: [],
        changes: [{ at: Number.POSITIVE_INFINITY, delta: -1, target: "bank:wheat" }],
      },
    );

    store.releaseAll();
    expect(store.getPending(P2)).toBe(0);
    expect(store.getPending("bank:wheat")).toBe(0);
    expect(store.isCarried(1, P2)).toBe(false);
    expect(missed).toEqual([]);
    expect(time.timerCount).toBe(0);
  });

  test("nothing is held past the safety timeout, even a burst that never plays", () => {
    const { notified, store, time } = setup();
    store.hold(
      {},
      {
        actionNumber: 5,
        carried: ["hand:stone"],
        changes: [{ at: Number.POSITIVE_INFINITY, delta: 1, target: "hand:stone" }],
      },
    );
    const heldAt = notified();

    time.advance(MAX_COUNT_HOLD_MS - 1);
    expect(store.getPending("hand:stone")).toBe(1);
    time.advance(1);
    expect(store.getPending("hand:stone")).toBe(0);
    expect(store.isCarried(5, "hand:stone")).toBe(false);
    expect(notified()).toBe(heldAt + 1);
    expect(time.timerCount).toBe(0);
  });

  test("a change already due shows at once, and a hold with nothing left only marks the burst", () => {
    const { store, time } = setup();
    const owner = {};
    store.hold(owner, {
      actionNumber: 9,
      carried: ["hand:brick"],
      changes: [
        { at: time.now, delta: -2, target: "hand:brick" },
        { at: time.now - 5, delta: 1, target: P2 },
      ],
    });
    expect(store.getPending("hand:brick")).toBe(0);
    expect(store.getPending(P2)).toBe(0);
    expect(store.isCarried(9, "hand:brick")).toBe(true);
    expect(store.isCarried(8, "hand:brick")).toBe(false);
    expect(store.isCarried(9, "hand:tree")).toBe(false);
    expect(store.knows(owner)).toBe(true);
    expect(store.knows({})).toBe(false);
  });

  test("a snapshot stays the same until a count changes, and knows only what was held by then", () => {
    const time = createFakeClock();
    const store = createCardFlightStore(time.clock);
    let calls = 0;
    const leave = store.subscribe(() => {
      calls += 1;
    });
    const owner = {};
    const empty = store.getSnapshot();
    expect(store.getSnapshot()).toBe(empty);

    store.hold(owner, {
      actionNumber: 1,
      carried: [],
      changes: [{ at: time.now + 50, delta: 1, target: P2 }],
    });
    const held = store.getSnapshot();
    expect(held).not.toBe(empty);
    expect(held.pending.get(P2)).toBe(1);
    expect(held.knows(owner)).toBe(true);
    expect(empty.knows(owner)).toBe(false);
    expect(empty.pending.get(P2)).toBeUndefined();

    time.advance(50);
    const landed = store.getSnapshot();
    expect(landed).not.toBe(held);
    expect(landed.pending.get(P2)).toBeUndefined();
    expect(landed.knows(owner)).toBe(true);
    expect(calls).toBe(2);

    leave();
    store.hold(
      {},
      { actionNumber: 2, carried: [], changes: [{ at: time.now + 50, delta: 1, target: P2 }] },
    );
    expect(calls).toBe(2);
  });
});
