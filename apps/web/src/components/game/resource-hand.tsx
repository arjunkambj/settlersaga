"use client";

import {
  RESOURCE_ORDER,
  type DevelopmentCardType,
  type PlayableDevelopmentCardType,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { DEVELOPMENT_CARD_ASSETS, RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { getResourceCardChanges, type ResourceCardChange } from "@/lib/game/resource-card-changes";
import { HAND_DOCK_ROOT_ID, useHandDock } from "./hand-dock";
import { RESOURCE_LABELS } from "./resource-icon";

interface ResourceAnimation extends ResourceCardChange {
  id: string;
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

const RESOURCE_FLIGHT_STYLES: Readonly<Record<ResourceType, ResourceFlightStyle>> =
  Object.fromEntries(
    RESOURCE_ORDER.map((resource, index) => [
      resource,
      {
        "--resource-flight-delay": `${index * 30}ms`,
        "--resource-flight-tilt": `${(index - 2) * 1.6}deg`,
        "--resource-flight-x": `${(2 - index) * 0.72}rem`,
      },
    ]),
  ) as Record<ResourceType, ResourceFlightStyle>;

function copyInventory(resources: Readonly<ResourceInventory>): ResourceInventory {
  return {
    brick: resources.brick,
    sheep: resources.sheep,
    stone: resources.stone,
    tree: resources.tree,
    wheat: resources.wheat,
  };
}

function GameCardArtwork({
  className,
  path,
  sizes,
}: {
  className: string;
  path: string;
  sizes: string;
}) {
  return (
    <Image
      alt=""
      className={className}
      data-card-asset={path}
      draggable={false}
      height={768}
      loading="eager"
      sizes={sizes}
      src={path}
      width={512}
    />
  );
}

export function ResourceHand({
  actionNumber,
  me,
  notice,
  onPlayDevelopmentCard,
  pending,
  playableDevelopmentCards,
}: {
  actionNumber: number;
  me: PrivatePlayerState;
  notice?: ReactNode;
  onPlayDevelopmentCard(card: PlayableDevelopmentCardType): void;
  pending: boolean;
  playableDevelopmentCards: readonly PlayableDevelopmentCardType[];
}) {
  const { interaction } = useHandDock();
  const resourceListRef = useRef<HTMLUListElement>(null);
  const previousSnapshotRef = useRef<ResourceSnapshot | null>(null);
  const [resourceAnimations, setResourceAnimations] = useState<ResourceAnimation[]>([]);
  const [resourceListOverflows, setResourceListOverflows] = useState(false);
  const developmentCardCounts = DEVELOPMENT_CARD_ASSETS.flatMap((asset) => {
    const count = me.developmentCards.filter((card) => card === asset.id).length;
    return count > 0 ? [{ ...asset, count }] : [];
  });
  const interactionMatchesSource =
    interaction !== null &&
    RESOURCE_ORDER.every(
      (resource) => interaction.sourceResources[resource] === me.resources[resource],
    );
  useEffect(() => {
    const nextSnapshot: ResourceSnapshot = {
      actionNumber,
      playerId: me.id,
      resources: copyInventory(me.resources),
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
    if (changes.length === 0) {
      return;
    }

    setResourceAnimations(
      changes.map((change) => ({
        ...change,
        id: `${me.id}:${actionNumber}:${change.resource}`,
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

  useEffect(() => {
    const resourceList = resourceListRef.current;
    if (!resourceList) {
      return;
    }

    const updateOverflow = () =>
      setResourceListOverflows(resourceList.scrollWidth > resourceList.clientWidth + 1);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateOverflow);
    resizeObserver?.observe(resourceList);
    window.addEventListener("resize", updateOverflow, { passive: true });
    updateOverflow();

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, []);

  const finishAnimation = (animationId: string, event: AnimationEvent<HTMLSpanElement>) => {
    if (event.currentTarget !== event.target) {
      return;
    }

    setResourceAnimations((current) => current.filter((animation) => animation.id !== animationId));
  };

  return (
    <section aria-label="Your cards" className="resource-hand">
      {notice}
      <div className="hand-dock" id={HAND_DOCK_ROOT_ID} />
      <div className="hand-viewport">
        <ul
          aria-label={
            resourceListOverflows
              ? "Your private cards. Use the left and right arrow keys to scroll."
              : undefined
          }
          className="resource-card-list"
          ref={resourceListRef}
          tabIndex={resourceListOverflows ? 0 : undefined}
        >
          {RESOURCE_ORDER.map((resource) => {
            const selected =
              interaction && interactionMatchesSource
                ? Math.min(me.resources[resource], interaction.selected[resource])
                : 0;
            const available = me.resources[resource] - selected;
            const preserveHandAppearance = interaction?.preserveHandAppearance === true;
            const displayedCount = preserveHandAppearance ? me.resources[resource] : available;

            return (
              <li
                aria-label={
                  interaction && interactionMatchesSource
                    ? `${RESOURCE_LABELS[resource]}: ${available} available, ${selected} selected for ${interaction.label}`
                    : `${RESOURCE_LABELS[resource]}: ${me.resources[resource]}`
                }
                className={[
                  "resource-card",
                  "resource-card-face",
                  `resource-${resource}`,
                  selected > 0 && !preserveHandAppearance ? "is-selected" : "",
                  interaction && interactionMatchesSource ? "is-selectable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-empty={displayedCount === 0 ? "true" : undefined}
                data-selected={selected > 0 && !preserveHandAppearance ? "true" : undefined}
                key={resource}
                title={`${RESOURCE_LABELS[resource]} · ${available} available${
                  selected > 0 ? ` · ${selected} selected` : ""
                }`}
              >
                <span className="resource-card-art" aria-hidden="true">
                  <GameCardArtwork
                    className="resource-card-image"
                    path={RESOURCE_CARD_ASSET_PATHS[resource]}
                    sizes="4.5rem"
                  />
                </span>
                <span aria-hidden="true" className="resource-card-count">
                  {displayedCount}
                </span>
                {selected > 0 && !preserveHandAppearance ? (
                  <span aria-hidden="true" className="resource-card-selected">
                    {selected} selected
                  </span>
                ) : null}
                {interaction && interactionMatchesSource ? (
                  <Button
                    aria-label={`Move one ${RESOURCE_LABELS[resource]} from your hand to ${interaction.label}`}
                    className="resource-card-select"
                    disabled={interaction.disabled || available === 0}
                    onClick={() => interaction.onSelect(resource)}
                    variant="ghost"
                  >
                    <span className="sr-only">
                      {available} available, {selected} selected
                    </span>
                  </Button>
                ) : null}
              </li>
            );
          })}
          {developmentCardCounts.length > 0 ? (
            <li aria-hidden="true" className="hand-card-divider" />
          ) : null}
          {developmentCardCounts.map((card) => {
            const playable =
              card.id !== "victory-point" && playableDevelopmentCards.includes(card.id);
            return (
              <li
                aria-label={`${card.label} development cards: ${card.count}. ${card.description}`}
                className={[
                  "resource-card resource-card-face development-card-face",
                  playable ? "is-playable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={card.id}
              >
                <span className="resource-card-art" aria-hidden="true">
                  <Image
                    alt=""
                    className="resource-card-image"
                    draggable={false}
                    height={768}
                    loading="eager"
                    sizes="4.5rem"
                    src={card.path}
                    width={512}
                  />
                </span>
                <span aria-hidden="true" className="resource-card-count">
                  {card.count}
                </span>
                <DevelopmentCardButton
                  card={card.id}
                  count={card.count}
                  description={card.description}
                  label={card.label}
                  onPlayDevelopmentCard={onPlayDevelopmentCard}
                  pending={pending}
                  playableDevelopmentCards={playableDevelopmentCards}
                />
              </li>
            );
          })}
        </ul>
        <div aria-hidden="true" className="resource-flight-layer">
          {resourceAnimations.map((animation) => {
            const column = RESOURCE_ORDER.indexOf(animation.resource) + 1;

            return (
              <span
                className="resource-flight-anchor"
                key={animation.id}
                style={{
                  ...RESOURCE_FLIGHT_STYLES[animation.resource],
                  gridColumn: column,
                }}
              >
                <span
                  className={`resource-flight resource-flight--${animation.direction === "receive" ? "receive" : "spend"}`}
                  onAnimationEnd={(event) => finishAnimation(animation.id, event)}
                >
                  <GameCardArtwork
                    className="resource-flight-image"
                    path={RESOURCE_CARD_ASSET_PATHS[animation.resource]}
                    sizes="2.65rem"
                  />
                  <span className="resource-flight-badge">
                    {animation.direction === "receive" ? "+" : "−"}
                    {animation.amount}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DevelopmentCardButton({
  card,
  count,
  description,
  label,
  onPlayDevelopmentCard,
  pending,
  playableDevelopmentCards,
}: {
  card: DevelopmentCardType;
  count: number;
  description: string;
  label: string;
  onPlayDevelopmentCard(card: PlayableDevelopmentCardType): void;
  pending: boolean;
  playableDevelopmentCards: readonly PlayableDevelopmentCardType[];
}) {
  const playable = card !== "victory-point" && playableDevelopmentCards.includes(card);
  const status =
    card === "victory-point"
      ? "This card counts automatically."
      : playable
        ? "Play this card."
        : "This card cannot be played right now.";

  return (
    <Button
      aria-label={`${label} development cards: ${count}. ${description} ${status}`}
      className="resource-card-select"
      disabled={pending || !playable}
      onClick={() => {
        if (card !== "victory-point") {
          onPlayDevelopmentCard(card);
        }
      }}
      variant="ghost"
    >
      <span className="sr-only">{status}</span>
    </Button>
  );
}
