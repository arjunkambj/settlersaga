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
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { type AnimationEvent, type CSSProperties, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DEVELOPMENT_CARD_ASSETS, RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import { getResourceCardChanges, type ResourceCardChange } from "@/lib/game/resource-card-changes";

import { useHandDock } from "./hand-dock";

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
  start: boolean;
}

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
 * The viewer's cards: five resource cards (always shown, dimmed at zero) then development cards,
 * all the same size. Gains fly in and pop the card; spends fly out. When the row overflows, the
 * hidden end fades and an arrow scrolls it.
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
  const shelfRef = useRef<HTMLDivElement>(null);
  const cardListRef = useRef<HTMLUListElement>(null);
  const previousSnapshotRef = useRef<ResourceSnapshot | null>(null);
  const [resourceAnimations, setResourceAnimations] = useState<ResourceAnimation[]>([]);
  const [scrollEdges, setScrollEdges] = useState<ScrollEdges>({ end: false, start: false });
  const overflows = scrollEdges.start || scrollEdges.end;
  const developmentCardCounts = DEVELOPMENT_CARD_ASSETS.flatMap((asset) => {
    const count = me.developmentCards.filter((card) => card === asset.id).length;
    return count > 0 ? [{ ...asset, count }] : [];
  });
  const handCardCount = RESOURCE_ORDER.length + developmentCardCounts.length;
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

  // Re-measure when cards are added or removed; the list's own box does not resize then.
  useEffect(() => {
    const cardList = cardListRef.current;
    if (!cardList) {
      return;
    }

    const measure = () => setScrollEdges((current) => getScrollEdges(current, cardList));
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(cardList);
    measure();
    return () => resizeObserver.disconnect();
  }, [handCardCount]);

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
          {developmentCardCounts.map((card) => {
            const playable =
              card.id !== "victory-point" && playableDevelopmentCards.includes(card.id);
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
                key={card.id}
              >
                <span aria-hidden="true" className="game-hand-card-face">
                  <CardArt path={card.path} />
                </span>
                <CountChip count={card.count} key={card.count} />
                {playable ? (
                  <button
                    aria-label={`Play ${card.label}: ${card.description}`}
                    className="game-hand-card-button"
                    disabled={pending}
                    onClick={() => onPlayDevelopmentCard(card.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className="game-hand-play">
                      Play
                    </span>
                  </button>
                ) : (
                  <span aria-hidden="true" className="game-hand-card-label">
                    {DEVELOPMENT_CARD_SHORT_LABELS[card.id]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {scrollEdges.start ? (
          <Button
            aria-label="Show earlier cards"
            className="game-hand-scroll"
            data-edge="start"
            onClick={() => scrollCards(-1)}
            size="game-md"
            tabIndex={-1}
            variant="game-icon"
          >
            <Icon aria-hidden="true" icon={arrowLeftIcon} />
          </Button>
        ) : null}
        {scrollEdges.end ? (
          <Button
            aria-label="Show more cards"
            className="game-hand-scroll"
            data-edge="end"
            onClick={() => scrollCards(1)}
            size="game-md"
            tabIndex={-1}
            variant="game-icon"
          >
            <Icon aria-hidden="true" icon={arrowRightIcon} />
          </Button>
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

/** Which ends of the card row are scrolled out of view. */
function getScrollEdges(current: ScrollEdges, list: HTMLElement): ScrollEdges {
  const start = list.scrollLeft > 1;
  const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
  return current.start === start && current.end === end ? current : { end, start };
}
