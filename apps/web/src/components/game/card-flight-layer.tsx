"use client";

import { getImageProps } from "next/image";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import {
  DEVELOPMENT_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import type { CardFlightStore, CountChange } from "@/lib/game/card-flight-store";
import {
  CARD_FLIGHT_TIMING,
  getFlightCountChanges,
  getFlightEndpointKey,
  getFlightEndpointKeys,
  type CardFlight,
  type FlightCard,
  type FlightCountChange,
  type FlightEndpoint,
} from "@/lib/game/card-flights";

import { useCardFlights, type IncomingCardFlights } from "./card-flight-context";
import type { BoardScreenPoints } from "./game-board";

/** The flying card, at the art's 2:3, a little larger on a wide table (styles/game-flights.css). */
const SPRITE_SIZES = {
  compact: { height: 48, width: 32 },
  wide: { height: 54, width: 36 },
} as const;
const WIDE_SPRITE_QUERY = "(width >= 80rem)";
/** Positions sampled along the arc; the browser eases between them. */
const ARC_STEPS = 10;
const PULSE_MS = 360;
/** Between a hand card's top edge and the middle of its "+1". */
const LABEL_GAP = 14;
/** Between a player's pill and the middle of its "+1", when it shows no card count to sit by. */
const LABEL_DROP = 6;
/**
 * A "+1" on a player's card count ends this far past the card icon, short of the number beside it,
 * and sits this much below the icon's middle, so even as it rises it stays off the name above.
 */
const ICON_LABEL_OVERHANG = 3;
const ICON_LABEL_SETTLE = 3;
/** How far a tile's card pops above the tile's middle, as a share of its height: clear of the number. */
const TILE_POP_LIFT = 0.6;
/** More bursts than this waiting: skip to the newest. */
const MAX_QUEUED_BURSTS = 3;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface Point {
  x: number;
  y: number;
}

type SpriteSize = (typeof SPRITE_SIZES)[keyof typeof SPRITE_SIZES];

interface FlightTarget {
  /**
   * Where "+1" goes: its middle just below a player's pill or just above a hand card or the bank,
   * or its end (`labelEnd`) on the card icon of a player's card count.
   */
  labelEnd: boolean;
  labelPoint: Point;
  point: Point;
  /** The count that brightens as cards land, if the endpoint has one. */
  pulse: Element | null;
}

/** Where a label sits: above or below the target, or over its card icon. */
type LabelPlace = "above" | "below" | { icon: Element };

interface CardFlightDirector {
  enqueue(burst: IncomingCardFlights): void;
  stop(): void;
}

/**
 * Cards that fly between the board, the bank and the players as moves land, so anyone can tell
 * who got what and from where. A fixed layer over the HUD that nothing can click, hidden from
 * assistive technology (the log and the live region say the same in words). It plays the bursts
 * card-flight-context.tsx hands it, one live action at a time, and tells the store when each
 * count may change: as its cards land or leave. With reduced motion only the "+1 Wood" labels show.
 */
export function CardFlightLayer({
  isConnected,
  screenPointsRef,
}: {
  isConnected: boolean;
  screenPointsRef: RefObject<BoardScreenPoints | null>;
}) {
  const flights = useCardFlights();
  const store = flights?.store;
  const incoming = flights?.incoming ?? null;
  const layerRef = useRef<HTMLDivElement>(null);
  const directorRef = useRef<CardFlightDirector | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !store) {
      return;
    }
    preloadCardArt();
    const director = createCardFlightDirector(layer, () => screenPointsRef.current, store);
    directorRef.current = director;
    // A background tab drops what is flying; coming back never replays it.
    const stopWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        director.stop();
      }
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      director.stop();
      directorRef.current = null;
    };
  }, [screenPointsRef, store]);

  useEffect(() => {
    if (!isConnected) {
      directorRef.current?.stop();
    }
  }, [isConnected]);

  // A layout effect, so the store knows what flies before the screen paints and before the hand
  // decides which of its cards to animate itself.
  useLayoutEffect(() => {
    if (incoming && store && !store.knows(incoming.plan)) {
      directorRef.current?.enqueue(incoming);
    }
  }, [incoming, store]);

  return <div aria-hidden="true" className="card-flight-layer" ref={layerRef} />;
}

