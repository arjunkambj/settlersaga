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

export function getMissingResourcesReason(
  cost: Readonly<ResourceInventory>,
  resources: Readonly<ResourceInventory>,
): string | null {
  const missing = getMissingInventory(cost, resources);
  return totalResources(missing) > 0 ? `Need ${formatInventory(missing)}` : null;
}
