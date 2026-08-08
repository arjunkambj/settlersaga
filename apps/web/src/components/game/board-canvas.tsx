"use client";

import {
  NUMBER_TOKEN_PIPS,
  type PixelCoordinate,
  type PlayerColor,
  type PlayerGameView,
  type ResourceType,
} from "@settersaga/game";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";

import {
  PORT_BOAT_ASSET_PATH,
  PORT_BOAT_RENDER_SIZE,
  PORT_DOCK_ASSET_PATH,
  TERRAIN_ATLAS,
  TERRAIN_ATLAS_ASSET_PATH,
  getTerrainAtlasFrame,
} from "@/constants/game/board-assets";
import { getResourceCardAssetPath } from "@/constants/game/card-assets";
import { PLAYER_COLOR_HEX } from "@/constants/game/player-colors";
import {
  BOARD_CANVAS,
  getEdgePlacement,
  getPortPlacement,
  getTilePoint,
  getVertexPoint,
  type BoardLayout,
  type PortPlacement,
} from "@/lib/game/board-layout";

import { getPieceAssetPath } from "./piece-icon";

type Board = PlayerGameView["board"];
type BoardTile = Board["tiles"][number];

export interface BoardCanvasTarget {
  readonly angle: number;
  readonly asset: "city" | "road" | "robber" | "settlement";
  readonly disabled?: boolean;
  readonly highlighted?: boolean;
  readonly point: Readonly<PixelCoordinate>;
  readonly theme: PlayerColor;
}

export interface BoardCanvasProps {
  board: Board;
  boardLayout: BoardLayout;
  playerThemes: ReadonlyMap<string, PlayerColor>;
  renderScale: number;
  targets: readonly BoardCanvasTarget[];
}

interface StaticScene {
  boardLayout: BoardLayout;
  ports: Board["ports"];
  renderScale: number;
  tiles: Board["tiles"];
}

interface DynamicScene {
  boardLayout: BoardLayout;
  buildings: Board["buildings"];
  playerThemes: ReadonlyMap<string, PlayerColor>;
  renderScale: number;
  roads: Board["roads"];
  robberTileId: string;
  targets: readonly BoardCanvasTarget[];
  tiles: Board["tiles"];
}

type SceneRenderer<Scene> = (
  canvas: HTMLCanvasElement,
  scene: Scene,
  isCancelled: () => boolean,
) => Promise<void>;

const MAX_CANVAS_PIXEL_RATIO = 3;
const ROBBER_ASSET_PATH = "/game-assets/pieces/robber-piece.png";
const CITY_PIECE_SIZE = 102;
const ROAD_PIECE_SIZE = 138;
const ROAD_PIECE_SCALE_Y = 0.82;
const SETTLEMENT_PIECE_SIZE = 94;
const PORT_DOCK_RENDER_HEIGHT = 28;
const PORT_TRADE_BADGE_HEIGHT = 42;
const PORT_TRADE_BADGE_WIDTH = 78;
const PORT_RESOURCE_MARK_SIZE = 31;

/** Placement-target sizing. Resting markers stay small so a board full of legal
    corners still reads as terrain; the hovered one grows into a real preview. */
const VERTEX_MARKER_RADIUS = 20;
const VERTEX_CITY_SIZE = 36;
const VERTEX_SETTLEMENT_SIZE = 32;
const VERTEX_GLOW_RADIUS = 26;
// A corner marker has to stay small — a fresh board offers 54 of them — so the
// hovered one grows a long way to reach the size the piece will actually be
// built at. Road edges are never crowded, so their marker already sits close to
// full size and only needs a nudge.
const VERTEX_HOVER_PIECE_SCALE = 2.3;
const ROAD_TARGET_SIZE = 95;
const ROAD_HOVER_PIECE_SCALE = 1.45;
const TARGET_RESTING_PIECE_ALPHA = 0.5;
const TARGET_DISABLED_ALPHA = 0.2;

const PORT_RESOURCE_ACCENTS: Readonly<Record<ResourceType, string>> = {
  brick: "#c94f2d",
  sheep: "#789b25",
  stone: "#657686",
  tree: "#287444",
  wheat: "#b77a0b",
};

const BOARD_CANVAS_STYLE: CSSProperties = {
  display: "block",
  height: "100%",
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
  width: "100%",
};

const BOARD_CANVAS_CONTAINER_STYLE: CSSProperties = {
  inset: 0,
  isolation: "isolate",
  pointerEvents: "none",
  position: "absolute",
  zIndex: 1,
};