/**
 * Plays bursts one after another, and tells the store when each count may change. A burst never
 * waits on the game: it only delays the next burst, and a long queue skips to the newest.
 */
function createCardFlightDirector(
  layer: HTMLElement,
  getScreenPoints: () => BoardScreenPoints | null,
  store: CardFlightStore,
): CardFlightDirector {
  const queue: IncomingCardFlights[] = [];
  let playing: IncomingCardFlights | null = null;
  /** Bursts on screen whose counts wait for the browser to start their cards. */
  const starting = new Set<IncomingCardFlights>();
  const animations = new Set<Animation>();
  const nodes = new Set<Element>();
  let nextBurstTimer: number | null = null;

  /** Takes every card and label off the layer, and the next burst's turn with them. */
  const clearLayer = () => {
    for (const animation of animations) animation.cancel();
    for (const node of nodes) node.remove();
    animations.clear();
    nodes.clear();
    if (nextBurstTimer !== null) {
      window.clearTimeout(nextBurstTimer);
      nextBurstTimer = null;
    }
  };

  /**
   * Drops bursts before their cards have all landed: their counts show at once, and the hand
   * shows its own cards that never landed.
   */
  const drop = (bursts: readonly (IncomingCardFlights | null)[]) => {
    for (const burst of bursts) {
      if (burst) {
        starting.delete(burst);
        store.release(burst.plan, true);
      }
    }
  };

  const track = (animation: Animation, node?: Element) => {
    animations.add(animation);
    if (node) {
      nodes.add(node);
    }
    animation.addEventListener("finish", () => {
      animations.delete(animation);
      if (node) {
        nodes.delete(node);
        node.remove();
      }
    });
  };

  const showLabel = (
    target: FlightTarget,
    text: string,
    tone: "gain" | "loss",
    delayMs: number,
    reduced: boolean,
  ) => {
    const label = document.createElement("span");
    label.className = "card-flight-label";
    label.dataset.tone = tone;
    label.textContent = text;
    layer.append(label);
    const anchor = target.labelEnd ? "translate(-100%, -50%)" : "translate(-50%, -50%)";
    const at = (lift: number) =>
      `translate(${target.labelPoint.x}px, ${target.labelPoint.y - lift}px) ${anchor}`;
    const keyframes: Keyframe[] = reduced
      ? [
          { opacity: 0, transform: at(0) },
          { offset: 0.15, opacity: 1, transform: at(0) },
          { offset: 0.8, opacity: 1, transform: at(0) },
          { opacity: 0, transform: at(0) },
        ]
      : [
          { opacity: 0, transform: at(-3) },
          { offset: 0.2, opacity: 1, transform: at(0) },
          { offset: 0.7, opacity: 1, transform: at(3) },
          { opacity: 0, transform: at(6) },
        ];
    track(
      label.animate(keyframes, {
        delay: delayMs,
        duration: reduced ? CARD_FLIGHT_TIMING.reducedLabelMs : CARD_FLIGHT_TIMING.labelMs,
        easing: "ease-out",
        fill: "both",
      }),
      label,
    );
  };

  /** Draws a burst and returns how long it runs; the store learns when each count changes. */
  const playBurst = (burst: IncomingCardFlights, reduced: boolean): number => {
    const { plan } = burst;
    const sprite = window.matchMedia(WIDE_SPRITE_QUERY).matches
      ? SPRITE_SIZES.wide
      : SPRITE_SIZES.compact;
    const resolve = createTargetResolver(getScreenPoints(), sprite);
    // Held while it waited its turn, so the hand has left its cards to it.
    const waited = store.knows(plan);

    if (reduced) {
      for (const label of plan.labels) {
        const target = resolve(label.at);
        if (target) showLabel(target, label.detail, label.tone, 0, true);
      }
      // The labels say it all at once: every count changes now, the hand's cards left to them.
      store.hold(plan, {
        actionNumber: burst.actionNumber,
        carried: getFlightEndpointKeys(plan.flights),
        changes: [],
      });
      return CARD_FLIGHT_TIMING.reducedLabelMs;
    }

    const { flightMs, popMs } = CARD_FLIGHT_TIMING;
    const { leadMs } = plan;
    const drawn: CardFlight[] = [];
    const pulsed = new Set<string>();
    /** One of the burst's cards, to time the counts by. */
    let timing: Animation | null = null;
    for (const flight of plan.flights) {
      const from = resolve(flight.from);
      const to = resolve(flight.to);
      if (!from || !to) {
        continue;
      }
      drawn.push(flight);
      const keyframes = getFlightKeyframes(from.point, to.point, sprite);
      for (let index = 0; index < flight.spriteCount; index += 1) {
        const card = createCardSprite(flight.card);
        layer.append(card);
        const animation = card.animate(keyframes, {
          delay: leadMs + flight.delayMs + index * plan.staggerMs,
          duration: popMs + flightMs,
          fill: "both",
        });
        timing ??= animation;
        track(animation, card);
      }
      // One brief brightening per destination, as its first card lands and its count changes.
      const destinationKey = getFlightEndpointKey(flight.to);
      if (to.pulse && !pulsed.has(destinationKey)) {
        pulsed.add(destinationKey);
        track(
          to.pulse.animate(
            [
              { filter: "brightness(1)" },
              { filter: "brightness(1.6)" },
              { filter: "brightness(1)" },
            ],
            {
              delay: leadMs + flight.delayMs + popMs + flightMs,
              duration: PULSE_MS,
              easing: "ease-out",
            },
          ),
        );
      }
    }
    for (const label of plan.labels) {
      const target = resolve(label.at);
      if (target) showLabel(target, label.text, label.tone, leadMs + label.delayMs, false);
    }

    // Each count changes as the first of its drawn cards lands or leaves; the rest at once. The
    // times count from when the browser starts the cards (a frame from now, later on a busy
    // page), so no count changes before its card is there. Cards that leave at once show now.
    const changes = getFlightCountChanges({ ...plan, flights: drawn }, burst.viewerPlayerId);
    const holdAt = (at: (atMs: number) => number) =>
      store.hold(plan, {
        actionNumber: burst.actionNumber,
        carried: getFlightEndpointKeys(drawn),
        changes: changes.map(({ atMs, delta, target }) => ({ at: at(atMs), delta, target })),
      });
    const now = performance.now();
    const started = timing;
    if (started) {
      holdAt((atMs) => (atMs <= 0 ? now : Number.POSITIVE_INFINITY));
      starting.add(burst);
      started.ready.then(
        () => {
          if (starting.delete(burst)) {
            const startedAt =
              typeof started.startTime === "number" ? started.startTime : performance.now();
            holdAt((atMs) => startedAt + atMs);
          }
        },
        // Cancelled: the burst was dropped, and its counts with it.
        () => starting.delete(burst),
      );
    } else {
      holdAt((atMs) => now + atMs);
    }
    if (waited) {
      // Cards the hand left to this burst that it cannot draw: the hand shows them itself.
      store.miss(subtractChanges(burst.changes, changes));
    }
    return leadMs + plan.durationMs;
  };

  const playNext = () => {
    // The last burst's counts change with its own cards, which may land a frame or two from now.
    playing = null;
    const burst = queue.shift();
    if (!burst) {
      return;
    }
    playing = burst;
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    let burstMs = 0;
    try {
      burstMs = playBurst(burst, reduced);
    } catch {
      // Cards that cannot be drawn are only decoration: drop the burst, never the game screen.
      clearLayer();
      drop([burst]);
      playing = null;
    }
    nextBurstTimer = window.setTimeout(() => {
      nextBurstTimer = null;
      playNext();
    }, burstMs);
  };

  return {
    enqueue(burst) {
      queue.push(burst);
      if (queue.length > MAX_QUEUED_BURSTS) {
        // Too far behind: skip to the newest.
        clearLayer();
        drop([playing, ...queue.splice(0, queue.length - 1)]);
        playing = null;
      }
      if (nextBurstTimer === null) {
        playNext();
        return;
      }
      // It waits its turn: its counts hold until it plays, and the hand leaves its cards to it.
      store.hold(burst.plan, {
        actionNumber: burst.actionNumber,
        carried: getFlightEndpointKeys(burst.plan.flights),
        changes: burst.changes.map(({ delta, target }) => ({
          at: Number.POSITIVE_INFINITY,
          delta,
          target,
        })),
      });
    },
    stop() {
      queue.length = 0;
      playing = null;
      starting.clear();
      clearLayer();
      store.releaseAll();
    },
  };
}

