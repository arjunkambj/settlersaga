import { describe, expect, test } from "bun:test";

import { createBoard, type GameMapId } from "@settersaga/game";

import { PORT_BOAT_RENDER_SIZE } from "../src/constants/game/board-assets";
import {
  BOARD_CANVAS,
  createBoardLayout,
  getBoardFrame,
  getBoardPlaneStyle,
  getEdgePlacement,
  getPortBox,
  getPortPlacement,
  getTilePoint,
  getVertexPoint,
} from "../src/lib/game/board-layout";

const MAP_IDS: GameMapId[] = ["base", "extended-6", "extended-8"];

describe("port placement", () => {
  test.each(MAP_IDS)("places every %s port offshore from its coastal tile", (mapId) => {
    const board = createBoard(mapId, "port-layout");
    const layout = createBoardLayout(board.tiles);

    for (const port of board.ports) {
      const placement = getPortPlacement(layout, port.edgeKey);
      const coastalTileId = layout.topology.edgeTileIds[port.edgeKey]?.[0];
      const coastalTile = coastalTileId ? layout.topology.tileById[coastalTileId] : null;

      expect(placement).not.toBeNull();
      expect(coastalTile).toBeTruthy();
      if (!placement || !coastalTile) {
        continue;
      }

      const tilePoint = getTilePoint(layout, coastalTile);
      const edgePoint = getEdgePlacement(layout, port.edgeKey);
      expect(edgePoint).not.toBeNull();
      if (!edgePoint) {
        continue;
      }
      const coastNormal = {
        x: edgePoint.x - tilePoint.x,
        y: edgePoint.y - tilePoint.y,
      };
      const portDirection = {
        x: placement.x - edgePoint.x,
        y: placement.y - edgePoint.y,
      };

      expect(portDirection.x * coastNormal.x + portDirection.y * coastNormal.y).toBeGreaterThan(0);
      expect(Math.hypot(portDirection.x, portDirection.y)).toBeGreaterThan(layout.tileRadius * 0.5);
    }
  });

  test.each(MAP_IDS)("connects every %s port to its coastal edge", (mapId) => {
    const board = createBoard(mapId, "port-layout");
    const layout = createBoardLayout(board.tiles);

    for (const port of board.ports) {
      const placement = getPortPlacement(layout, port.edgeKey);
      const vertexKeys = layout.topology.edgeVertices[port.edgeKey] ?? [];

      expect(placement).not.toBeNull();
      expect(vertexKeys).toHaveLength(2);
      if (!placement || vertexKeys.length !== 2) {
        continue;
      }

      expect(placement.docks).toHaveLength(2);
      for (const [index, dock] of placement.docks.entries()) {
        const vertexKey = vertexKeys[index];
        const expectedStart = vertexKey ? getVertexPoint(layout, vertexKey) : null;
        expect(expectedStart).not.toBeNull();
        if (!expectedStart) {
          continue;
        }

        expect(
          Math.hypot(dock.start.x - expectedStart.x, dock.start.y - expectedStart.y),
        ).toBeCloseTo(0, 5);
        expect(Math.hypot(dock.end.x - placement.x, dock.end.y - placement.y)).toBeGreaterThan(
          PORT_BOAT_RENDER_SIZE.width * 0.3,
        );
        expect(Math.hypot(dock.end.x - placement.x, dock.end.y - placement.y)).toBeLessThanOrEqual(
          PORT_BOAT_RENDER_SIZE.height / 2,
        );
      }
    }
  });

  test.each(MAP_IDS)(
    "keeps every %s harbor boat and trade plaque inside the board canvas",
    (mapId) => {
      const board = createBoard(mapId, "port-layout");
      const layout = createBoardLayout(board.tiles);

      for (const port of board.ports) {
        const placement = getPortPlacement(layout, port.edgeKey);
        expect(placement).not.toBeNull();
        if (!placement) {
          continue;
        }

        const box = getPortBox(placement);
        expect(box.left).toBeGreaterThan(16);
        expect(box.right).toBeLessThan(BOARD_CANVAS.width - 16);
        expect(box.top).toBeGreaterThan(16);
        expect(box.bottom).toBeLessThan(BOARD_CANVAS.height - 16);
      }
    },
  );
});

describe("board frame", () => {
  test.each(MAP_IDS)("frames every %s corner and harbor inside the canvas", (mapId) => {
    const board = createBoard(mapId, "frame-layout");
    const layout = createBoardLayout(board.tiles);
    const frame = getBoardFrame(
      layout,
      board.ports.map((port) => port.edgeKey),
    );

    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.y).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(BOARD_CANVAS.width);
    expect(frame.y + frame.height).toBeLessThanOrEqual(BOARD_CANVAS.height);

    for (const vertexKey of layout.topology.vertexKeys) {
      const point = getVertexPoint(layout, vertexKey);
      expect(point).not.toBeNull();
      if (!point) {
        continue;
      }
      expect(point.x).toBeGreaterThan(frame.x);
      expect(point.x).toBeLessThan(frame.x + frame.width);
      expect(point.y).toBeGreaterThan(frame.y);
      expect(point.y).toBeLessThan(frame.y + frame.height);
    }

    for (const port of board.ports) {
      const placement = getPortPlacement(layout, port.edgeKey);
      if (!placement) {
        continue;
      }
      const box = getPortBox(placement);
      expect(box.left).toBeGreaterThanOrEqual(frame.x);
      expect(box.right).toBeLessThanOrEqual(frame.x + frame.width);
      expect(box.top).toBeGreaterThanOrEqual(frame.y);
      expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height);
    }
  });

  test("frames the wide isle wider than the grand isle", () => {
    const getAspect = (mapId: GameMapId) => {
      const board = createBoard(mapId, "frame-layout");
      const frame = getBoardFrame(
        createBoardLayout(board.tiles),
        board.ports.map((port) => port.edgeKey),
      );
      return frame.width / frame.height;
    };

    expect(getAspect("extended-6")).toBeGreaterThan(getAspect("extended-8") * 1.1);
  });

  test("places the canvas so the frame fills its box", () => {
    const style = getBoardPlaneStyle({ height: 1_000, width: 600, x: 300, y: 160 });

    expect(style).toEqual({
      height: "132%",
      left: "-50%",
      top: "-16%",
      width: "200%",
    });
  });
});