const imagePromises = new Map<string, Promise<HTMLImageElement | null>>();
const tintedPieceCanvases = new Map<string, HTMLCanvasElement>();

export const BoardCanvas = memo(function BoardCanvas({
  board,
  boardLayout,
  playerThemes,
  renderScale,
  targets,
}: BoardCanvasProps) {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticScene: StaticScene = {
    boardLayout,
    ports: board.ports,
    renderScale,
    tiles: board.tiles,
  };
  const dynamicScene: DynamicScene = {
    boardLayout,
    buildings: board.buildings,
    playerThemes,
    renderScale,
    roads: board.roads,
    robberTileId: board.robberTileId,
    targets,
    tiles: board.tiles,
  };

  useCanvasLayer(
    staticCanvasRef,
    staticScene,
    createStaticSceneKey(staticScene),
    renderStaticScene,
  );
  useCanvasLayer(
    dynamicCanvasRef,
    dynamicScene,
    createDynamicSceneKey(dynamicScene),
    renderDynamicScene,
  );

  return (
    <div aria-hidden="true" className="board-canvas" style={BOARD_CANVAS_CONTAINER_STYLE}>
      <canvas
        aria-hidden="true"
        className="board-canvas-layer board-canvas-static"
        data-board-canvas-layer="static"
        height={BOARD_CANVAS.height}
        ref={staticCanvasRef}
        style={BOARD_CANVAS_STYLE}
        width={BOARD_CANVAS.width}
      />
      <canvas
        aria-hidden="true"
        className="board-canvas-layer board-canvas-dynamic"
        data-board-canvas-layer="dynamic"
        height={BOARD_CANVAS.height}
        ref={dynamicCanvasRef}
        style={{ ...BOARD_CANVAS_STYLE, zIndex: 1 }}
        width={BOARD_CANVAS.width}
      />
    </div>
  );
});

function useCanvasLayer<Scene>(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  scene: Scene,
  sceneKey: string,
  renderScene: SceneRenderer<Scene>,
) {
  const drawRevisionRef = useRef(0);
  const sceneRef = useRef(scene);
  const scheduleDrawRef = useRef<() => void>(() => undefined);
  sceneRef.current = scene;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    let frameId = 0;

    const draw = () => {
      const revision = ++drawRevisionRef.current;
      void renderScene(
        canvas,
        sceneRef.current,
        () => cancelled || revision !== drawRevisionRef.current,
      );
    };

    const scheduleDraw = () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = 0;
        draw();
      });
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleDraw);
    scheduleDrawRef.current = scheduleDraw;
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", scheduleDraw, { passive: true });
    draw();

    return () => {
      cancelled = true;
      drawRevisionRef.current += 1;
      scheduleDrawRef.current = () => undefined;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleDraw);
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [canvasRef, renderScene]);

  useLayoutEffect(() => {
    drawRevisionRef.current += 1;
    scheduleDrawRef.current();
  }, [sceneKey]);
}

async function renderStaticScene(
  canvas: HTMLCanvasElement,
  scene: StaticScene,
  isCancelled: () => boolean,
) {
  const portResourcePaths = scene.ports.flatMap((port) =>
    port.trade === "any" ? [] : [getResourceCardAssetPath(port.trade)],
  );
  const images = await loadImages([
    PORT_DOCK_ASSET_PATH,
    PORT_BOAT_ASSET_PATH,
    TERRAIN_ATLAS_ASSET_PATH,
    ...portResourcePaths,
  ]);

  if (isCancelled()) {
    return;
  }

  const context = prepareCanvas(canvas, scene.renderScale);
  if (!context) {
    return;
  }

  drawTerrain(context, scene, images.get(TERRAIN_ATLAS_ASSET_PATH) ?? null);
  drawPorts(context, scene, images);
}

async function renderDynamicScene(
  canvas: HTMLCanvasElement,
  scene: DynamicScene,
  isCancelled: () => boolean,
) {
  const piecePaths = [
    getPieceAssetPath("city"),
    getPieceAssetPath("road"),
    getPieceAssetPath("settlement"),
    ROBBER_ASSET_PATH,
  ];
  const images = await loadImages(piecePaths);

  if (isCancelled()) {
    return;
  }

  const context = prepareCanvas(canvas, scene.renderScale);
  if (!context) {
    return;
  }

  drawRoads(context, scene, images);
  drawBuildings(context, scene, images);
  drawRobber(context, scene, images.get(ROBBER_ASSET_PATH) ?? null);
  drawTargets(context, scene, images);
}

