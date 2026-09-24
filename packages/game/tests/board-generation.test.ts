import { describe, expect, test } from "bun:test";

import { TERRAIN_RESOURCE } from "../src/constants";
import {
  AVAILABLE_GAME_MAPS,
  NUMBER_TOKEN_PIPS,
  axialToPixel,
  createBoard,
  getBoardTopology,
  type ResourceType,
} from "../src/index";
import type { NumberToken, TileState } from "../src/types";

const OFFICIAL_BASE_NUMBER_SEQUENCE: NumberToken[] = [
  5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
];

function coordinateRadius({ q, r }: TileState): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}

function clockwiseAngleFromTop(tile: TileState): number {
  const point = axialToPixel(tile, 1);
  return (Math.atan2(point.y, point.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
}

function orientRing(ring: readonly TileState[], orientation: number, direction: number) {
  const start = orientation * (ring.length / 6);
  return Array.from({ length: ring.length }, (_, index) =>
    ring.at((start + direction * index + ring.length) % ring.length),
  ).filter((tile): tile is TileState => tile !== undefined);
}

function createNumberSpirals(tiles: readonly TileState[]) {
  const outer = tiles
    .filter((tile) => coordinateRadius(tile) === 2)
    .sort((first, second) => clockwiseAngleFromTop(first) - clockwiseAngleFromTop(second));
  const inner = tiles
    .filter((tile) => coordinateRadius(tile) === 1)
    .sort((first, second) => clockwiseAngleFromTop(first) - clockwiseAngleFromTop(second));
  const center = tiles.find((tile) => coordinateRadius(tile) === 0);

  if (!center) throw new Error("Base board needs a center tile");

  return Array.from({ length: 6 }, (_, orientation) =>
    [-1, 1].map((direction) => [
      ...orientRing(outer, orientation, direction),
      ...orientRing(inner, orientation, direction),
      center,
    ]),
  ).flat();
}

describe("board generation", () => {
  test("places the official sequence outer-ring inward under a seeded dihedral orientation", () => {
    for (const seed of ["base-sequence-a", "base-sequence-b", "base-sequence-c"]) {
      const board = createBoard("base", seed);
      const sequences = createNumberSpirals(board.tiles).map((spiral) =>
        spiral.flatMap((tile) => (tile.numberToken === null ? [] : [tile.numberToken])),
      );

      expect(sequences).toContainEqual(OFFICIAL_BASE_NUMBER_SEQUENCE);
    }
  });

  test("keeps equal and red numbers apart and 2/12 on the coast on every map", () => {
    for (const map of AVAILABLE_GAME_MAPS) {
      for (let index = 0; index < 100; index += 1) {
        const board = createBoard(map.id, `number-invariants-${index}`);
        const topology = getBoardTopology(board.tiles);
        const numberByTileId = new Map(board.tiles.map((tile) => [tile.id, tile.numberToken]));
        const coastTileIds = new Set(
          topology.coastEdgeKeys.flatMap((edgeKey) => topology.edgeTileIds[edgeKey]!),
        );

        for (const tile of board.tiles) {
          if (tile.numberToken === 2 || tile.numberToken === 12) {
            expect(coastTileIds.has(tile.id)).toBe(true);
          }
        }

        for (const tileIds of Object.values(topology.edgeTileIds)) {
          if (tileIds.length !== 2) continue;
          const firstNumber = numberByTileId.get(tileIds[0]!);
          const secondNumber = numberByTileId.get(tileIds[1]!);

          if (firstNumber != null) {
            expect(firstNumber).not.toBe(secondNumber);
          }
          if (firstNumber === 6 || firstNumber === 8) {
            expect(secondNumber === 6 || secondNumber === 8).toBe(false);
          }
        }
      }
    }
  });

  test("keeps every base board's resource pips balanced with red numbers on three resources", () => {
    for (let index = 0; index < 100; index += 1) {
      const board = createBoard("base", `base-resource-balance-${index}`);
      const resourcePips = new Map<ResourceType, number>();
      const redResources = new Set<ResourceType>();

      for (const tile of board.tiles) {
        const resource = TERRAIN_RESOURCE[tile.terrain];
        if (resource === null || tile.numberToken === null) continue;

        resourcePips.set(
          resource,
          (resourcePips.get(resource) ?? 0) + NUMBER_TOKEN_PIPS[tile.numberToken],
        );
        if (tile.numberToken === 6 || tile.numberToken === 8) {
          redResources.add(resource);
        }
      }

      expect(redResources.size).toBeGreaterThanOrEqual(3);
      const pipTotals = [...resourcePips.values()];
      expect(Math.max(...pipTotals) - Math.min(...pipTotals)).toBeLessThanOrEqual(8);
    }
  });

  test("lays out each map's terrain, numbers and harbours with the robber on a desert", () => {
    const sorted = (values: readonly (number | string)[]) => values.map(String).toSorted();

    for (const map of AVAILABLE_GAME_MAPS) {
      const board = createBoard(map.id, `map-contents-${map.id}`);
      const robberTile = board.tiles.find((tile) => tile.id === board.robberTileId)!;

      expect(
        Object.fromEntries(
          Object.keys(map.terrainCounts).map((terrain) => [
            terrain,
            board.tiles.filter((tile) => tile.terrain === terrain).length,
          ]),
        ),
      ).toEqual(map.terrainCounts);
      expect(sorted(board.tiles.flatMap((tile) => tile.numberToken ?? []))).toEqual(
        sorted(map.numberTokens),
      );
      expect(sorted(board.ports.map((port) => port.trade))).toEqual(sorted(map.portTrades));
      expect(robberTile.terrain).toBe("desert");
    }
  });

  test("builds the 5–6 player island in columns of 3, 4, 5, 6, 5, 4 and 3 tiles", () => {
    const board = createBoard("extended-6", "extended-6-shape");
    const columnHeights = [-3, -2, -1, 0, 1, 2, 3].map(
      (q) => board.tiles.filter((tile) => tile.q === q).length,
    );

    expect(columnHeights).toEqual([3, 4, 5, 6, 5, 4, 3]);
  });

  test("builds the same board for a seed and different boards for different seeds", () => {
    for (const map of AVAILABLE_GAME_MAPS) {
      expect(createBoard(map.id, "repeatable")).toEqual(createBoard(map.id, "repeatable"));
      expect(createBoard(map.id, "repeatable")).not.toEqual(createBoard(map.id, "different"));
    }
  });
});
