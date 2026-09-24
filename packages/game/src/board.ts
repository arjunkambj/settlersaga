import { NUMBER_TOKEN_PIPS, TERRAIN_RESOURCE } from "./constants";
import { getGameMapDefinition } from "./maps";
import { deterministicInteger, deterministicShuffle } from "./random";
import {
  axialToPixel,
  createHexCoordinates,
  getBoardTopology,
  getTileId,
  type BoardTopology,
} from "./topology";
import { RESOURCE_TYPES, TERRAIN_TYPES } from "./types";
import type {
  AxialCoordinate,
  BoardState,
  GameMapId,
  NumberToken,
  PortDescriptor,
  ResourceType,
  TileState,
} from "./types";

type TerrainTile = Omit<TileState, "numberToken">;

const BASE_BOARD_ATTEMPTS = 100;
const MAX_RESOURCE_PIP_SPREAD = 8;
const MIN_RED_RESOURCE_TYPES = 3;
const HEX_SIDE_COUNT = 6;

function coordinateRadius({ q, r }: AxialCoordinate): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}

function isRedNumber(token: NumberToken) {
  return token === 6 || token === 8;
}

function isRareNumber(token: NumberToken) {
  return token === 2 || token === 12;
}

function selectEvenly<Value>(values: readonly Value[], count: number): Value[] {
  return Array.from(
    { length: count },
    (_, index) => values[Math.floor((index * values.length) / count)]!,
  );
}

function createMapCoordinates(mapId: GameMapId): AxialCoordinate[] {
  switch (mapId) {
    case "base":
      return createHexCoordinates(2);
    case "extended-6":
      // Dropping one end tile from each column leaves the official 3-4-5-6-5-4-3 island.
      return createHexCoordinates(3).filter(({ q, r }) => r !== Math.min(3, 3 - q));
    case "extended-8":
      return createHexCoordinates(3);
  }
}

function createTerrainTiles(
  mapId: GameMapId,
  coordinates: readonly AxialCoordinate[],
  seed: string,
): TerrainTile[] {
  const { terrainCounts } = getGameMapDefinition(mapId);
  const terrains = deterministicShuffle(
    TERRAIN_TYPES.flatMap((terrain) =>
      Array.from({ length: terrainCounts[terrain] }, () => terrain),
    ),
    seed,
  );

  return coordinates.map((coordinate, index) => ({
    ...coordinate,
    id: getTileId(coordinate),
    terrain: terrains[index]!,
  }));
}

