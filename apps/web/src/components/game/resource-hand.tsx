"use client";

import {
  RESOURCE_ORDER,
  type PlayableDevelopmentCardType,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import arrowLeftIcon from "@iconify-icons/solar/alt-arrow-left-bold";
import arrowRightIcon from "@iconify-icons/solar/alt-arrow-right-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import starIcon from "@iconify-icons/solar/star-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import {
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DEVELOPMENT_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
} from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import { getFlightEndpointKey } from "@/lib/game/card-flights";
import {
  describeVictoryPoints,
  splitDevelopmentHand,
  type DevelopmentKind,
} from "@/lib/game/development-hand";
import { getResourceCardChanges, type ResourceCardChange } from "@/lib/game/resource-card-changes";

import { useCardFlights, useShownCounts } from "./card-flight-context";
import { useHandDock } from "./hand-dock";
import { useMediaQuery } from "./use-media-query";

const DEVELOPMENT_STACK_ID = "game-hand-dev-cards";
/** From md up the hand is one row of one fixed width in the dock (styles/game-dock.css). */
const DOCK_ROW_QUERY = "(min-width: 48rem)";
/**
 * The room kept for development cards holds three cards side by side from lg up and two at md
 * (--dock-dev-width in styles/game-dock.css); the victory point card takes the last of them.
 */
const DEVELOPMENT_ROOM_QUERY = "(min-width: 64rem)";
/** The victory point card's count, as the card flights name it. */
const VICTORY_POINT_TARGET = getFlightEndpointKey({ kind: "hand-victory-point" });
/** The counts cards fly to or from: the resource cards' and the victory point card's. */
const HAND_TARGETS = [...RESOURCE_ORDER.map(getHandTarget), VICTORY_POINT_TARGET];

/** Names that fit under a hand card. */
const DEVELOPMENT_CARD_SHORT_LABELS: Readonly<Record<PlayableDevelopmentCardType, string>> = {
  knight: "Knight",
  monopoly: "Mono",
  "road-building": "Roads",
  "year-of-plenty": "Plenty",
};

interface ResourceAnimation extends ResourceCardChange {
  id: string;
  /** Stands in for cards a dropped flight never landed (card-flight-layer.tsx). */
  missed?: true;
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

/**
 * A count chip that pops when its number changes. A change that cards fly in or out of the hand
 * shows only as they land or leave (`shown`, from useShownCounts), and then only brightens with
 * their landing (card-flight-layer.tsx), so one card never pops twice. `children` stand in for the
 * number (the victory point card's star).
 */
function CountChip({
  children,
  count,
  shown = count,
}: {
  children?: ReactNode;
  count: number;
  shown?: number;
}) {
  const [pop, setPop] = useState({ count, key: 0, shown });
  let { key } = pop;
  if (pop.count !== count || pop.shown !== shown) {
    // Remounted, so popped, only when the count and the number shown change together.
    key += pop.count !== count && pop.shown !== shown ? 1 : 0;
    setPop({ count, key, shown });
  }
  return (
    <span aria-hidden="true" className="game-count-chip motion-safe:animate-game-pop" key={key}>
      {children ?? shown}
    </span>
  );
}

/**
 * The viewer's cards in one row: five resource cards (always shown, dimmed at zero), a thin
 * divider, the development cards they can play, then their victory point cards as one card of
 * their own, all the same size. Gains fly in and pop the card; spends fly out.
 *
 * Victory point cards are never played, so they stay out of the development cards' fan, stack and
 * "Dev ×N" count: one gold-marked card at the end of the hand says how many points they are worth
 * ("+2 VP"), and it shows only while the player holds one.
 *
 * From md up the hand keeps one width whatever it holds, so the dock never shifts as cards come
 * and go: after the resources it keeps room for the development cards, two cards wide at md and
 * three from lg up (styles/game-dock.css). The victory point card takes the last of those slots;
 * the playable kinds share the rest, side by side while they fit and fanned when they don't, each
 * overlapping the one after it, its art, count and Play pill still showing. With no victory point
 * card they spread over the whole room; with no development cards at all, a dashed card says so.
 * Where only one card's room is left for them (md, beside a victory point card), a lone kind shows
 * as itself and more gather into one "Dev ×N" stack that opens them in a small popover above the
 * hand. On phones the row shows every kind side by side while they fit the shelf and stacks them
 * when they don't, the victory point card after them; when the row still overflows, the hidden
 * end fades and an arrow scrolls it.
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
  const flightStore = useCardFlights()?.store;
  const shownCountOf = useShownCounts(HAND_TARGETS);
  const dockRow = useMediaQuery(DOCK_ROW_QUERY);
  const wideRoom = useMediaQuery(DEVELOPMENT_ROOM_QUERY);
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
  const {
    kinds: developmentKinds,
    total: developmentTotal,
    victoryPoints,
  } = splitDevelopmentHand(me.developmentCards);
  const kindCount = developmentKinds.length;
  const hasVictoryCard = victoryPoints > 0;
  // A bought victory point card counts as it lands (card-flight-layer.tsx).
  const shownVictoryPoints = shownCountOf(VICTORY_POINT_TARGET, victoryPoints);
  const isPlayable = (card: DevelopmentKind) => playableDevelopmentCards.includes(card.id);
  // From md up: the cards the room holds side by side once the victory point card has its slot.
  const fanSlots = (wideRoom ? 3 : 2) - (hasVictoryCard ? 1 : 0);
  const showStack = kindCount > 1 && (dockRow ? fanSlots < 2 : overflowsShelf);
  const fanOverlaps = kindCount > fanSlots;
  const popoverOpen = showStack && stackOpen;
  const stackPlayableCount = developmentKinds.filter(isPlayable).length;
  const handCardCount = RESOURCE_ORDER.length + kindCount + (hasVictoryCard ? 1 : 0);
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

    // Cards flying in or out from the table (card-flight-layer.tsx) show themselves.
    const changes = getResourceCardChanges(
      previousSnapshot.resources,
      nextSnapshot.resources,
    ).filter((change) => !flightStore?.isCarried(actionNumber, getHandTarget(change.resource)));
    const shelf = shelfRef.current;
    if (changes.length === 0 || !shelf) {
      return;
    }

    const animations = placeResourceAnimations(shelf, changes, `${me.id}:${actionNumber}`);
    setResourceAnimations((current) => [
      ...current.filter((animation) => animation.missed),
      ...animations,
    ]);
  }, [
    actionNumber,
    flightStore,
    me.id,
    me.resources.brick,
    me.resources.sheep,
    me.resources.stone,
    me.resources.tree,
    me.resources.wheat,
  ]);

  // Cards a dropped burst was to fly into or out of the hand: the hand shows them itself.
  useEffect(() => {
    if (!flightStore) {
      return;
    }
    let dropCount = 0;
    return flightStore.onMissed((missed) => {
      const changes = RESOURCE_ORDER.flatMap((resource): ResourceCardChange[] => {
        const target = getHandTarget(resource);
        const delta = missed.reduce(
          (total, change) => (change.target === target ? total + change.delta : total),
          0,
        );
        return delta === 0
          ? []
          : [{ amount: Math.abs(delta), direction: delta > 0 ? "receive" : "spend", resource }];
      });
      const shelf = shelfRef.current;
      if (changes.length === 0 || !shelf) {
        return;
      }
      dropCount += 1;
      const animations = placeResourceAnimations(shelf, changes, `${me.id}:dropped:${dropCount}`);
      setResourceAnimations((current) => [
        ...current,
        ...animations.map((animation) => ({ ...animation, missed: true as const })),
      ]);
    });
  }, [flightStore, me.id]);

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
        setOverflowsShelf(needsStack(cardList, shelfWidth, kindCount, handCardCount));
        fitCardGap(cardList, shelfWidth);
      }
      setScrollEdges((current) => getScrollEdges(current, cardList, shelfWidth));
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(cardList);
    measure();
    return () => resizeObserver.disconnect();
  }, [dockRow, handCardCount, kindCount, showStack]);

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
  const renderDevelopmentCard = (card: DevelopmentKind, fanIndex?: number) => {
    const playable = isPlayable(card);
    const note = playable
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
        <CountChip count={card.count} />
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

  /**
   * The "Dev ×N" stack of the playable kinds: a card of the row on phones, and the room left beside
   * the victory point card at md.
   */
  const renderStack = (Element: "div" | "li") => (
    <Element
      className="game-hand-card"
      data-development
      data-hand-dev
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

  /**
   * The victory point cards as one card at the end of the hand: never played, so no Play pill. A
   * bought one still in the air keeps its slot, so it lands there, and shows as it lands; the card
   * then pops in once (remounted), and a later one only brightens its star as it lands. The slot
   * itself never fades in, so the flight layer finds it showing the moment the card leaves.
   */
  const renderVictoryCard = () => {
    const arriving = shownVictoryPoints === 0;
    const words = describeVictoryPoints(victoryPoints);
    return (
      <Tooltip key={arriving ? "victory-arriving" : "victory"} label={words} side="top">
        <li
          aria-label={`+${victoryPoints} VP: ${words}`}
          className={arriving ? "game-hand-card" : "game-hand-card motion-safe:animate-game-pop"}
          data-arriving={arriving || undefined}
          data-development
          data-hand-vp
          data-victory
        >
          <span aria-hidden="true" className="game-hand-card-face">
            <CardArt path={DEVELOPMENT_CARD_ASSET_PATHS["victory-point"]} />
          </span>
          <CountChip count={victoryPoints} shown={shownVictoryPoints}>
            <Icon className="game-hand-vp-star" icon={starIcon} />
          </CountChip>
          <span aria-hidden="true" className="game-hand-card-label">
            +{shownVictoryPoints} VP
          </span>
        </li>
      </Tooltip>
    );
  };

  // From md up: the room kept for the development cards, the same width whatever it holds. The
  // victory point card follows it in its last slot, and the room gives that slot up to it. With no
  // development cards at all, a dashed card; with victory point cards alone, the playable kinds'
  // part of the room stays empty.
  const developmentArea = !dockRow ? null : showStack ? (
    <li className="game-hand-dev" data-beside-vp={hasVictoryCard || undefined}>
      {renderStack("div")}
    </li>
  ) : (
    <li
      aria-hidden={kindCount === 0 && hasVictoryCard ? true : undefined}
      className="game-hand-dev"
      data-beside-vp={hasVictoryCard || undefined}
      data-empty={(kindCount === 0 && !hasVictoryCard) || undefined}
      data-hand-dev
    >
      {kindCount > 0 ? (
        <>
          <ul
            aria-label="Development cards"
            className="game-hand-fan"
            data-overlap={fanOverlaps || undefined}
            style={{ "--fan-count": kindCount } as CSSProperties}
          >
            {developmentKinds.map((card, index) => renderDevelopmentCard(card, index))}
          </ul>
          {fanOverlaps ? (
            <span aria-hidden="true" className="game-hand-card-label game-hand-fan-label">
              Dev ×{developmentTotal}
            </span>
          ) : null}
        </>
      ) : hasVictoryCard ? null : (
        <>
          <span aria-hidden="true" className="game-hand-dev-empty">
            <CardArt path={DEVELOPMENT_CARD_BACK_ASSET_PATH} />
          </span>
          <span className="game-hand-card-label game-hand-dev-empty-label">No dev cards</span>
        </>
      )}
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
            // Cards still flying in or out count as they land or leave.
            const shownCount = shownCountOf(getHandTarget(resource), displayedCount);
            const name = RESOURCE_LABELS[resource];

            return (
              <li
                aria-label={
                  picking
                    ? `${name}: ${available} available, ${selected} in ${picking.label}`
                    : `${name}: ${me.resources[resource]}`
                }
                className="game-hand-card"
                data-empty={shownCount === 0 || undefined}
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
                <CountChip count={displayedCount} shown={shownCount} />
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
          {dockRow || kindCount > 0 || hasVictoryCard ? (
            <li aria-hidden="true" className="game-hand-divider" role="presentation" />
          ) : null}
          {dockRow
            ? developmentArea
            : showStack
              ? renderStack("li")
              : developmentKinds.map((card) => renderDevelopmentCard(card))}
          {hasVictoryCard ? renderVictoryCard() : null}
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
              {developmentKinds.map((card) => renderDevelopmentCard(card))}
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

/** The hand card's count, as the flights and the store name it. */
function getHandTarget(resource: ResourceType): string {
  return getFlightEndpointKey({ kind: "hand", resource });
}

/** Each change as a flight onto its card, wherever the row is aligned or scrolled. */
function placeResourceAnimations(
  shelf: HTMLElement,
  changes: readonly ResourceCardChange[],
  idPrefix: string,
): ResourceAnimation[] {
  // Kept inside the shelf.
  const shelfBox = shelf.getBoundingClientRect();
  return changes.map((change) => {
    const cardBox = shelf
      .querySelector(`[data-resource="${change.resource}"]`)
      ?.getBoundingClientRect();
    const center = cardBox ? cardBox.left + cardBox.width / 2 - shelfBox.left : 0;
    return {
      ...change,
      id: `${idPrefix}:${change.resource}`,
      x: Math.min(Math.max(center, 0), shelfBox.width),
    };
  });
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
 * Whether the playable kinds must gather into one stack: the row laid out with every kind side by
 * side (five resource cards, the divider, one card per kind, then any victory point card: `slots`
 * cards in all), at the smallest gap, would be wider than `room`. With one kind there is nothing to
 * gather.
 */
function needsStack(list: HTMLElement, room: number, kinds: number, slots: number): boolean {
  const card = list.querySelector<HTMLElement>(":scope > .game-hand-card");
  const divider = list.querySelector<HTMLElement>(":scope > .game-hand-divider");
  if (!card || !divider || kinds < 2) {
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
