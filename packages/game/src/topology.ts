import type { AxialCoordinate, PixelCoordinate } from "./types";

const CORNER_X = [2, 1, -1, -2, -1, 1] as const;
const CORNER_Y = [0, 1, 1, 0, -1, -1] as const;

export interface VertexPosition {
  x: number;
  y: number;
}

export interface TileTopology extends AxialCoordinate {
  edgeKeys: string[];
  id: string;
  vertexKeys: string[];
}

export interface BoardTopology {
  coastEdgeKeys: string[];
  edgeKeys: string[];
  edgeTileIds: Record<string, string[]>;
  edgeVertices: Record<string, readonly [string, string]>;
  tileById: Record<string, TileTopology>;
  tiles: TileTopology[];
  vertexEdges: Record<string, string[]>;
  vertexKeys: string[];
  vertexNeighbors: Record<string, string[]>;
  vertexPositions: Record<string, VertexPosition>;
  vertexTileIds: Record<string, string[]>;
}

export function getTileId({ q, r }: AxialCoordinate) {
  return `tile:${q}:${r}`;
}

export function getVertexKey({ x, y }: VertexPosition) {
  return `vertex:${x}:${y}`;
}

export function getEdgeKey(firstVertexKey: string, secondVertexKey: string) {
  const [first, second] = [firstVertexKey, secondVertexKey].sort();
  return `edge:${first}|${second}`;
}

export function axialToPixel(coordinate: AxialCoordinate, size: number): PixelCoordinate {
  return {
    x: 1.5 * size * coordinate.q,
    y: Math.sqrt(3) * size * (coordinate.r + coordinate.q / 2),
  };
}

export function createHexCoordinates(radius: number) {
  const coordinates: AxialCoordinate[] = [];

  for (let r = -radius; r <= radius; r += 1) {
    for (let q = -radius; q <= radius; q += 1) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) <= radius) {
        coordinates.push({ q, r });
      }
    }
  }

  return coordinates;
}

function addRecordValue(record: Record<string, string[]>, key: string, value: string) {
  record[key] = [...(record[key] ?? []), value];
}

export function createBoardTopology(coordinates: readonly AxialCoordinate[]): BoardTopology {
  const vertexPositions: Record<string, VertexPosition> = {};
  const vertexTileIds: Record<string, string[]> = {};
  const edgeTileIds: Record<string, string[]> = {};
  const edgeVertices: Record<string, readonly [string, string]> = {};
  const tiles = coordinates.map(({ q, r }) => {
    const id = getTileId({ q, r });
    const vertexKeys = CORNER_X.map((xOffset, corner) => {
      const yOffset = CORNER_Y[corner];

      if (yOffset === undefined) {
        throw new Error(`Missing Y offset for corner ${corner}`);
      }

      const position = {
        x: 3 * q + xOffset,
        y: 2 * r + q + yOffset,
      };
      const key = getVertexKey(position);
      vertexPositions[key] = position;
      addRecordValue(vertexTileIds, key, id);
      return key;
    });
    const edgeKeys = vertexKeys.map((vertexKey, corner) => {
      const nextVertexKey = vertexKeys[(corner + 1) % vertexKeys.length];

      if (!nextVertexKey) {
        throw new Error("A tile must contain six vertices");
      }

      const key = getEdgeKey(vertexKey, nextVertexKey);
      edgeVertices[key] = [vertexKey, nextVertexKey];
      addRecordValue(edgeTileIds, key, id);
      return key;
    });

    return { edgeKeys, id, q, r, vertexKeys };
  });
  const edgeKeys = Object.keys(edgeVertices).sort();
  const vertexKeys = Object.keys(vertexPositions).sort();
  const vertexEdges: Record<string, string[]> = Object.fromEntries(
    vertexKeys.map((key) => [key, []]),
  );
  const vertexNeighbors: Record<string, string[]> = Object.fromEntries(
    vertexKeys.map((key) => [key, []]),
  );

  for (const edgeKey of edgeKeys) {
    const [first, second] = edgeVertices[edgeKey] ?? [];

    if (!first || !second) {
      throw new Error(`Topology is missing vertices for ${edgeKey}`);
    }

    addRecordValue(vertexEdges, first, edgeKey);
    addRecordValue(vertexEdges, second, edgeKey);
    addRecordValue(vertexNeighbors, first, second);
    addRecordValue(vertexNeighbors, second, first);
  }

  return {
    coastEdgeKeys: edgeKeys.filter((key) => edgeTileIds[key]?.length === 1),
    edgeKeys,
    edgeTileIds,
    edgeVertices,
    tileById: Object.fromEntries(tiles.map((tile) => [tile.id, tile])),
    tiles,
    vertexEdges,
    vertexKeys,
    vertexNeighbors,
    vertexPositions,
    vertexTileIds,
  };
}

const topologyCache = new Map<string, BoardTopology>();

export function getBoardTopology(coordinates: readonly AxialCoordinate[]): BoardTopology {
  const key = coordinates.map(getTileId).sort().join("|");
  const cached = topologyCache.get(key);

  if (cached) {
    return cached;
  }

  const topology = createBoardTopology(coordinates);
  topologyCache.set(key, topology);
  return topology;
}
