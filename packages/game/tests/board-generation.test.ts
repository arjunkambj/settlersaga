import { describe, expect, test } from "bun:test";

import {
  axialToPixel,
  createBoard,
  getBoardTopology,
  NUMBER_TOKEN_PIPS,
  TERRAIN_RESOURCE,
  type ResourceType,
  type TileState,
} from "../src/index";

const OFFICIAL_BASE_NUMBER_SEQUENCE = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

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

describe("base board generation", () => {
  test("places the official sequence outer-ring inward under a seeded dihedral orientation", () => {
    for (const seed of ["base-sequence-a", "base-sequence-b", "base-sequence-c"]) {
      const board = createBoard("base", seed);
      const sequences = createNumberSpirals(board.tiles).map((spiral) =>
        spiral.flatMap((tile) => (tile.numberToken === null ? [] : [tile.numberToken])),
      );

      expect(sequences).toContainEqual(OFFICIAL_BASE_NUMBER_SEQUENCE);
    }
  });

  test("keeps duplicate and red numbers apart and 2/12 on the coast", () => {
    for (let index = 0; index < 100; index += 1) {
      const board = createBoard("base", `base-invariants-${index}`);
      const topology = getBoardTopology(board.tiles);
      const numberByTileId = new Map(board.tiles.map((tile) => [tile.id, tile.numberToken]));
      const coastTileIds = new Set(
        topology.coastEdgeKeys.flatMap((edgeKey) => topology.edgeTileIds[edgeKey] ?? []),
      );

      for (const tile of board.tiles) {
        if (tile.numberToken === 2 || tile.numberToken === 12) {
          expect(coastTileIds.has(tile.id)).toBe(true);
        }
      }

      for (const tileIds of Object.values(topology.edgeTileIds)) {
        if (tileIds.length !== 2) continue;
        const [firstTileId, secondTileId] = tileIds;
        const firstNumber = firstTileId ? numberByTileId.get(firstTileId) : null;
        const secondNumber = secondTileId ? numberByTileId.get(secondTileId) : null;

        if (firstNumber != null) {
          expect(firstNumber).not.toBe(secondNumber);
        }
        if (firstNumber === 6 || firstNumber === 8) {
          expect(secondNumber === 6 || secondNumber === 8).toBe(false);
        }
      }
    }
  });

  test("balances resource production without banning natural terrain clusters", () => {
    let largestTerrainCluster = 0;

    for (let index = 0; index < 100; index += 1) {
      const board = createBoard("base", `base-resource-balance-${index}`);
      const topology = getBoardTopology(board.tiles);
      const terrainByTileId = new Map(board.tiles.map((tile) => [tile.id, tile.terrain]));
      const matchingNeighbors = new Map(board.tiles.map((tile) => [tile.id, [] as string[]]));
      const resourcePips = new Map<ResourceType, number>();
      const redResources = new Set<ResourceType>();

      for (const tile of board.tiles) {
        const resource = TERRAIN_RESOURCE[tile.terrain];
        if (resource === null || tile.numberToken === null) continue;

        resourcePips.set(
          resource,
          (resourcePips.get(resource) ?? 0) + (NUMBER_TOKEN_PIPS[tile.numberToken] ?? 0),
        );
        if (tile.numberToken === 6 || tile.numberToken === 8) {
          redResources.add(resource);
        }
      }

      expect(redResources.size).toBeGreaterThanOrEqual(3);
      const pipTotals = [...resourcePips.values()];
      expect(Math.max(...pipTotals) - Math.min(...pipTotals)).toBeLessThanOrEqual(8);

      for (const tileIds of Object.values(topology.edgeTileIds)) {
        if (tileIds.length !== 2) continue;
        const [firstTileId, secondTileId] = tileIds;
        if (!firstTileId || !secondTileId) continue;

        const firstTerrain = terrainByTileId.get(firstTileId);
        const secondTerrain = terrainByTileId.get(secondTileId);
        if (!firstTerrain || firstTerrain === "desert" || firstTerrain !== secondTerrain) continue;

        matchingNeighbors.get(firstTileId)?.push(secondTileId);
        matchingNeighbors.get(secondTileId)?.push(firstTileId);
      }

      const visitedTileIds = new Set<string>();
      for (const tile of board.tiles) {
        if (tile.terrain === "desert" || visitedTileIds.has(tile.id)) continue;

        let clusterSize = 0;
        const pendingTileIds = [tile.id];
        visitedTileIds.add(tile.id);

        while (pendingTileIds.length > 0) {
          const tileId = pendingTileIds.pop();
          if (!tileId) continue;
          clusterSize += 1;

          for (const neighborId of matchingNeighbors.get(tileId) ?? []) {
            if (visitedTileIds.has(neighborId)) continue;
            visitedTileIds.add(neighborId);
            pendingTileIds.push(neighborId);
          }
        }

        largestTerrainCluster = Math.max(largestTerrainCluster, clusterSize);
      }
    }

    expect(largestTerrainCluster).toBeGreaterThanOrEqual(3);
  });
});
