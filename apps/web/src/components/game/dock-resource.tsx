"use client";

import { RESOURCE_ORDER, type ResourceInventory, type ResourceType } from "@settersaga/game";
import minusIcon from "@iconify-icons/solar/minus-circle-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { RESOURCE_CARD_ASSET_PATHS, RESOURCE_ICON_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";

function ResourceArt({
  className,
  resource,
  sizes = "3.5rem",
}: {
  className: string;
  resource: ResourceType;
  sizes?: string;
}) {
  return (
    <Image
      alt=""
      className={className}
      draggable={false}
      height={768}
      loading="eager"
      sizes={sizes}
      src={RESOURCE_CARD_ASSET_PATHS[resource]}
      width={512}
    />
  );
}

/**
 * A price as one mini card per card it takes, in hand order (a city is two Wheat and three
 * Stone). With `have`, the cards the player holds are in full color and the ones still missing
 * are ghosted, so what is short reads without words; the tile's label and tooltip say it too.
 */
export function CostCards({
  cost,
  have,
}: {
  cost: Readonly<ResourceInventory>;
  have?: Readonly<ResourceInventory>;
}) {
  return (
    <span aria-hidden="true" className="game-cost-cards">
      {RESOURCE_ORDER.flatMap((resource) =>
        Array.from({ length: cost[resource] }, (_, index) => (
          <span
            className="game-cost-card"
            data-missing={have && index >= have[resource] ? true : undefined}
            key={`${resource}-${index}`}
          >
            <ResourceArt className="game-cost-card-art" resource={resource} sizes="1.25rem" />
          </span>
        )),
      )}
    </span>
  );
}

/**
 * Cards as small resource icons in hand order, one icon per resource with its count after it when
 * there is more than one ("×2"): a price (a city is Wheat ×2, Stone ×3) or the cards still
 * missing. The words are in the surrounding label.
 */
export function ResourceIcons({ cards }: { cards: Readonly<ResourceInventory> }) {
  return (
    <span aria-hidden="true" className="game-resource-icons">
      {RESOURCE_ORDER.filter((resource) => cards[resource] > 0).map((resource) => (
        <span className="game-resource-icon" key={resource}>
          <Image
            alt=""
            className="game-resource-icon-art"
            draggable={false}
            height={256}
            loading="eager"
            sizes="1.75rem"
            src={RESOURCE_ICON_ASSET_PATHS[resource]}
            width={256}
          />
          {cards[resource] > 1 ? (
            <span className="game-resource-icon-count">×{cards[resource]}</span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/** The cards of one side of a trade, as small cards with a count chip. */
export function ResourceCardRow({
  inventory,
  label,
  shortOf,
}: {
  inventory: Readonly<ResourceInventory>;
  label: string;
  /** Cards the player would still need to pay this side, flagged on their card. */
  shortOf?: Readonly<ResourceInventory>;
}) {
  return (
    <ul aria-label={label} className="game-resource-row">
      {RESOURCE_ORDER.filter((resource) => inventory[resource] > 0).map((resource) => (
        <li
          aria-label={`${inventory[resource]} ${RESOURCE_LABELS[resource]}${
            shortOf?.[resource] ? `, ${shortOf[resource]} short` : ""
          }`}
          className="game-resource-thumb"
          data-short={shortOf?.[resource] ? true : undefined}
          key={resource}
        >
          <ResourceArt className="game-resource-thumb-art" resource={resource} />
          <span aria-hidden="true" className="game-count-chip">
            {inventory[resource]}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Five resource cards to pick from: each tap adds one (the count chip shows how many), and the
 * round button under a picked card takes one back. In "choose" mode one card is picked at a time.
 * With `held`, each card also shows how many the player holds: the corner chip is the hand count
 * and the picks move to a gold chip on the card's lower edge.
 */
export function ResourcePicker({
  canAdd,
  disabled,
  held,
  label,
  mode = "count",
  onAdd,
  onRemove,
  quantities,
}: {
  canAdd(resource: ResourceType): boolean;
  disabled: boolean;
  held?: Readonly<ResourceInventory>;
  label: string;
  mode?: "choose" | "count";
  onAdd(resource: ResourceType): void;
  onRemove?(resource: ResourceType): void;
  quantities: Readonly<ResourceInventory>;
}) {
  return (
    <ul aria-label={label} className="game-resource-picker">
      {RESOURCE_ORDER.map((resource) => {
        const quantity = quantities[resource];
        const name = RESOURCE_LABELS[resource];
        return (
          <li className="game-picker-cell" key={resource}>
            <button
              aria-label={
                mode === "choose"
                  ? name
                  : `${name}, ${quantity} picked${held ? ` of ${held[resource]}` : ""}. Add one`
              }
              aria-pressed={mode === "choose" ? quantity > 0 : undefined}
              className="game-picker-card"
              data-picked={quantity > 0 || undefined}
              disabled={disabled || !canAdd(resource)}
              onClick={() => onAdd(resource)}
              type="button"
            >
              <ResourceArt className="game-picker-card-art" resource={resource} />
              {held ? (
                <span aria-hidden="true" className="game-count-chip" data-tone="held">
                  {held[resource]}
                </span>
              ) : null}
              {mode === "count" && quantity > 0 ? (
                <span
                  aria-hidden="true"
                  className={held ? "game-picker-picked" : "game-count-chip"}
                >
                  {quantity}
                </span>
              ) : null}
            </button>
            {onRemove ? (
              <Button
                aria-label={`Take back one ${name}`}
                className="game-picker-minus"
                disabled={disabled}
                hidden={quantity === 0}
                onClick={() => onRemove(resource)}
                size="game-sm"
                variant="game-icon"
              >
                <Icon aria-hidden="true" className="size-4" icon={minusIcon} />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