function clockwiseAngleFromTop(coordinate: AxialCoordinate): number {
  const point = axialToPixel(coordinate, 1);
  return (Math.atan2(point.y, point.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
}

function orientRing<Value>(
  ring: readonly Value[],
  orientation: number,
  direction: number,
): Value[] {
  const start = orientation * (ring.length / HEX_SIDE_COUNT);

  return Array.from(
    { length: ring.length },
    (_, index) => ring[(start + direction * index + ring.length) % ring.length]!,
  );
}

function assignBaseNumberTokens(
  terrainTiles: readonly TerrainTile[],
  numberTokens: readonly NumberToken[],
  seed: string,
): TileState[] {
  const ring = (radius: number) =>
    terrainTiles
      .filter((tile) => coordinateRadius(tile) === radius)
      .sort((first, second) => clockwiseAngleFromTop(first) - clockwiseAngleFromTop(second));
  const center = terrainTiles.find((tile) => coordinateRadius(tile) === 0)!;
  const orientationDraw = deterministicInteger(`${seed}:number-spiral`, 0, HEX_SIDE_COUNT);
  const directionDraw = deterministicInteger(`${seed}:number-spiral`, orientationDraw.nextIndex, 2);
  const direction = directionDraw.value === 0 ? -1 : 1;
  const spiral = [
    ...orientRing(ring(2), orientationDraw.value, direction),
    ...orientRing(ring(1), orientationDraw.value, direction),
    center,
  ];
  const numberTokenByTileId = new Map(
    spiral
      .filter((tile) => TERRAIN_RESOURCE[tile.terrain] !== null)
      .map((tile, index) => [tile.id, numberTokens[index]!]),
  );

  return terrainTiles.map((tile) => ({
    ...tile,
    numberToken: numberTokenByTileId.get(tile.id) ?? null,
  }));
}

/**
 * Places tokens by backtracking so that no neighbours share a number, red numbers never touch,
 * and 2/12 stay on the coast. Rejection sampling almost never satisfies all three on large maps.
 */
function assignExtendedNumberTokens(
  terrainTiles: readonly TerrainTile[],
  numberTokens: readonly NumberToken[],
  seed: string,
  topology: BoardTopology,
): TileState[] {
  const tiles = deterministicShuffle(
    terrainTiles.filter((tile) => TERRAIN_RESOURCE[tile.terrain] !== null),
    `${seed}:number-tiles`,
  );
  const tileIndexById = new Map(tiles.map((tile, index) => [tile.id, index]));
  const neighbours = tiles.map((tile) =>
    topology.tileById[tile.id]!.edgeKeys.flatMap((edgeKey) =>
      topology.edgeTileIds[edgeKey]!.flatMap((tileId) => {
        const index = tileIndexById.get(tileId);
        return tileId === tile.id || index === undefined ? [] : [index];
      }),
    ),
  );
  const coastTileIds = new Set(
    topology.coastEdgeKeys.flatMap((edgeKey) => topology.edgeTileIds[edgeKey]!),
  );
  const placementRank = (token: NumberToken) =>
    isRedNumber(token) ? 0 : isRareNumber(token) ? 1 : 2;
  const tokens = [...numberTokens].sort(
    (first, second) => placementRank(first) - placementRank(second) || first - second,
  );
  const assigned: (NumberToken | null)[] = tiles.map(() => null);

  const fits = (tileIndex: number, token: NumberToken) =>
    (!isRareNumber(token) || coastTileIds.has(tiles[tileIndex]!.id)) &&
    neighbours[tileIndex]!.every((neighbourIndex) => {
      const neighbour = assigned[neighbourIndex];
      return neighbour !== token && !(neighbour && isRedNumber(neighbour) && isRedNumber(token));
    });

  // Identical tokens are interchangeable, so each copy only tries tiles after the previous copy.
  const place = (tokenIndex: number, previousTileIndex: number): boolean => {
    const token = tokens[tokenIndex];
    if (token === undefined) {
      return true;
    }

    const firstTileIndex = token === tokens[tokenIndex - 1] ? previousTileIndex + 1 : 0;
    for (let tileIndex = firstTileIndex; tileIndex < tiles.length; tileIndex += 1) {
      if (assigned[tileIndex] !== null || !fits(tileIndex, token)) {
        continue;
      }
      assigned[tileIndex] = token;
      if (place(tokenIndex + 1, tileIndex)) {
        return true;
      }
      assigned[tileIndex] = null;
    }
    return false;
  };

  if (!place(0, -1)) {
    throw new Error("Could not place number tokens on the map");
  }

  const numberTokenByTileId = new Map(tiles.map((tile, index) => [tile.id, assigned[index]!]));
  return terrainTiles.map((tile) => ({
    ...tile,
    numberToken: numberTokenByTileId.get(tile.id) ?? null,
  }));
}

function hasBalancedBaseResourceProduction(tiles: readonly TileState[]): boolean {
  const resourcePips = new Map<ResourceType, number>(
    RESOURCE_TYPES.map((resource) => [resource, 0]),
  );
  const redResources = new Set<ResourceType>();

  for (const { numberToken, terrain } of tiles) {
    const resource = TERRAIN_RESOURCE[terrain];
    if (resource === null || numberToken === null) {
      continue;
    }

    resourcePips.set(resource, resourcePips.get(resource)! + NUMBER_TOKEN_PIPS[numberToken]);
    if (isRedNumber(numberToken)) {
      redResources.add(resource);
    }
  }

  const pipTotals = [...resourcePips.values()];
  const pipSpread = Math.max(...pipTotals) - Math.min(...pipTotals);
  return redResources.size >= MIN_RED_RESOURCE_TYPES && pipSpread <= MAX_RESOURCE_PIP_SPREAD;
}

function createBoardTiles(
  mapId: GameMapId,
  coordinates: readonly AxialCoordinate[],
  topology: BoardTopology,
  seed: string,
): TileState[] {
  const { numberTokens } = getGameMapDefinition(mapId);

  if (mapId !== "base") {
    const terrainTiles = createTerrainTiles(mapId, coordinates, `${seed}:terrain`);
    return assignExtendedNumberTokens(terrainTiles, numberTokens, seed, topology);
  }

  for (let attempt = 0; attempt < BASE_BOARD_ATTEMPTS; attempt += 1) {
    const terrainTiles = createTerrainTiles(mapId, coordinates, `${seed}:terrain:${attempt}`);
    const tiles = assignBaseNumberTokens(terrainTiles, numberTokens, seed);

    if (hasBalancedBaseResourceProduction(tiles)) {
      return tiles;
    }
  }

  throw new Error(`Could not create a balanced resource layout for ${mapId}`);
}

function edgeAngle(topology: BoardTopology, edgeKey: string): number {
  const [firstVertexKey, secondVertexKey] = topology.edgeVertices[edgeKey]!;
  const first = topology.vertexPositions[firstVertexKey]!;
  const second = topology.vertexPositions[secondVertexKey]!;
  return Math.atan2(Math.sqrt(3) * (first.y + second.y), first.x + second.x);
}

function createPorts(topology: BoardTopology, mapId: GameMapId, seed: string): PortDescriptor[] {
  const trades = deterministicShuffle(getGameMapDefinition(mapId).portTrades, `${seed}:ports`);
  const coastEdges = [...topology.coastEdgeKeys].sort(
    (first, second) => edgeAngle(topology, first) - edgeAngle(topology, second),
  );

  return selectEvenly(coastEdges, trades.length).map((edgeKey, index) => ({
    edgeKey,
    id: `port:${index}`,
    trade: trades[index]!,
  }));
}

export function createBoard(mapId: GameMapId, seed: string): BoardState {
  const coordinates = createMapCoordinates(mapId);
  const topology = getBoardTopology(coordinates);
  const tiles = createBoardTiles(mapId, coordinates, topology, seed);

  return {
    buildings: [],
    ports: createPorts(topology, mapId, seed),
    roads: [],
    robberTileId: tiles.find((tile) => TERRAIN_RESOURCE[tile.terrain] === null)!.id,
    tiles,
  };
}
