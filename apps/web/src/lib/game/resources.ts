import {
  ANY_PORT_TRADE_RATIO,
  BANK_TRADE_RATIO,
  RESOURCE_ORDER,
  RESOURCE_PORT_TRADE_RATIO,
  emptyInventory,
  getBoardTopology,
  totalResources,
  type PlayerGameView,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";

import { RESOURCE_LABELS } from "@/constants/game/labels";

export function getMissingInventory(
  required: Readonly<ResourceInventory>,
  available: Readonly<ResourceInventory>,
): ResourceInventory {
  const missing = emptyInventory();
  for (const resource of RESOURCE_ORDER) {
    missing[resource] = Math.max(0, required[resource] - available[resource]);
  }
  return missing;
}

/** "1 Brick, 2 Wheat" for display and screen-reader copy. */
export function formatInventory(inventory: Readonly<ResourceInventory>): string {
  const parts = RESOURCE_ORDER.flatMap((resource) =>
    inventory[resource] > 0 ? [`${inventory[resource]} ${RESOURCE_LABELS[resource]}`] : [],
  );
  return parts.length > 0 ? parts.join(", ") : "no cards";
}

/** "You need 1 Sheep and 1 Wheat", or null when the price is covered. */
export function getMissingResourcesReason(
  cost: Readonly<ResourceInventory>,
  resources: Readonly<ResourceInventory>,
): string | null {
  const missing = getMissingInventory(cost, resources);
  if (totalResources(missing) === 0) {
    return null;
  }
  const parts = RESOURCE_ORDER.flatMap((resource) =>
    missing[resource] > 0 ? [`${missing[resource]} ${RESOURCE_LABELS[resource]}`] : [],
  );
  const last = parts.pop();
  return `You need ${parts.length > 0 ? `${parts.join(", ")} and ${last}` : last}`;
}

/**
 * How many of each resource the bank takes for one card from this player: 2 with that resource's
 * port, 3 with an "any" port, otherwise 4. A port counts once the player has a building on one of
 * its two corners.
 */
export function getBankRates(
  board: PlayerGameView["board"],
  playerId: string,
): Record<ResourceType, number> {
  const edgeVertices = getBoardTopology(board.tiles).edgeVertices;
  const ownedCorners = new Set(
    board.buildings
      .filter((building) => building.playerId === playerId)
      .map((building) => building.vertexKey),
  );
  const ownedPorts = new Set(
    board.ports
      .filter((port) => edgeVertices[port.edgeKey]?.some((vertex) => ownedCorners.has(vertex)))
      .map((port) => port.trade),
  );
  const base = ownedPorts.has("any") ? ANY_PORT_TRADE_RATIO : BANK_TRADE_RATIO;
  const rates = {} as Record<ResourceType, number>;
  for (const resource of RESOURCE_ORDER) {
    rates[resource] = ownedPorts.has(resource) ? RESOURCE_PORT_TRADE_RATIO : base;
  }
  return rates;
}