/** What `all` changes beyond `drawn`, count by count. */
function subtractChanges(
  all: readonly FlightCountChange[],
  drawn: readonly FlightCountChange[],
): CountChange[] {
  const left = new Map<string, number>();
  for (const { delta, target } of all) left.set(target, (left.get(target) ?? 0) + delta);
  for (const { delta, target } of drawn) left.set(target, (left.get(target) ?? 0) - delta);
  return [...left].flatMap(([target, delta]) => (delta === 0 ? [] : [{ at: 0, delta, target }]));
}

/**
 * Finds each endpoint on screen once per burst: the element that is actually showing it now (the
 * rail's rows at xl, the crew strip or column below it, never a closed drawer), else nothing.
 * The bank, when it is out of sight in the drawer, is the middle of the board.
 */
function createTargetResolver(screenPoints: BoardScreenPoints | null, sprite: SpriteSize) {
  const cache = new Map<string, FlightTarget | null>();
  const boardCenter = (): FlightTarget | null => {
    const point = screenPoints?.getCenterClientPoint();
    return point ? { labelEnd: false, labelPoint: point, point, pulse: null } : null;
  };
  /**
   * The hand's playable development cards: their room (or stack), else the last of them (never the
   * victory point card after them), else the hand.
   */
  const findDevelopmentRoom = (): FlightTarget | null => {
    const room =
      findShown(".game-hand [data-hand-dev]") ??
      findShown(".game-hand [data-development]:not([data-hand-vp])", true) ??
      findShown(".game-hand");
    return room ? toTarget(room, room, "above") : null;
  };

  const find = (endpoint: FlightEndpoint): FlightTarget | null => {
    switch (endpoint.kind) {
      case "tile": {
        const middle = screenPoints?.getTileClientPoint(endpoint.tileId);
        if (!middle) {
          return null;
        }
        // The card pops just above the number token, so the rolled number stays readable.
        const point = { x: middle.x, y: middle.y - sprite.height * TILE_POP_LIFT };
        return { labelEnd: false, labelPoint: point, point, pulse: null };
      }
      case "hand": {
        const card = findShown(`.game-hand [data-resource="${endpoint.resource}"]`);
        return card
          ? toTarget(card.querySelector(".game-hand-card-face") ?? card, card, "above")
          : null;
      }
      case "hand-development":
        return findDevelopmentRoom();
      case "hand-victory-point": {
        // The victory point card, its slot kept while the card is in the air.
        const card = findShown(".game-hand [data-hand-vp]");
        return card
          ? toTarget(card.querySelector(".game-hand-card-face") ?? card, card, "above")
          : findDevelopmentRoom();
      }
      case "player": {
        const row = findShown(`[data-player-id="${CSS.escape(endpoint.playerId)}"]`);
        if (!row) {
          return null;
        }
        const pile = row.querySelector(`[data-flight-pile="${endpoint.pile}"]`);
        return pile && isShown(pile)
          ? toTarget(pile, pile, { icon: pile.querySelector("img") ?? pile })
          : toTarget(row, null, "below");
      }
      case "bank": {
        const pile =
          (endpoint.resource && findShown(`[data-bank-resource="${endpoint.resource}"]`)) ||
          findShown("[data-bank]");
        return pile ? toTarget(pile, pile, "above") : boardCenter();
      }
      case "bank-development": {
        const pile = findShown("[data-bank-dev]");
        return pile ? toTarget(pile, pile, "above") : boardCenter();
      }
    }
  };

  return (endpoint: FlightEndpoint): FlightTarget | null => {
    const key = getFlightEndpointKey(endpoint);
    if (!cache.has(key)) {
      cache.set(key, find(endpoint));
    }
    return cache.get(key) ?? null;
  };
}

