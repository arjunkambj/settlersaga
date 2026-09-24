import { RESOURCE_ORDER, type ResourceInventory, type ResourceType } from "@settersaga/game";

export interface ResourceCardChange {
  amount: number;
  direction: "receive" | "spend";
  resource: ResourceType;
}

export function getResourceCardChanges(
  previous: Readonly<ResourceInventory>,
  current: Readonly<ResourceInventory>,
): ResourceCardChange[] {
  return RESOURCE_ORDER.flatMap((resource) => {
    const difference = current[resource] - previous[resource];
    if (difference === 0) {
      return [];
    }

    return [
      {
        amount: Math.abs(difference),
        direction: difference > 0 ? ("receive" as const) : ("spend" as const),
        resource,
      },
    ];
  });
}