function prepareCanvas(
  canvas: HTMLCanvasElement,
  renderScale: number,
): CanvasRenderingContext2D | null {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth <= 0 || cssHeight <= 0) {
    return null;
  }

  const pixelRatio = Math.min(
    (window.devicePixelRatio || 1) * Math.max(1, renderScale),
    MAX_CANVAS_PIXEL_RATIO,
  );
  const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) {
    return null;
  }

  context.resetTransform();
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.setTransform(
    pixelWidth / BOARD_CANVAS.width,
    0,
    0,
    pixelHeight / BOARD_CANVAS.height,
    0,
    0,
  );
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function drawTerrain(
  context: CanvasRenderingContext2D,
  scene: StaticScene,
  terrainAtlas: HTMLImageElement | null,
) {
  const tiles = scene.tiles
    .map((tile) => ({
      point: getTilePoint(scene.boardLayout, tile),
      tile,
    }))
    .sort((first, second) => first.point.y - second.point.y);

  for (const { point, tile } of tiles) {
    if (terrainAtlas) {
      const textureSize = scene.boardLayout.tileRadius * 2;
      const frame = getTerrainAtlasFrame(tile.terrain, tile.id);
      const sourceX = frame.column * TERRAIN_ATLAS.frameSize;
      const sourceY = frame.row * TERRAIN_ATLAS.frameSize;
      const renderSize = textureSize * frame.scale;
      context.save();
      createRoundedHexagonPath(context, point, scene.boardLayout.tileRadius + 0.75, 5, 0);
      context.clip();
      context.drawImage(
        terrainAtlas,
        sourceX,
        sourceY,
        TERRAIN_ATLAS.frameSize,
        TERRAIN_ATLAS.frameSize,
        point.x - renderSize / 2,
        point.y - renderSize / 2,
        renderSize,
        renderSize,
      );
      context.restore();
    }
  }

  for (const { point } of tiles) {
    drawTerrainBorder(context, point, scene.boardLayout.tileRadius);
  }

  for (const { point, tile } of tiles) {
    if (tile.numberToken !== null) {
      drawNumberToken(context, tile, point, scene.boardLayout.tileSize);
    }
  }
}

function drawTerrainBorder(
  context: CanvasRenderingContext2D,
  point: PixelCoordinate,
  radius: number,
) {
  const canvasStyle = getComputedStyle(context.canvas);
  const getChannelColor = (token: string, alpha: number, fallback: string) => {
    const channels = canvasStyle.getPropertyValue(token).trim();
    return channels ? `rgb(${channels} / ${alpha})` : fallback;
  };

  context.save();
  context.lineJoin = "round";

  createRoundedHexagonPath(context, point, radius - 1, 7, 0);
  context.lineWidth = 8;
  context.strokeStyle = getChannelColor("--hud-shadow-deep", 0.96, "rgba(32, 22, 18, 0.96)");
  context.stroke();

  createRoundedHexagonPath(context, point, radius - 1, 7, 0);
  context.lineWidth = 4.5;
  context.strokeStyle = getChannelColor("--hud-gold-line", 0.98, "rgba(126, 72, 18, 0.98)");
  context.stroke();

  createRoundedHexagonPath(context, point, radius - 2, 6, 0);
  context.lineWidth = 1.5;
  context.strokeStyle = getChannelColor("--hud-gold-shine", 0.82, "rgba(255, 228, 158, 0.82)");
  context.stroke();
  context.restore();
}