/**
 * The element's middle, kept inside whatever scrolls or clips it. Its label sits over the card icon
 * of a player's card count, ending just short of the number (which changes and brightens as cards
 * land) and on the count's own line, so it never covers the name above or the points at the end;
 * just below a player's pill that shows no count (clear of the top bar); or just above a hand card
 * or the bank.
 */
function toTarget(element: Element, pulseRoot: Element | null, label: LabelPlace): FlightTarget {
  const box = element.getBoundingClientRect();
  const point = keepInsideClips(element, {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  });
  let labelPoint: Point;
  if (typeof label === "object") {
    const icon = label.icon.getBoundingClientRect();
    labelPoint = keepInsideClips(label.icon, {
      x: icon.right + ICON_LABEL_OVERHANG,
      y: icon.top + icon.height / 2 + ICON_LABEL_SETTLE,
    });
  } else {
    labelPoint =
      label === "below"
        ? { x: point.x, y: point.y + box.height / 2 + LABEL_DROP }
        : { x: point.x, y: Math.max(0, point.y - box.height / 2) - LABEL_GAP };
  }
  return {
    labelEnd: typeof label === "object",
    labelPoint,
    point,
    pulse: pulseRoot?.querySelector(".game-count-chip, .game-bank-count") ?? pulseRoot,
  };
}

