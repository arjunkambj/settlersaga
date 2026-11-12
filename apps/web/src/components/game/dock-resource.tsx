"use client";

import { RESOURCE_ORDER, type ResourceInventory, type ResourceType } from "@settersaga/game";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { MinusIcon } from "@/components/ui/step-icons";
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
 * A price as one resource icon per card it takes, in hand order (a city is two Wheat and three
 * Stone). The cards the player holds are lit and the ones still missing are faint, so the price
 * and what is short read in one line; the tile's label and tooltip say it in words.
 */
export function CostPips({
  cost,
  have,
}: {
  cost: Readonly<ResourceInventory>;
  have: Readonly<ResourceInventory>;
}) {
  return (
    <span aria-hidden="true" className="game-cost-pips">
      {RESOURCE_ORDER.flatMap((resource) =>
        Array.from({ length: cost[resource] }, (_, index) => (
          <Image
            alt=""
            className="game-cost-pip"
            data-missing={index >= have[resource] ? true : undefined}
            draggable={false}
            height={256}
            key={`${resource}-${index}`}
            loading="eager"
            sizes="1.25rem"
            src={RESOURCE_ICON_ASSET_PATHS[resource]}
            width={256}
          />
        )),
      )}
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
 * round button on a picked card's corner takes one back. In "choose" mode one card is picked at a
 * time. With `held`, each card also shows how many the player holds: the corner chip is the hand
 * count and the picks move to a chip on the card's lower edge.
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
                <MinusIcon className="size-3" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The cards put on one side of a trade so far: one small card per resource with its count. A tap
 * takes one back. While it is empty it says how to add cards.
 */
export function ResourceTray({
  cards,
  disabled,
  emptyText,
  label,
  onRemove,
}: {
  cards: Readonly<ResourceInventory>;
  disabled: boolean;
  emptyText: string;
  label: string;
  onRemove(resource: ResourceType): void;
}) {
  const picked = RESOURCE_ORDER.filter((resource) => cards[resource] > 0);
  return (
    <ul aria-label={label} className="game-trade-tray">
      {picked.length === 0 ? (
        <li className="game-trade-tray-empty">{emptyText}</li>
      ) : (
        picked.map((resource) => (
          <li key={resource}>
            <button
              aria-label={`${RESOURCE_LABELS[resource]}, ${cards[resource]}. Take one back`}
              className="game-trade-tray-card"
              disabled={disabled}
              onClick={() => onRemove(resource)}
              type="button"
            >
              <ResourceArt className="game-trade-tray-art" resource={resource} sizes="2.5rem" />
              <span aria-hidden="true" className="game-count-chip">
                {cards[resource]}
              </span>
            </button>
          </li>
        ))
      )}
    </ul>
  );
}

/** Five small cards to ask for: a tap adds one to the tray above them. */
export function ResourcePalette({
  canAdd,
  disabled,
  label,
  onAdd,
}: {
  canAdd(resource: ResourceType): boolean;
  disabled: boolean;
  label: string;
  onAdd(resource: ResourceType): void;
}) {
  return (
    <ul aria-label={label} className="game-trade-palette">
      {RESOURCE_ORDER.map((resource) => (
        <li key={resource}>
          <button
            aria-label={`Add one ${RESOURCE_LABELS[resource]}`}
            className="game-trade-palette-card"
            disabled={disabled || !canAdd(resource)}
            onClick={() => onAdd(resource)}
            type="button"
          >
            <ResourceArt className="game-trade-tray-art" resource={resource} sizes="2rem" />
          </button>
        </li>
      ))}
    </ul>
  );
}
