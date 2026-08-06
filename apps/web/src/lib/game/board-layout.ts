import { axialToPixel, getBoardTopology } from "@settersaga/game";
import type { AxialCoordinate, BoardTopology, PixelCoordinate } from "@settersaga/game";

import { BOARD_TILE, PORT_BOAT_RENDER_SIZE } from "@/constants/game/board-assets";

export const BOARD_CANVAS = {
  centerX: 600,
  centerY: 660,
  height: 1320,
  tileRadius: BOARD_TILE.radius,
  tileSize: BOARD_TILE.renderSize,
  width: 1200,
} as const;

export interface EdgePlacement extends PixelCoordinate {
  angle: number;
}

interface DockPlacement {
  end: PixelCoordinate;
  start: PixelCoordinate;
}

export interface PortPlacement extends EdgePlacement {
  docks: readonly [DockPlacement, DockPlacement];
  outwardAngle: number;
}

export interface BoardLayout {
  origin: PixelCoordinate;
  tileRadius: number;
  tileSize: number;
  topology: BoardTopology;
}

export function createBoardLayout(coordinates: readonly AxialCoordinate[]): BoardLayout {
  const unitPoints = coordinates.map((coordinate) => axialToPixel(coordinate, 1));
  const xValues = unitPoints.map((point) => point.x);
  const yValues = unitPoints.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const assetDiameter = BOARD_TILE.renderSize / BOARD_TILE.radius;
  const tileRadius = Math.min(
    BOARD_CANVAS.tileRadius,
    960 / (maxX - minX + assetDiameter),
    1_060 / (maxY - minY + assetDiameter),
  );

  return {
    origin: {
      x: BOARD_CANVAS.centerX - ((minX + maxX) / 2) * tileRadius,
      y: BOARD_CANVAS.centerY - ((minY + maxY) / 2) * tileRadius,
    },
    tileRadius,
    tileSize: assetDiameter * tileRadius,
    topology: getBoardTopology(coordinates),
  };
}

export function getTilePoint(layout: BoardLayout, coordinate: AxialCoordinate): PixelCoordinate {
  return toCanvasPoint(layout, axialToPixel(coordinate, layout.tileRadius));
}

export function getVertexPoint(layout: BoardLayout, vertexKey: string): PixelCoordinate | null {
  const position = layout.topology.vertexPositions[vertexKey];
  if (!position) {
    return null;
  }

  return toCanvasPoint(layout, {
    x: (layout.tileRadius / 2) * position.x,
    y: ((Math.sqrt(3) * layout.tileRadius) / 2) * position.y,
  });
}

export function getEdgePlacement(layout: BoardLayout, edgeKey: string): EdgePlacement | null {
  const [firstKey, secondKey] = layout.topology.edgeVertices[edgeKey] ?? [];
  const first = firstKey ? getVertexPoint(layout, firstKey) : null;
  const second = secondKey ? getVertexPoint(layout, secondKey) : null;

  if (!first || !second) {
    return null;
  }

  return {
    angle: (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI,
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function getPortPlacement(layout: BoardLayout, edgeKey: string): PortPlacement | null {
  const edge = getEdgePlacement(layout, edgeKey);
  const [firstVertexKey, secondVertexKey] = layout.topology.edgeVertices[edgeKey] ?? [];
  const firstVertex = firstVertexKey ? getVertexPoint(layout, firstVertexKey) : null;
  const secondVertex = secondVertexKey ? getVertexPoint(layout, secondVertexKey) : null;
  const coastalTileId = layout.topology.edgeTileIds[edgeKey]?.[0];
  const coastalTile = coastalTileId ? layout.topology.tileById[coastalTileId] : null;

  if (!edge || !firstVertex || !secondVertex || !coastalTile) {
    return null;
  }

  const coastalTilePoint = getTilePoint(layout, coastalTile);
  const relativeX = edge.x - coastalTilePoint.x;
  const relativeY = edge.y - coastalTilePoint.y;
  const length = Math.hypot(relativeX, relativeY) || 1;
  const outward = { x: relativeX / length, y: relativeY / length };
  const tangent = { x: -outward.y, y: outward.x };
  const outwardDistance = layout.tileRadius * 0.82;
  const point = {
    x: edge.x + outward.x * outwardDistance,
    y: edge.y + outward.y * outwardDistance,
  };
  const hullHalfHeight = PORT_BOAT_RENDER_SIZE.height * 0.47;
  const hullOverlap = 6;
  const dockEndInset = hullHalfHeight - hullOverlap;
  const dockHalfWidth = PORT_BOAT_RENDER_SIZE.width * 0.22;
  const firstSide =
    (firstVertex.x - edge.x) * tangent.x + (firstVertex.y - edge.y) * tangent.y < 0 ? -1 : 1;
  const getDockEnd = (side: number) => ({
    x: point.x - outward.x * dockEndInset + tangent.x * dockHalfWidth * side,
    y: point.y - outward.y * dockEndInset + tangent.y * dockHalfWidth * side,
  });

  return {
    ...edge,
    ...point,
    docks: [
      { end: getDockEnd(firstSide), start: firstVertex },
      { end: getDockEnd(-firstSide), start: secondVertex },
    ],
    outwardAngle: Math.atan2(outward.y, outward.x),
  };
}

export function getPointStyle(point: PixelCoordinate) {
  return {
    left: `${(point.x / BOARD_CANVAS.width) * 100}%`,
    top: `${(point.y / BOARD_CANVAS.height) * 100}%`,
  };
}

function toCanvasPoint(layout: BoardLayout, point: PixelCoordinate): PixelCoordinate {
  return {
    x: layout.origin.x + point.x,
    y: layout.origin.y + point.y,
  };
}