function drawNumberToken(
  context: CanvasRenderingContext2D,
  tile: BoardTile,
  tilePoint: PixelCoordinate,
  tileSize: number,
) {
  const number = tile.numberToken;
  if (number === null) {
    return;
  }

  const point = { x: tilePoint.x, y: tilePoint.y + tileSize * 0.18 + 2 };
  const radius = Math.min(39, tileSize * 0.11);
  const isHot = number === 6 || number === 8;

  context.save();
  context.shadowBlur = 7;
  context.shadowColor = "rgba(75, 45, 25, 0.32)";
  context.shadowOffsetY = 3;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = isHot ? "#9d3930" : "#a66c28";
  context.fill();
  context.restore();

  context.beginPath();
  context.arc(point.x, point.y, radius - 2, 0, Math.PI * 2);
  const rim = context.createLinearGradient(
    point.x - radius,
    point.y - radius,
    point.x + radius,
    point.y + radius,
  );
  rim.addColorStop(0, isHot ? "#ef9b72" : "#f2ce78");
  rim.addColorStop(0.52, isHot ? "#db6750" : "#d79a3d");
  rim.addColorStop(1, isHot ? "#b43e35" : "#b97728");
  context.fillStyle = rim;
  context.fill();

  context.beginPath();
  context.arc(point.x, point.y, radius - 6, 0, Math.PI * 2);
  const face = context.createLinearGradient(
    point.x - radius,
    point.y - radius,
    point.x + radius,
    point.y + radius,
  );
  face.addColorStop(0, "#fff8e6");
  face.addColorStop(0.58, isHot ? "#ffedcf" : "#f9e9ca");
  face.addColorStop(1, isHot ? "#f2cf9f" : "#efd5aa");
  context.fillStyle = face;
  context.fill();
  context.lineWidth = 1.4;
  context.strokeStyle = "rgba(255, 255, 255, 0.58)";
  context.stroke();

  context.beginPath();
  context.arc(point.x, point.y, radius - 8, Math.PI * 1.08, Math.PI * 1.75);
  context.lineWidth = 1.8;
  context.strokeStyle = "rgba(255, 255, 255, 0.5)";
  context.stroke();

  context.fillStyle = isHot ? "#b63b31" : "#4b3b48";
  context.font = "900 32px ui-rounded, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), point.x, point.y - 5.5);

  const pips = NUMBER_TOKEN_PIPS[number] ?? 0;
  const pipGap = 7.5;
  const firstPipX = point.x - ((pips - 1) * pipGap) / 2;
  context.fillStyle = isHot ? "#bf5142" : "#9a7650";
  for (let index = 0; index < pips; index += 1) {
    context.beginPath();
    context.arc(firstPipX + index * pipGap, point.y + 15.5, 2.8, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPorts(
  context: CanvasRenderingContext2D,
  scene: StaticScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
) {
  const ports = scene.ports.flatMap((port) => {
    const placement = getPortPlacement(scene.boardLayout, port.edgeKey);
    return placement ? [{ placement, port }] : [];
  });

  for (const { placement } of ports) {
    for (const dock of placement.docks) {
      drawDock(context, dock.start, dock.end, images.get(PORT_DOCK_ASSET_PATH) ?? null);
    }
  }

  for (const { placement, port } of ports) {
    drawPort(
      context,
      placement,
      port.trade,
      images.get(PORT_BOAT_ASSET_PATH) ?? null,
      port.trade === "any" ? null : (images.get(getResourceCardAssetPath(port.trade)) ?? null),
    );
  }
}

function drawDock(
  context: CanvasRenderingContext2D,
  start: PixelCoordinate,
  end: PixelCoordinate,
  image: HTMLImageElement | null,
) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;

  if (image) {
    context.save();
    context.translate(centerX, centerY);
    context.rotate(angle);
    context.filter = "brightness(0.28) saturate(0.72)";
    context.globalAlpha = 0.82;
    context.drawImage(
      image,
      -length / 2 - 2,
      -PORT_DOCK_RENDER_HEIGHT / 2 - 2,
      length + 4,
      PORT_DOCK_RENDER_HEIGHT + 4,
    );
    context.filter = "saturate(0.92) brightness(0.96) contrast(1.12)";
    context.globalAlpha = 0.98;
    context.shadowBlur = 4;
    context.shadowColor = "rgba(62, 42, 22, 0.42)";
    context.shadowOffsetY = 2;
    context.drawImage(
      image,
      -length / 2,
      -PORT_DOCK_RENDER_HEIGHT / 2,
      length,
      PORT_DOCK_RENDER_HEIGHT,
    );
    context.restore();
    return;
  }

  context.save();
  context.lineCap = "round";
  strokeLine(context, start, end, 20, "rgba(91, 57, 28, 0.64)");
  strokeLine(context, start, end, 12, "rgba(216, 155, 61, 0.94)");
  context.restore();
}

function drawPort(
  context: CanvasRenderingContext2D,
  placement: PortPlacement,
  trade: "any" | ResourceType,
  boatImage: HTMLImageElement | null,
  resourceImage: HTMLImageElement | null,
) {
  const { height, width } = PORT_BOAT_RENDER_SIZE;

  if (boatImage) {
    context.save();
    context.translate(placement.x, placement.y);
    context.rotate(placement.outwardAngle - Math.PI / 2);
    context.filter = "brightness(0.26) saturate(0.72)";
    context.globalAlpha = 0.84;
    for (const [offsetX, offsetY] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]) {
      context.drawImage(boatImage, -width / 2 + offsetX, -height / 2 + offsetY, width, height);
    }
    context.filter = "saturate(0.92) brightness(0.96) contrast(1.12)";
    context.globalAlpha = 1;
    context.shadowBlur = 5;
    context.shadowColor = "rgba(39, 96, 122, 0.24)";
    context.shadowOffsetY = 3;
    context.drawImage(boatImage, -width / 2, -height / 2, width, height);
    context.restore();
  }

  drawPortTradeBadge(context, placement, trade, resourceImage);
}

function drawRoads(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
) {
  const path = getPieceAssetPath("road");
  const image = images.get(path) ?? null;
  if (!image) {
    return;
  }

  for (const road of scene.roads) {
    const placement = getEdgePlacement(scene.boardLayout, road.edgeKey);
    if (!placement) {
      continue;
    }

    drawPlayerPiece(
      context,
      image,
      path,
      placement,
      ROAD_PIECE_SIZE,
      scene.playerThemes.get(road.playerId) ?? "red",
      placement.angle,
      ROAD_PIECE_SCALE_Y,
    );
  }
}

function drawBuildings(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
) {
  for (const building of scene.buildings) {
    const point = getVertexPoint(scene.boardLayout, building.vertexKey);
    const path = getPieceAssetPath(building.kind);
    const image = images.get(path) ?? null;
    if (!point || !image) {
      continue;
    }

    drawPlayerPiece(
      context,
      image,
      path,
      point,
      building.kind === "city" ? CITY_PIECE_SIZE : SETTLEMENT_PIECE_SIZE,
      scene.playerThemes.get(building.playerId) ?? "red",
    );
  }
}

function drawRobber(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  image: HTMLImageElement | null,
) {
  if (!image) {
    return;
  }

  const tile = scene.tiles.find((candidate) => candidate.id === scene.robberTileId);
  if (!tile) {
    return;
  }

  const point = getTilePoint(scene.boardLayout, tile);
  const size = 102;
  context.save();
  context.shadowBlur = 5;
  context.shadowColor = "rgba(34, 46, 56, 0.42)";
  context.shadowOffsetY = 4;
  context.drawImage(image, point.x - size / 2, point.y - size * 0.5, size, size);
  context.restore();
}

function drawTargets(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
) {
  // The hovered target paints last so its glow and full-size preview are never
  // clipped by a neighbouring marker.
  const ordered = [...scene.targets].sort(
    (first, second) => Number(Boolean(first.highlighted)) - Number(Boolean(second.highlighted)),
  );

  for (const target of ordered) {
    if (target.asset === "robber") {
      drawRobberTarget(context, target, images.get(ROBBER_ASSET_PATH) ?? null);
      continue;
    }

    const path = getPieceAssetPath(target.asset);
    const image = images.get(path) ?? null;
    const preview = image
      ? getTintedPieceCanvas(image, path, target.theme, PLAYER_COLOR_HEX[target.theme])
      : null;

    if (target.asset === "road") {
      drawRoadTarget(context, target, preview);
    } else {
      drawVertexTarget(context, target, preview);
    }
  }
}

/** Legal settlement/city corner: a marker ring at rest, the piece itself on hover. */
function drawVertexTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  preview: HTMLCanvasElement | null,
) {
  const accent = PLAYER_COLOR_HEX[target.theme];
  const pieceSize = target.asset === "city" ? VERTEX_CITY_SIZE : VERTEX_SETTLEMENT_SIZE;

  context.save();
  context.translate(target.point.x, target.point.y);
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;

  if (target.highlighted) {
    drawTargetGlow(context, accent, () => {
      context.beginPath();
      context.arc(0, 0, VERTEX_GLOW_RADIUS, 0, Math.PI * 2);
    });
  } else {
    drawMarkerRing(context, () => {
      context.beginPath();
      context.arc(0, 0, VERTEX_MARKER_RADIUS, 0, Math.PI * 2);
    });
  }

  if (preview) {
    drawGhostPiece(
      context,
      preview,
      pieceSize * (target.highlighted ? VERTEX_HOVER_PIECE_SCALE : 1),
      target.highlighted ?? false,
      accent,
    );
  }

  context.restore();
}