function keepInsideClips(element: Element, point: Point): Point {
  let { x, y } = point;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.overflowX === "visible" && style.overflowY === "visible") {
      continue;
    }
    const clip = parent.getBoundingClientRect();
    x = Math.min(Math.max(x, clip.left), clip.right);
    y = Math.min(Math.max(y, clip.top), clip.bottom);
  }
  return { x, y };
}

function findShown(selector: string, last = false): Element | null {
  const shown = [...document.querySelectorAll(selector)].filter(isShown);
  return (last ? shown.at(-1) : shown[0]) ?? null;
}

function isShown(element: Element): boolean {
  if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
    return false;
  }
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.right > 0 &&
    box.bottom > 0 &&
    box.left < window.innerWidth &&
    box.top < window.innerHeight
  );
}

/** A pop at the source, then a gentle arc that shrinks a little as it lands. */
function getFlightKeyframes(from: Point, to: Point, sprite: SpriteSize): Keyframe[] {
  const { flightMs, popMs } = CARD_FLIGHT_TIMING;
  const popEnd = popMs / (popMs + flightMs);
  const control = getArcControl(from, to, sprite);
  const at = (point: Point, scale: number) =>
    `translate(${point.x - sprite.width / 2}px, ${point.y - sprite.height / 2}px) scale(${scale})`;

  const keyframes: Keyframe[] = [
    {
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      offset: 0,
      opacity: 0,
      transform: at(from, 0.6),
    },
    { offset: popEnd, opacity: 1, transform: at(from, 1) },
  ];
  for (let step = 1; step <= ARC_STEPS; step += 1) {
    const progress = easeInOut(step / ARC_STEPS);
    const point = getArcPoint(from, control, to, progress);
    keyframes.push({
      offset: popEnd + (1 - popEnd) * (step / ARC_STEPS),
      opacity: step === ARC_STEPS ? 0 : 1,
      transform: at(point, 1 - 0.2 * progress),
    });
  }
  return keyframes;
}

