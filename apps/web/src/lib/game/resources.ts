import {
  RESOURCE_ORDER,
  emptyInventory,
  totalResources,
  type ResourceInventory,
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