/** Legal road edge: no marker ring, just the road piece ghosted along the edge. */
function drawRoadTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  preview: HTMLCanvasElement | null,
) {
  if (!preview) {
    return;
  }

  context.save();
  context.translate(target.point.x, target.point.y);
  context.rotate((target.angle * Math.PI) / 180);
  context.scale(1, ROAD_PIECE_SCALE_Y);
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;
  drawGhostPiece(
    context,
    preview,
    ROAD_TARGET_SIZE * (target.highlighted ? ROAD_HOVER_PIECE_SCALE : 1),
    target.highlighted ?? false,
    PLAYER_COLOR_HEX[target.theme],
  );
  context.restore();
}

/**
 * A preview of the piece the click would build. At rest it is translucent, so a
 * board full of options still reads as terrain; the dark rim is what keeps it
 * legible over both the pale desert and the dark forest. Hovering promotes it to
 * a solid piece sitting in a player-tinted glow.
 */
function drawGhostPiece(
  context: CanvasRenderingContext2D,
  preview: HTMLCanvasElement,
  size: number,
  highlighted: boolean,
  accent: string,
) {
  const rimOffset = Math.max(1.2, size * 0.017);
  const alpha = context.globalAlpha * (highlighted ? 1 : TARGET_RESTING_PIECE_ALPHA);

  context.save();
  // A hairline rim rather than a full outline: enough to separate the ghost from
  // pale sand and dark forest alike without reading as a solid placed piece.
  context.globalAlpha = alpha * 0.7;
  context.filter = "brightness(0.24) saturate(0.7)";
  for (const [offsetX, offsetY] of [
    [-rimOffset, 0],
    [rimOffset, 0],
    [0, -rimOffset],
    [0, rimOffset],
  ]) {
    context.drawImage(preview, -size / 2 + offsetX, -size / 2 + offsetY, size, size);
  }

  context.globalAlpha = alpha;
  context.filter = "none";
  context.shadowBlur = highlighted ? 14 : 6;
  context.shadowColor = highlighted ? withAlpha(accent, 0.9) : "rgba(12, 40, 58, 0.5)";
  context.shadowOffsetY = highlighted ? 0 : 2;
  context.drawImage(preview, -size / 2, -size / 2, size, size);
  context.restore();
}

function drawRobberTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  image: HTMLImageElement | null,
) {
  context.save();
  context.translate(target.point.x, target.point.y);
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;

  if (target.highlighted) {
    drawTargetGlow(context, "#ffc22d", () => {
      context.beginPath();
      context.arc(0, 0, 58, 0, Math.PI * 2);
    });

    if (image) {
      context.globalAlpha *= 0.94;
      context.shadowBlur = 12;
      context.shadowColor = "rgba(255, 199, 69, 0.72)";
      context.drawImage(image, -46, -46, 92, 92);
    }
  } else {
    drawMarkerRing(context, () => {
      context.beginPath();
      context.arc(0, 0, 9, 0, Math.PI * 2);
    });
  }

  context.restore();
}

/**
 * The resting affordance: a translucent well with a dark keyline so it stays
 * legible over both the pale desert and the dark forest tiles, plus a warm
 * inner stroke that ties it to the board's gold trim.
 */
function drawMarkerRing(context: CanvasRenderingContext2D, createPath: () => void) {
  context.save();
  createPath();
  context.fillStyle = "rgba(255, 248, 227, 0.16)";
  context.fill();
  context.lineWidth = 4.5;
  context.strokeStyle = "rgba(9, 38, 56, 0.5)";
  context.stroke();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 244, 214, 0.72)";
  context.stroke();
  context.restore();
}

/** The hover affordance: a soft player-tinted pool under the previewed piece. */
function drawTargetGlow(
  context: CanvasRenderingContext2D,
  accent: string,
  createPath: () => void,
) {
  context.save();
  context.shadowBlur = 22;
  context.shadowColor = withAlpha(accent, 0.85);
  createPath();
  context.fillStyle = withAlpha(accent, 0.38);
  context.fill();
  context.restore();
}

