"use client";

import type { PlayerGameView } from "@settersaga/game";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createCardFlightStore,
  type CardFlightSnapshot,
  type CardFlightStore,
} from "@/lib/game/card-flight-store";
import {
  getFlightCountChanges,
  trackCardFlights,
  type CardFlightPlan,
  type FlightCountChange,
} from "@/lib/game/card-flights";
import type { RoomEventView } from "@/lib/game/types";

/** A move's cards, from the view that brings them until the flight layer takes them. */
export interface IncomingCardFlights {
  actionNumber: number;
  /** Each count's change, from the burst's start. */
  changes: readonly FlightCountChange[];
  plan: CardFlightPlan;
  viewerPlayerId: string;
}

export interface CardFlights {
  /** The newest view's burst; held whole until the layer takes it into the store. */
  incoming: IncomingCardFlights | null;
  store: CardFlightStore;
}

interface CardFlightState extends CardFlights {
  /** `incoming`'s changes by count. */
  incomingPending: ReadonlyMap<string, number>;
}

const CardFlightContext = createContext<CardFlightState | null>(null);

/**
 * Works out, as each view renders, whether its move flies cards (lib/game/card-flights.ts), so
 * the counts the cards will change hold their old numbers from the view's first paint. The flight
 * layer then plays the burst and the store lets each count change as its cards land or leave.
 */
export function CardFlightProvider({
  children,
  events,
  game,
  isConnected,
}: {
  children: ReactNode;
  events: readonly RoomEventView[];
  game: PlayerGameView;
  isConnected: boolean;
}) {
  const [store] = useState(() => createCardFlightStore());
  const [tracker, setTracker] = useState(() =>
    trackCardFlights(null, { events, game, isConnected, now: performance.now(), visible: true }),
  );
  let current = tracker;
  if (
    tracker.game !== game ||
    tracker.lastEventId !== events.at(-1)?.id ||
    tracker.wasConnected !== isConnected
  ) {
    current = trackCardFlights(tracker, {
      events,
      game,
      isConnected,
      now: performance.now(),
      visible: document.visibilityState !== "hidden",
    });
    setTracker(current);
  }

  const incoming = useMemo<IncomingCardFlights | null>(
    () =>
      current.plan && {
        actionNumber: current.game.actionNumber,
        changes: getFlightCountChanges(current.plan, current.game.viewerPlayerId),
        plan: current.plan,
        viewerPlayerId: current.game.viewerPlayerId,
      },
    [current],
  );
  const value = useMemo<CardFlightState>(() => {
    const incomingPending = new Map<string, number>();
    for (const change of incoming?.changes ?? []) {
      incomingPending.set(change.target, (incomingPending.get(change.target) ?? 0) + change.delta);
    }
    return { incoming, incomingPending, store };
  }, [incoming, store]);

  // After the layer's own layout effect: a burst it did not take (no layer is showing) shows at once.
  useLayoutEffect(() => {
    if (incoming && !store.knows(incoming.plan)) {
      store.hold(incoming.plan, { actionNumber: incoming.actionNumber, carried: [], changes: [] });
    }
  }, [incoming, store]);
  useEffect(() => () => store.releaseAll(), [store]);

  return <CardFlightContext.Provider value={value}>{children}</CardFlightContext.Provider>;
}

export function useCardFlights(): CardFlights | null {
  return useContext(CardFlightContext);
}

const subscribeToNothing = () => () => {};

/**
 * The number to show for a count cards fly to or from: the real `count` less what is still in the
 * air, so it changes as they land or leave. Only for what is seen: accessible names and tooltips
 * keep the real count.
 */
export function useShownCount(target: string | null, count: number): number {
  const state = useContext(CardFlightContext);
  const pending = useSyncExternalStore(
    state?.store.subscribe ?? subscribeToNothing,
    () => (state && target ? getPending(state, state.store.getSnapshot(), target) : 0),
    () => 0,
  );
  return Math.max(0, count - pending);
}

/**
 * `useShownCount` for a component that shows several counts, re-rendering only when one of
 * `targets` changes: shown(target, count).
 */
export function useShownCounts(
  targets: readonly string[],
): (target: string, count: number) => number {
  const state = useContext(CardFlightContext);
  // One string, so an unchanged set of counts leaves the component alone.
  const pendingList = useSyncExternalStore(
    state?.store.subscribe ?? subscribeToNothing,
    () =>
      state
        ? targets.map((target) => getPending(state, state.store.getSnapshot(), target)).join()
        : "",
    () => "",
  );
  const pending = pendingList.split(",").map(Number);
  return (target, count) => Math.max(0, count - (pending[targets.indexOf(target)] || 0));
}

/** What is still in the air for `target`: all of the newest view's changes until the layer takes them. */
function getPending(
  { incoming, incomingPending }: CardFlightState,
  snapshot: CardFlightSnapshot,
  target: string,
): number {
  const waiting =
    incoming && !snapshot.knows(incoming.plan) ? (incomingPending.get(target) ?? 0) : 0;
  return (snapshot.pending.get(target) ?? 0) + waiting;
}
