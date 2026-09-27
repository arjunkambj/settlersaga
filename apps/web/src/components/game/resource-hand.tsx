"use client";

import {
  RESOURCE_ORDER,
  type DevelopmentCardType,
  type PlayableDevelopmentCardType,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import arrowLeftIcon from "@iconify-icons/solar/alt-arrow-left-bold";
import arrowRightIcon from "@iconify-icons/solar/alt-arrow-right-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import {
  type AnimationEvent,
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DEVELOPMENT_CARD_ASSETS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
} from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import { getResourceCardChanges, type ResourceCardChange } from "@/lib/game/resource-card-changes";

import { useHandDock } from "./hand-dock";
import { useMediaQuery } from "./use-media-query";

const DEVELOPMENT_STACK_ID = "game-hand-dev-cards";
/** From md up the hand is one row of one fixed width in the dock (styles/game-dock.css). */
const DOCK_ROW_QUERY = "(min-width: 48rem)";
/** From lg up the development cards fan out in the room kept for them; at md they stack. */
const DEVELOPMENT_FAN_QUERY = "(min-width: 64rem)";

/** Names that fit under a hand card. */
const DEVELOPMENT_CARD_SHORT_LABELS: Readonly<Record<DevelopmentCardType, string>> = {
  knight: "Knight",
  monopoly: "Monopoly",
  "road-building": "Roads",
  "victory-point": "+1 VP",
  "year-of-plenty": "Plenty",
};

interface ResourceAnimation extends ResourceCardChange {
  id: string;
  /** Where the card's center was when the change landed, from the shelf's left edge. */
  x: number;
}

interface ResourceSnapshot {
  actionNumber: number;
  playerId: string;
  resources: ResourceInventory;
}

type ResourceFlightStyle = CSSProperties & {
  "--resource-flight-delay": string;
  "--resource-flight-tilt": string;
  "--resource-flight-x": string;
};

/** Each flight lands on its own card, fanned slightly from the center of the row. */
function getResourceFlightStyle(animation: ResourceAnimation): ResourceFlightStyle {
  const index = RESOURCE_ORDER.indexOf(animation.resource);
  return {
    "--resource-flight-delay": `${index * 30}ms`,
    "--resource-flight-tilt": `${(index - 2) * 1.6}deg`,
    "--resource-flight-x": `${(2 - index) * 0.72}rem`,
    insetInlineStart: `${animation.x}px`,
  };
}

interface ScrollEdges {
  end: boolean;
  /** Cards scrolled out of view past each end, and how many of them can be played now. */
  hiddenAfter: number;
  hiddenBefore: number;
  playableAfter: number;
  playableBefore: number;
  start: boolean;
}

const NO_SCROLL: ScrollEdges = {
  end: false,
  hiddenAfter: 0,
  hiddenBefore: 0,
  playableAfter: 0,
  playableBefore: 0,
  start: false,
};

function CardArt({ path }: { path: string }) {
  return (
    <Image
      alt=""
      className="game-hand-card-art"
      draggable={false}
      height={768}
      loading="eager"
      sizes="4.5rem"
      src={path}
      width={512}
    />
  );
}

/** A count chip; callers key it by its count so it pops whenever the number changes. */
function CountChip({ count }: { count: number }) {
  return (
    <span aria-hidden="true" className="game-count-chip motion-safe:animate-game-pop">
      {count}
    </span>
  );
}

/**
 * The viewer's cards in one row: five resource cards (always shown, dimmed at zero), a thin
 * divider, then development cards, all the same size. Gains fly in and pop the card; spends fly
 * out.
 *
 * From md up the hand keeps one width whatever it holds, so the dock never shifts as cards come
 * and go: after the resources it keeps room for the development cards (styles/game-dock.css).
 * From lg up they fan out in that room, each overlapping the one after it, its art, count and
 * Play pill still showing; with none, a dashed card says so. At md the room is one card: a lone
 * kind shows as itself, more gather into one "Dev ×N" stack that opens them in a small popover
 * above the hand. On phones the row shows every kind side by side while they fit the shelf and
 * stacks them when they don't; when the row still overflows, the hidden end fades and an arrow
 * scrolls it.
 */