function withAlpha(color: string, alpha: number): string {
  return `${color}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function drawPlayerPiece(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  path: string,
  point: PixelCoordinate,
  size: number,
  theme: PlayerColor,
  angle = 0,
  scaleY = 1,
) {
  const tintedPiece = getTintedPieceCanvas(image, path, theme, PLAYER_COLOR_HEX[theme]);

  context.save();
  context.translate(point.x, point.y);
  context.rotate((angle * Math.PI) / 180);
  context.scale(1, scaleY);
  const rimOffset = Math.max(1.8, size * 0.018);
  context.filter = "brightness(0.28) saturate(0.72)";
  context.globalAlpha = 0.88;
  for (const [offsetX, offsetY] of [
    [-rimOffset, 0],
    [rimOffset, 0],
    [0, -rimOffset],
    [0, rimOffset],
    [-rimOffset, -rimOffset],
    [rimOffset, -rimOffset],
    [-rimOffset, rimOffset],
    [rimOffset, rimOffset],
  ]) {
    context.drawImage(tintedPiece, -size / 2 + offsetX, -size / 2 + offsetY, size, size);
  }
  context.filter = "none";
  context.globalAlpha = 1;
  context.shadowBlur = 4;
  context.shadowColor = "rgba(15, 38, 58, 0.34)";
  context.shadowOffsetY = 2;
  context.drawImage(tintedPiece, -size / 2, -size / 2, size, size);
  context.restore();
}

function getTintedPieceCanvas(
  image: HTMLImageElement,
  path: string,
  theme: PlayerColor,
  color: string,
): HTMLCanvasElement {
  const key = `${path}:${theme}`;
  const cached = tintedPieceCanvases.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return canvas;
  }

  // Multiply preserves the modeled clay lighting while keeping player colors
  // rich enough to distinguish at the board's smallest rendered sizes.
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "multiply";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.16;
  context.drawImage(image, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "destination-in";
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "source-over";
  tintedPieceCanvases.set(key, canvas);
  return canvas;
}

function drawPortTradeBadge(
  context: CanvasRenderingContext2D,
  point: PixelCoordinate,
  trade: "any" | ResourceType,
  resourceImage: HTMLImageElement | null,
) {
  const left = point.x - PORT_TRADE_BADGE_WIDTH / 2;
  const top = point.y - PORT_TRADE_BADGE_HEIGHT / 2;
  const accent = trade === "any" ? "#8b6a35" : PORT_RESOURCE_ACCENTS[trade];
  const mark = { x: point.x - 19.5, y: point.y };
  const plaque = context.createLinearGradient(
    left,
    top,
    left + PORT_TRADE_BADGE_WIDTH,
    top + PORT_TRADE_BADGE_HEIGHT,
  );
  plaque.addColorStop(0, "#fff8e6");
  plaque.addColorStop(0.56, "#f9e9ca");
  plaque.addColorStop(1, "#efd5aa");

  context.save();
  createRoundedRectPath(context, left, top, PORT_TRADE_BADGE_WIDTH, PORT_TRADE_BADGE_HEIGHT, 12);
  context.fillStyle = plaque;
  context.shadowBlur = 3;
  context.shadowColor = "rgba(54, 38, 21, 0.34)";
  context.shadowOffsetY = 2;
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 3;
  context.strokeStyle = accent;
  context.stroke();

  createRoundedRectPath(
    context,
    left + 3,
    top + 3,
    PORT_TRADE_BADGE_WIDTH - 6,
    PORT_TRADE_BADGE_HEIGHT - 6,
    9,
  );
  context.lineWidth = 1.2;
  context.strokeStyle = "rgba(255, 255, 255, 0.52)";
  context.stroke();

  context.beginPath();
  context.moveTo(point.x, top + 7);
  context.lineTo(point.x, top + PORT_TRADE_BADGE_HEIGHT - 7);
  context.lineWidth = 1.4;
  context.strokeStyle = `${accent}66`;
  context.stroke();

  if (trade === "any") {
    drawAnyResourceMark(context, mark);
  } else if (resourceImage) {
    drawCroppedResourceMark(context, mark, resourceImage, accent);
  }

  context.fillStyle = "#233b55";
  context.font = "900 15px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(trade === "any" ? "3:1" : "2:1", point.x + 19.5, point.y + 0.5);
  context.restore();
}

function drawCroppedResourceMark(
  context: CanvasRenderingContext2D,
  point: PixelCoordinate,
  image: HTMLImageElement,
  accent: string,
) {
  const sourceSize = Math.min(image.naturalWidth * 0.68, image.naturalHeight * 0.46);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.save();
  context.beginPath();
  context.arc(point.x, point.y, PORT_RESOURCE_MARK_SIZE / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    point.x - PORT_RESOURCE_MARK_SIZE / 2,
    point.y - PORT_RESOURCE_MARK_SIZE / 2,
    PORT_RESOURCE_MARK_SIZE,
    PORT_RESOURCE_MARK_SIZE,
  );
  context.restore();

  context.beginPath();
  context.arc(point.x, point.y, PORT_RESOURCE_MARK_SIZE / 2, 0, Math.PI * 2);
  context.lineWidth = 1.5;
  context.strokeStyle = accent;
  context.stroke();
}

function drawAnyResourceMark(context: CanvasRenderingContext2D, point: PixelCoordinate) {
  const colors = ["#3c9b55", "#d9643a", "#f3e2a1", "#e7ad2c", "#75889a"];

  context.save();
  context.shadowBlur = 2;
  context.shadowColor = "rgba(47, 55, 62, 0.25)";
  colors.forEach((color, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / colors.length;
    context.beginPath();
    context.arc(
      point.x + Math.cos(angle) * 7.2,
      point.y + Math.sin(angle) * 7.2,
      3.8,
      0,
      Math.PI * 2,
    );
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = "rgba(255, 251, 235, 0.95)";
    context.lineWidth = 1.2;
    context.stroke();
  });
  context.restore();
}

function strokeLine(
  context: CanvasRenderingContext2D,
  start: PixelCoordinate,
  end: PixelCoordinate,
  width: number,
  color: string,
) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.lineWidth = width;
  context.strokeStyle = color;
  context.stroke();
}

function createRoundedHexagonPath(
  context: CanvasRenderingContext2D,
  center: PixelCoordinate,
  radius: number,
  cornerRadius: number,
  rotation = -Math.PI / 2,
) {
  const vertices = Array.from({ length: 6 }, (_, index) => {
    const angle = rotation + (index * Math.PI) / 3;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
  const edgeLength = Math.hypot(vertices[1]!.x - vertices[0]!.x, vertices[1]!.y - vertices[0]!.y);
  const inset = Math.min(0.4, cornerRadius / edgeLength);

  context.beginPath();
  vertices.forEach((vertex, index) => {
    const previous = vertices[(index + vertices.length - 1) % vertices.length]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const start = {
      x: vertex.x + (previous.x - vertex.x) * inset,
      y: vertex.y + (previous.y - vertex.y) * inset,
    };
    const end = {
      x: vertex.x + (next.x - vertex.x) * inset,
      y: vertex.y + (next.y - vertex.y) * inset,
    };

    if (index === 0) {
      context.moveTo(start.x, start.y);
    } else {
      context.lineTo(start.x, start.y);
    }
    context.quadraticCurveTo(vertex.x, vertex.y, end.x, end.y);
  });
  context.closePath();
}

function createRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

async function loadImages(paths: readonly string[]) {
  const uniquePaths = [...new Set(paths)];
  const entries = await Promise.all(
    uniquePaths.map(async (path) => [path, await loadImage(path)] as const),
  );
  return new Map(entries);
}

function loadImage(path: string): Promise<HTMLImageElement | null> {
  const cached = imagePromises.get(path);
  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => {
      imagePromises.delete(path);
      resolve(null);
    };
    image.src = path;
  });
  imagePromises.set(path, promise);
  return promise;
}

function createStaticSceneKey(scene: StaticScene): string {
  return JSON.stringify({
    layout: getLayoutKey(scene.boardLayout),
    ports: scene.ports.map(({ edgeKey, id, trade }) => [edgeKey, id, trade]),
    renderScale: scene.renderScale,
    tiles: scene.tiles.map(({ id, numberToken, q, r, terrain }) => [
      id,
      numberToken,
      q,
      r,
      terrain,
    ]),
  });
}

function createDynamicSceneKey(scene: DynamicScene): string {
  return JSON.stringify({
    buildings: scene.buildings.map(({ kind, playerId, vertexKey }) => [kind, playerId, vertexKey]),
    layout: getLayoutKey(scene.boardLayout),
    playerThemes: [...scene.playerThemes.entries()].sort(([first], [second]) =>
      first.localeCompare(second),
    ),
    renderScale: scene.renderScale,
    roads: scene.roads.map(({ edgeKey, playerId }) => [edgeKey, playerId]),
    robberTileId: scene.robberTileId,
    targets: scene.targets.map(({ angle, asset, disabled, highlighted, point, theme }) => ({
      angle,
      asset,
      disabled,
      highlighted,
      point,
      theme,
    })),
    tiles: scene.tiles.map(({ id, q, r }) => [id, q, r]),
  });
}

function getLayoutKey(boardLayout: BoardLayout) {
  return [boardLayout.origin.x, boardLayout.origin.y, boardLayout.tileRadius, boardLayout.tileSize];
}
