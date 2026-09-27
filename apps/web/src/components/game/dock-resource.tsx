"use client";

import { RESOURCE_ORDER, type ResourceInventory, type ResourceType } from "@settersaga/game";
import minusIcon from "@iconify-icons/solar/minus-circle-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";

function ResourceArt({ className, resource }: { className: string; resource: ResourceType }) {
  return (
    <Image
      alt=""
      className={className}
      draggable={false}
      height={768}
      loading="eager"
      sizes="3.5rem"
      src={RESOURCE_CARD_ASSET_PATHS[resource]}
      width={512}
    />
  );
}

/**
 * A price on one line: a coin per resource, in hand order, with "×n" beside the coin when more
 * than one card is needed. Every price is drawn the same way; what the player is missing is said
 * in words on the tile's status line, never marked on the coins.
 */
export function CostPips({ cost }: { cost: Readonly<ResourceInventory> }) {
  return (
    <span aria-hidden="true" className="game-cost-pips">
      {RESOURCE_ORDER.filter((resource) => cost[resource] > 0).map((resource) => (
        <span className="game-cost-item" key={resource}>
          <span className="game-resource-coin">
            <ResourceArt className="game-resource-coin-art" resource={resource} />
          </span>
          {cost[resource] > 1 ? (
            <span className="game-cost-count">
              <span className="game-cost-times">×</span>
              {cost[resource]}
            </span>
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
