import { describe, expect, test } from "bun:test";

import {
  getResourceCardChanges,
  type ResourceCardChange,
} from "../src/lib/game/resource-card-changes";

const INITIAL_RESOURCES = {
  brick: 2,
  sheep: 3,
  stone: 1,
  tree: 4,
  wheat: 2,
} as const;

describe("resource card changes", () => {
  test("ignores snapshots with unchanged resource counts", () => {
    expect(getResourceCardChanges(INITIAL_RESOURCES, { ...INITIAL_RESOURCES })).toEqual([]);
  });

  test("reports received and spent cards with their absolute amounts", () => {
    expect(
      getResourceCardChanges(INITIAL_RESOURCES, {
        ...INITIAL_RESOURCES,
        brick: 5,
        wheat: 0,
      }),
    ).toEqual<ResourceCardChange[]>([
      { amount: 3, direction: "receive", resource: "brick" },
      { amount: 2, direction: "spend", resource: "wheat" },
    ]);
  });

  test("keeps simultaneous changes in visual resource order", () => {
    expect(
      getResourceCardChanges(INITIAL_RESOURCES, {
        brick: 1,
        sheep: 5,
        stone: 0,
        tree: 6,
        wheat: 2,
      }),
    ).toEqual<ResourceCardChange[]>([
      { amount: 2, direction: "receive", resource: "tree" },
      { amount: 1, direction: "spend", resource: "brick" },
      { amount: 2, direction: "receive", resource: "sheep" },
      { amount: 1, direction: "spend", resource: "stone" },
    ]);
  });
});