export function ResourceHand({
  actionNumber,
  isViewerTurn,
  me,
  onPlayDevelopmentCard,
  pending,
  playableDevelopmentCards,
}: {
  actionNumber: number;
  isViewerTurn: boolean;
  me: PrivatePlayerState;
  onPlayDevelopmentCard(card: PlayableDevelopmentCardType): void;
  pending: boolean;
  playableDevelopmentCards: readonly PlayableDevelopmentCardType[];
}) {
  const { interaction } = useHandDock();
  const dockRow = useMediaQuery(DOCK_ROW_QUERY);
  const fanLayout = useMediaQuery(DEVELOPMENT_FAN_QUERY);
  const shelfRef = useRef<HTMLDivElement>(null);
  const cardListRef = useRef<HTMLUListElement>(null);
  const previousSnapshotRef = useRef<ResourceSnapshot | null>(null);
  const [resourceAnimations, setResourceAnimations] = useState<ResourceAnimation[]>([]);
  const [scrollEdges, setScrollEdges] = useState<ScrollEdges>(NO_SCROLL);
  // Phones: the kinds don't fit the shelf side by side, so they gather into the stack.
  const [overflowsShelf, setOverflowsShelf] = useState(false);
  const [stackOpen, setStackOpen] = useState(false);
  const stackRef = useRef<HTMLDivElement>(null);
  const overflows = scrollEdges.start || scrollEdges.end;
  const developmentCardCounts = DEVELOPMENT_CARD_ASSETS.flatMap((asset) => {
    const count = me.developmentCards.filter((card) => card === asset.id).length;
    return count > 0 ? [{ ...asset, count }] : [];
  });
  const developmentKinds = developmentCardCounts.length;
  const developmentTotal = me.developmentCards.length;
  const isPlayable = (card: (typeof developmentCardCounts)[number]) =>
    card.id !== "victory-point" && playableDevelopmentCards.includes(card.id);
  const showStack = developmentKinds > 1 && (dockRow ? !fanLayout : overflowsShelf);
  const popoverOpen = showStack && stackOpen;
  const stackPlayableCount = developmentCardCounts.filter(isPlayable).length;
  const handCardCount = RESOURCE_ORDER.length + developmentKinds;
  const interactionMatchesSource =
    interaction !== null &&
    RESOURCE_ORDER.every(
      (resource) => interaction.sourceResources[resource] === me.resources[resource],
    );

  useEffect(() => {
    const nextSnapshot: ResourceSnapshot = {
      actionNumber,
      playerId: me.id,
      resources: { ...me.resources },
    };
    const previousSnapshot = previousSnapshotRef.current;
    previousSnapshotRef.current = nextSnapshot;

    if (
      !previousSnapshot ||
      previousSnapshot.playerId !== me.id ||
      actionNumber <= previousSnapshot.actionNumber
    ) {
      setResourceAnimations((current) => (current.length === 0 ? current : []));
      return;
    }

    const changes = getResourceCardChanges(previousSnapshot.resources, nextSnapshot.resources);
    const shelf = shelfRef.current;
    if (changes.length === 0 || !shelf) {
      return;
    }

    // Flights land on the card wherever the row is aligned or scrolled, kept inside the shelf.
    const shelfBox = shelf.getBoundingClientRect();
    const cardCenter = (resource: ResourceType) => {
      const cardBox = shelf.querySelector(`[data-resource="${resource}"]`)?.getBoundingClientRect();
      const center = cardBox ? cardBox.left + cardBox.width / 2 - shelfBox.left : 0;
      return Math.min(Math.max(center, 0), shelfBox.width);
    };
    setResourceAnimations(
      changes.map((change) => ({
        ...change,
        id: `${me.id}:${actionNumber}:${change.resource}`,
        x: cardCenter(change.resource),
      })),
    );
  }, [
    actionNumber,
    me.id,
    me.resources.brick,
    me.resources.sheep,
    me.resources.stone,
    me.resources.tree,
    me.resources.wheat,
  ]);

  const updateScrollEdges = () => {
    const cardList = cardListRef.current;
    if (cardList) {
      setScrollEdges((current) => getScrollEdges(current, cardList));
    }
  };

  // Measured before paint, so the row never shows a frame with the wrong cards. From md up the
  // row has its own fixed gaps (the CSS's), so only the scroll edges are kept up to date; on
  // phones the stack and the gap are fitted to the shelf too. It re-measures when cards are added
  // or removed; the list's own box does not resize then.
  useLayoutEffect(() => {
    const cardList = cardListRef.current;
    if (!cardList) {
      return;
    }

    const measure = () => {
      // Measured against the shelf, whose width does not change with the scroll arrows, so the
      // stack never flips back and forth as the arrows come and go.
      const shelfWidth = shelfRef.current?.offsetWidth ?? cardList.clientWidth;
      if (dockRow) {
        cardList.style.removeProperty("--hand-gap");
      } else {
        setOverflowsShelf(needsStack(cardList, shelfWidth, handCardCount));
        fitCardGap(cardList, shelfWidth);
      }
      setScrollEdges((current) => getScrollEdges(current, cardList, shelfWidth));
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(cardList);
    measure();
    return () => resizeObserver.disconnect();
  }, [dockRow, handCardCount, showStack]);

  // The stack's popover closes on any press outside it and on Escape.
  useEffect(() => {
    if (!popoverOpen) {
      return;
    }
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !stackRef.current?.contains(event.target)) {
        const stackButton = cardListRef.current?.querySelector("[data-stack] button");
        if (!stackButton?.contains(event.target)) {
          setStackOpen(false);
        }
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStackOpen(false);
        cardListRef.current?.querySelector<HTMLButtonElement>("[data-stack] button")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [popoverOpen]);

  /** One kind of development card; `fanIndex` places it in the fan. */
  const renderDevelopmentCard = (
    card: (typeof developmentCardCounts)[number],
    fanIndex?: number,
  ) => {
    const playable = card.id !== "victory-point" && playableDevelopmentCards.includes(card.id);
    const note =
      card.id === "victory-point"
        ? "Counts toward your score"
        : playable
          ? card.description
          : isViewerTurn
            ? "Not playable right now"
            : "Play it on your turn";
    return (
      <li
        aria-label={`${card.label}: ${card.count}. ${note}`}
        className="game-hand-card motion-safe:animate-game-pop"
        data-development
        data-playable={playable || undefined}
        key={card.id}
        style={fanIndex === undefined ? undefined : ({ "--fan-index": fanIndex } as CSSProperties)}
      >
        <span aria-hidden="true" className="game-hand-card-face">
          <CardArt path={card.path} />
        </span>
        <CountChip count={card.count} key={card.count} />
        <span aria-hidden="true" className="game-hand-card-label">
          {DEVELOPMENT_CARD_SHORT_LABELS[card.id]}
        </span>
        {playable ? (
          <button
            aria-label={`Play ${card.label}: ${card.description}`}
            className="game-hand-card-button"
            disabled={pending}
            onClick={() => {
              setStackOpen(false);
              onPlayDevelopmentCard(card.id);
            }}
            type="button"
          >
            <span aria-hidden="true" className="game-hand-play">
              <Icon className="game-hand-play-icon" icon={playIcon} />
              <span className="game-hand-play-text">Play</span>
            </span>
          </button>
        ) : null}
      </li>
    );
  };

  /** The "Dev ×N" stack: a card of the row on phones, the whole development room at md. */
  const renderStack = (Element: "div" | "li") => (
    <Element
      className="game-hand-card"
      data-development
      data-playable={stackPlayableCount > 0 || undefined}
      data-stack
    >
      <span aria-hidden="true" className="game-hand-card-face">
        <CardArt path={DEVELOPMENT_CARD_BACK_ASSET_PATH} />
      </span>
      <span aria-hidden="true" className="game-hand-card-label">
        Dev ×{developmentTotal}
      </span>
      <button
        aria-controls={DEVELOPMENT_STACK_ID}
        aria-expanded={popoverOpen}
        aria-label={`Development cards: ${developmentTotal}${
          stackPlayableCount > 0 ? `, ${stackPlayableCount} you can play` : ""
        }. ${popoverOpen ? "Hide them" : "Show them"}`}
        className="game-hand-card-button"
        onClick={() => setStackOpen((open) => !open)}
        type="button"
      >
        {stackPlayableCount > 0 ? (
          <span aria-hidden="true" className="game-hand-play">
            <span className="game-hand-play-text">Play</span>
          </span>
        ) : null}
      </button>
    </Element>
  );

  // From md up: the room kept for the development cards, the same width whatever it holds. With
  // none, a dashed card; its words run shorter where the room is one card wide (md).
  const developmentArea = !dockRow ? null : developmentKinds === 0 ? (
    <li className="game-hand-dev" data-empty>
      <span aria-hidden="true" className="game-hand-dev-empty">
        <CardArt path={DEVELOPMENT_CARD_BACK_ASSET_PATH} />
      </span>
      <span className="game-hand-card-label game-hand-dev-empty-label" data-length="long">
        No dev cards
      </span>
      <span className="game-hand-card-label game-hand-dev-empty-label" data-length="short">
        None
      </span>
    </li>
  ) : showStack ? (
    <li className="game-hand-dev">{renderStack("div")}</li>
  ) : (
    <li className="game-hand-dev">
      <ul
        aria-label="Development cards"
        className="game-hand-fan"
        data-count={developmentKinds}
        style={{ "--fan-count": developmentKinds } as CSSProperties}
      >
        {developmentCardCounts.map((card, index) => renderDevelopmentCard(card, index))}
      </ul>
      {developmentKinds > 2 ? (
        <span aria-hidden="true" className="game-hand-card-label game-hand-fan-label">
          Dev ×{developmentTotal}
        </span>
      ) : null}
    </li>
  );

  const scrollCards = (direction: -1 | 1) => {
    const cardList = cardListRef.current;
    cardList?.scrollBy({ left: direction * cardList.clientWidth * 0.75 });
  };

  const finishAnimation = (animationId: string, event: AnimationEvent<HTMLSpanElement>) => {
    if (event.currentTarget !== event.target) {
      return;
    }

    setResourceAnimations((current) => current.filter((animation) => animation.id !== animationId));
  };

  return (
    <section aria-label="Your cards" className="game-hand">
      <div className="game-hand-shelf" ref={shelfRef}>
        <ul
          aria-label={
            overflows
              ? "Your private cards. Use the left and right arrow keys to scroll."
              : undefined
          }
          className="game-hand-cards"
          data-more-after={scrollEdges.end || undefined}
          data-more-before={scrollEdges.start || undefined}
          onScroll={updateScrollEdges}
          ref={cardListRef}
          tabIndex={overflows ? 0 : undefined}
        >
          {RESOURCE_ORDER.map((resource) => {
            const picking = interaction && interactionMatchesSource ? interaction : null;
            const selected = picking
              ? Math.min(me.resources[resource], picking.selected[resource])
              : 0;
            const available = me.resources[resource] - selected;
            const displayedCount = picking?.preserveHandAppearance
              ? me.resources[resource]
              : available;
            const name = RESOURCE_LABELS[resource];

            return (
              <li
                aria-label={
                  picking
                    ? `${name}: ${available} available, ${selected} in ${picking.label}`
                    : `${name}: ${me.resources[resource]}`
                }
                className="game-hand-card"
                data-empty={displayedCount === 0 || undefined}
                data-gained={
                  resourceAnimations.some(
                    (animation) =>
                      animation.resource === resource && animation.direction === "receive",
                  ) || undefined
                }
                data-resource={resource}
                data-selected={(selected > 0 && !picking?.preserveHandAppearance) || undefined}
                key={resource}
              >
                <span aria-hidden="true" className="game-hand-card-face">
                  <CardArt path={RESOURCE_CARD_ASSET_PATHS[resource]} />
                </span>
                <CountChip count={displayedCount} key={displayedCount} />
                {selected > 0 && !picking?.preserveHandAppearance ? (
                  <span aria-hidden="true" className="game-hand-picked">
                    {selected}
                  </span>
                ) : null}
                <span aria-hidden="true" className="game-hand-card-label">
                  {name}
                </span>
                {picking && available > 0 ? (
                  <button
                    aria-label={`Move one ${name} from your hand to ${picking.label}`}
                    className="game-hand-card-button"
                    disabled={picking.disabled}
                    onClick={() => picking.onSelect(resource)}
                    type="button"
                  />
                ) : null}
              </li>
            );
          })}
          {dockRow || developmentKinds > 0 ? (
            <li aria-hidden="true" className="game-hand-divider" role="presentation" />
          ) : null}
          {dockRow
            ? developmentArea
            : showStack
              ? renderStack("li")
              : developmentCardCounts.map((card) => renderDevelopmentCard(card))}
        </ul>
        {showStack ? (
          <div
            aria-label="Your development cards"
            className="game-hand-dev-popover"
            hidden={!popoverOpen}
            id={DEVELOPMENT_STACK_ID}
            ref={stackRef}
            role="group"
          >
            <ul className="game-hand-dev-list">
              {developmentCardCounts.map((card) => renderDevelopmentCard(card))}
            </ul>
          </div>
        ) : null}
        {scrollEdges.start ? (
          <ScrollArrow
            edge="start"
            hidden={scrollEdges.hiddenBefore}
            onClick={() => scrollCards(-1)}
            playable={scrollEdges.playableBefore}
          />
        ) : null}
        {scrollEdges.end ? (
          <ScrollArrow
            edge="end"
            hidden={scrollEdges.hiddenAfter}
            onClick={() => scrollCards(1)}
            playable={scrollEdges.playableAfter}
          />
        ) : null}
        <div aria-hidden="true" className="resource-flight-layer">
          {resourceAnimations.map((animation) => (
            <span
              className="resource-flight-anchor"
              key={animation.id}
              style={getResourceFlightStyle(animation)}
            >
              <span
                className={`resource-flight resource-flight--${animation.direction}`}
                onAnimationEnd={(event) => finishAnimation(animation.id, event)}
              >
                <Image
                  alt=""
                  className="resource-flight-image"
                  draggable={false}
                  height={768}
                  sizes="2.65rem"
                  src={RESOURCE_CARD_ASSET_PATHS[animation.resource]}
                  width={512}
                />
                <span className="resource-flight-badge">
                  {animation.direction === "receive" ? "+" : "−"}
                  {animation.amount}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * A row that fits keeps the resting gap. One that is only a little too wide closes its gaps (down
 * to the smallest gap) so every card stays in view. While the row scrolls, widen the gap between
 * cards so the cards in view fill the row edge to edge: no card is cut in half at the arrow, and
 * no dead space is left before it.
 */
function fitCardGap(list: HTMLElement, shelfWidth: number) {
  const card = list.querySelector<HTMLElement>(":scope > .game-hand-card");
  if (!card) {
    return;
  }
  const restingGap = getRestingGap();
  const cardWidth = card.offsetWidth;
  const cardCount = list.querySelectorAll(":scope > .game-hand-card").length;
  // The divider between resource and development cards takes its own width and one more gap.
  const divider = list.querySelector<HTMLElement>(":scope > .game-hand-divider");
  const dividerRoom = divider ? divider.offsetWidth + restingGap : 0;
  // Whether the row fits is judged on the whole shelf, before the scroll arrows take their
  // gutters; the gap is then fitted between the arrows.
  const fits =
    cardCount * cardWidth + (cardCount - 1) * restingGap <=
    shelfWidth - 2 * restingGap - dividerRoom + 1;
  // The room left for gaps once the cards, the divider and the row's padding are laid out.
  const gapCount = cardCount - 1 + (divider ? 1 : 0);
  const gapRoom =
    shelfWidth - 2 * restingGap - cardCount * cardWidth - (divider ? divider.offsetWidth : 0);
  if (!fits && gapCount > 0 && gapRoom + 1 >= gapCount * getSmallestGap()) {
    list.style.setProperty("--hand-gap", `${Math.floor((gapRoom / gapCount) * 100) / 100}px`);
    return;
  }
  const cardsInView = (room: number) =>
    Math.floor((room + restingGap + 1) / (cardWidth + restingGap));
  // The divider only takes room from the first view when it falls inside it.
  const cardsAfterDivider = divider
    ? list.querySelectorAll(":scope > .game-hand-divider ~ .game-hand-card").length
    : 0;
  const fullRoom = list.clientWidth - 2 * restingGap;
  const dividerInView = divider !== null && cardCount - cardsAfterDivider < cardsInView(fullRoom);
  const room = dividerInView ? fullRoom - dividerRoom : fullRoom;
  const inView = cardsInView(room);
  const gap = fits || inView < 2 ? restingGap : (room - inView * cardWidth) / (inView - 1);
  list.style.setProperty("--hand-gap", `${gap}px`);
}

function getRem(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** --ui-space-2: the card row's resting gap and its inline padding. */
function getRestingGap(): number {
  return 0.5 * getRem();
}

/** --ui-space-1: the closest the cards may sit before the development cards gather up. */
function getSmallestGap(): number {
  return 0.25 * getRem();
}

/**
 * Whether the development cards must gather into one stack: the row laid out with every kind
 * side by side (five resource cards, the divider, one card per kind), at the smallest gap, would
 * be wider than `room`. With one kind there is nothing to gather.
 */
function needsStack(list: HTMLElement, room: number, slots: number): boolean {
  const card = list.querySelector<HTMLElement>(":scope > .game-hand-card");
  const divider = list.querySelector<HTMLElement>(":scope > .game-hand-divider");
  if (!card || !divider || slots - RESOURCE_ORDER.length < 2) {
    return false;
  }
  const needed =
    2 * getRestingGap() + slots * card.offsetWidth + slots * getSmallestGap() + divider.offsetWidth;
  return needed > room + 1;
}

/**
 * An arrow at one end of the card row, with a "+3" chip for the cards past it: gold when any of
 * them can be played now, so a playable card is never out of sight unnoticed.
 */
function ScrollArrow({
  edge,
  hidden,
  onClick,
  playable,
}: {
  edge: "end" | "start";
  hidden: number;
  onClick(): void;
  /** How many of the cards past the arrow can be played now. */
  playable: number;
}) {
  const where = edge === "end" ? "more" : "earlier";
  return (
    <Button
      aria-label={`Show ${hidden > 0 ? `${hidden} ` : ""}${where} ${hidden === 1 ? "card" : "cards"}${
        playable > 0 ? `, ${playable} you can play` : ""
      }`}
      className="game-hand-scroll"
      data-edge={edge}
      onClick={onClick}
      size="game-md"
      tabIndex={-1}
      variant="game-icon"
    >
      <Icon aria-hidden="true" icon={edge === "end" ? arrowRightIcon : arrowLeftIcon} />
      {hidden > 0 ? (
        <span
          aria-hidden="true"
          className="game-hand-scroll-count"
          data-playable={playable > 0 || undefined}
        >
          +{hidden}
        </span>
      ) : null}
    </Button>
  );
}

/**
 * Which ends of the card row are scrolled out of view, and how many cards lie past each. With
 * `shelfWidth`, a row that fits the whole shelf counts as fitting even while the arrows' gutters
 * still narrow it, so the arrows never keep themselves in view.
 */
function getScrollEdges(current: ScrollEdges, list: HTMLElement, shelfWidth?: number): ScrollEdges {
  if (shelfWidth !== undefined && list.scrollWidth <= shelfWidth + 1) {
    return NO_SCROLL;
  }
  const viewStart = list.scrollLeft;
  const viewEnd = viewStart + list.clientWidth;
  const next: ScrollEdges = {
    ...NO_SCROLL,
    end: viewEnd < list.scrollWidth - 1,
    start: viewStart > 1,
  };
  for (const card of list.children) {
    if (!(card instanceof HTMLElement) || !card.classList.contains("game-hand-card")) {
      continue;
    }
    // A card counts as hidden once more than half of it is out of view.
    const center = card.offsetLeft - list.offsetLeft + card.offsetWidth / 2;
    const playable = card.dataset.playable !== undefined;
    if (center > viewEnd) {
      next.hiddenAfter += 1;
      next.playableAfter += playable ? 1 : 0;
    } else if (center < viewStart) {
      next.hiddenBefore += 1;
      next.playableBefore += playable ? 1 : 0;
    }
  }
  const same = (Object.keys(next) as (keyof ScrollEdges)[]).every(
    (key) => current[key] === next[key],
  );
  return same ? current : next;
}