/**
 * The arc's bend: to the upper side of the straight line by a fifth of its length, or toward the
 * middle of the screen when the line runs up and down. A bend that would carry the card past the
 * window's edge goes the other way, then flattens, so the whole card stays in sight.
 */
function getArcControl(from: Point, to: Point, sprite: SpriteSize): Point {
  const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  let normal = { x: (to.y - from.y) / distance, y: -(to.x - from.x) / distance };
  const facesUp = Math.abs(normal.y) >= 0.5 ? normal.y < 0 : null;
  const facesMiddle = normal.x * (window.innerWidth / 2 - middle.x) > 0;
  if (facesUp === false || (facesUp === null && !facesMiddle)) {
    normal = { x: -normal.x, y: -normal.y };
  }

  // The window less half a card, stretched to take in both ends however close to an edge they are.
  const left = Math.min(sprite.width / 2, from.x, to.x);
  const right = Math.max(window.innerWidth - sprite.width / 2, from.x, to.x);
  const top = Math.min(sprite.height / 2, from.y, to.y);
  const bottom = Math.max(window.innerHeight - sprite.height / 2, from.y, to.y);
  const stays = (control: Point) =>
    Array.from({ length: ARC_STEPS + 1 }, (_, step) =>
      getArcPoint(from, control, to, step / ARC_STEPS),
    ).every((point) => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom);

  for (const bow of [0.2, 0.1]) {
    for (const side of [1, -1]) {
      const control = {
        x: middle.x + normal.x * side * distance * bow,
        y: middle.y + normal.y * side * distance * bow,
      };
      if (stays(control)) {
        return control;
      }
    }
  }
  return middle;
}

/** The point `progress` of the way along the quadratic arc through `control`. */
function getArcPoint(from: Point, control: Point, to: Point, progress: number): Point {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * from.x + 2 * inverse * progress * control.x + progress * progress * to.x,
    y: inverse * inverse * from.y + 2 * inverse * progress * control.y + progress * progress * to.y,
  };
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
}

function getCardArtPath(card: FlightCard): string {
  switch (card.kind) {
    case "development":
      return card.card ? DEVELOPMENT_CARD_ASSET_PATHS[card.card] : DEVELOPMENT_CARD_BACK_ASSET_PATH;
    case "hidden-resource":
      return UNKNOWN_RESOURCE_CARD_ASSET_PATH;
    case "resource":
      return RESOURCE_CARD_ASSET_PATHS[card.resource];
  }
}

/** The optimized art at the sprite's size, the same the preload fetched. */
function getCardArtSource(path: string) {
  const { props } = getImageProps({
    alt: "",
    height: 768,
    sizes: `${SPRITE_SIZES.wide.width}px`,
    src: path,
    width: 512,
  });
  return { sizes: props.sizes ?? "", src: props.src, srcSet: props.srcSet ?? "" };
}

function createCardSprite(card: FlightCard): HTMLImageElement {
  const source = getCardArtSource(getCardArtPath(card));
  const sprite = document.createElement("img");
  sprite.alt = "";
  sprite.className = "card-flight";
  sprite.decoding = "async";
  sprite.draggable = false;
  sprite.sizes = source.sizes;
  sprite.srcset = source.srcSet;
  sprite.src = source.src;
  return sprite;
}

/** Fetched once, so the first flight pops with its art (a bought card's face included). */
function preloadCardArt() {
  const paths = [
    DEVELOPMENT_CARD_BACK_ASSET_PATH,
    UNKNOWN_RESOURCE_CARD_ASSET_PATH,
    ...Object.values(RESOURCE_CARD_ASSET_PATHS),
    ...Object.values(DEVELOPMENT_CARD_ASSET_PATHS),
  ];
  for (const path of paths) {
    const source = getCardArtSource(path);
    const image = new window.Image();
    image.sizes = source.sizes;
    image.srcset = source.srcSet;
    image.src = source.src;
  }
}
