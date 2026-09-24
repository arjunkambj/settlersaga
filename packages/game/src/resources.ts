import { RESOURCE_TYPES } from "./types";
import type { ResourceInventory } from "./types";

export function filledInventory(count: number): ResourceInventory {
  return {
    brick: count,
    sheep: count,
    stone: count,
    tree: count,
    wheat: count,
  };
}

export function emptyInventory(): ResourceInventory {
  return filledInventory(0);
}

export function totalResources(resources: ResourceInventory) {
  return RESOURCE_TYPES.reduce((total, type) => total + resources[type], 0);
}

export function hasResources(resources: ResourceInventory, cost: Readonly<ResourceInventory>) {
  return RESOURCE_TYPES.every((type) => resources[type] >= cost[type]);
}

export function addResources(
  resources: ResourceInventory,
  added: Readonly<ResourceInventory>,
): ResourceInventory {
  return {
    brick: resources.brick + added.brick,
    sheep: resources.sheep + added.sheep,
    stone: resources.stone + added.stone,
    tree: resources.tree + added.tree,
    wheat: resources.wheat + added.wheat,
  };
}

export function subtractResources(
  resources: ResourceInventory,
  removed: Readonly<ResourceInventory>,
): ResourceInventory {
  return {
    brick: resources.brick - removed.brick,
    sheep: resources.sheep - removed.sheep,
    stone: resources.stone - removed.stone,
    tree: resources.tree - removed.tree,
    wheat: resources.wheat - removed.wheat,
  };
}

export function isValidInventory(resources: ResourceInventory) {
  return RESOURCE_TYPES.every(
    (type) => Number.isSafeInteger(resources[type]) && resources[type] >= 0,
  );
}
