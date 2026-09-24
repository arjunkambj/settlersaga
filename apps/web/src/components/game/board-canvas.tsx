"use client";

import {
  NUMBER_TOKEN_PIPS,
  RESOURCE_ORDER,
  type PixelCoordinate,
  type PlayerColor,
  type PlayerGameView,
  type ResourceType,
  type TerrainType,
} from "@settersaga/game";
import { memo, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { preload } from "react-dom";

import {
  PIECE_ASSET_PATHS,
  PORT_BOAT_ASSET_PATH,
  PORT_BOAT_RENDER_SIZE,
  PORT_TRADE_BADGE_SIZE,
  ROBBER_ASSET_PATH,
  TERRAIN_ATLAS,
  TERRAIN_ATLAS_ASSET_PATH,
} from "@/constants/game/board-assets";
import { RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import {
  BOARD_CANVAS,
  getEdgePlacement,
  getPortPlacement,
  getPortTradeBadgePoint,
  getTilePoint,
  getVertexPoint,
  type BoardLayout,
  type PortPlacement,
} from "@/lib/game/board-layout";

type Board = PlayerGameView["board"];
type NumberToken = NonNullable<Board["tiles"][number]["numberToken"]>;

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
const CITY_PIECE_SIZE = 94;
const ROAD_PIECE_SIZE = 124;
const ROAD_PIECE_SCALE_Y = 0.82;
const SETTLEMENT_PIECE_SIZE = 82;
const PORT_DOCK_WIDTH = 14;
const TILE_TERRAIN_INSET = 6.5;
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

const imagePromises = new Map<string, Promise<HTMLImageElement | null>>();
const loadedImages = new Map<string, HTMLImageElement>();
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
  preload(TERRAIN_ATLAS_ASSET_PATH, { as: "image", fetchPriority: "high" });
  for (const path of [
    PORT_BOAT_ASSET_PATH,
    ROBBER_ASSET_PATH,
    ...Object.values(PIECE_ASSET_PATHS),
  ]) {
    preload(path, { as: "image" });
  }
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
    <div aria-hidden="true" className="board-canvas">
      <canvas
        className="board-canvas-layer"
        height={BOARD_CANVAS.height}
        ref={staticCanvasRef}
        width={BOARD_CANVAS.width}
      />
      <canvas
        className="board-canvas-layer board-canvas-dynamic"
        height={BOARD_CANVAS.height}
        ref={dynamicCanvasRef}
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

    const resizeObserver = new ResizeObserver(scheduleDraw);
    scheduleDrawRef.current = scheduleDraw;
    resizeObserver.observe(canvas);
    draw();

    return () => {
      cancelled = true;
      drawRevisionRef.current += 1;
      scheduleDrawRef.current = () => undefined;
      resizeObserver.disconnect();
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
    port.trade === "any" ? [] : [RESOURCE_CARD_ASSET_PATHS[port.trade]],
  );

  await drawWhileImagesLoad(
    [PORT_BOAT_ASSET_PATH, TERRAIN_ATLAS_ASSET_PATH, ...portResourcePaths],
    isCancelled,
    (images) => {
      const context = prepareCanvas(canvas, scene.renderScale);
      if (!context) {
        return;
      }

      const palette = getBoardPalette(canvas);
      drawTerrain(context, scene, images.get(TERRAIN_ATLAS_ASSET_PATH) ?? null, palette);
      drawPorts(context, scene, images, palette);
    },
  );
}

async function renderDynamicScene(
  canvas: HTMLCanvasElement,
  scene: DynamicScene,
  isCancelled: () => boolean,
) {
  await drawWhileImagesLoad(
    [...Object.values(PIECE_ASSET_PATHS), ROBBER_ASSET_PATH],
    isCancelled,
    (images) => {
      const context = prepareCanvas(canvas, scene.renderScale);
      if (!context) {
        return;
      }

      const palette = getBoardPalette(canvas);
      drawRoads(context, scene, images, palette);
      drawBuildings(context, scene, images, palette);
      drawRobber(context, scene, images.get(ROBBER_ASSET_PATH) ?? null, palette);
      drawTargets(context, scene, images, palette);
    },
  );
}

/**
 * Draws right away with the images that have already arrived (terrain falls back to flat
 * color), then once more when the rest have loaded, so the island never waits on its textures.
 */
async function drawWhileImagesLoad(
  paths: readonly string[],
  isCancelled: () => boolean,
  draw: (images: ReadonlyMap<string, HTMLImageElement | null>) => void,
) {
  draw(new Map(paths.map((path) => [path, loadedImages.get(path) ?? null])));
  if (paths.every((path) => loadedImages.has(path))) {
    return;
  }

  const images = await loadImages(paths);
  if (!isCancelled()) {
    draw(images);
  }
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

/** Board colors come from the CSS tokens in styles/game-board.css. Colors mixed
    with `withAlpha` must be 6-digit hex. */
function getBoardPalette(canvas: HTMLCanvasElement) {
  const styles = getComputedStyle(canvas);
  const color = (name: string) => styles.getPropertyValue(`--${name}`).trim();
  return {
    earth: color("board-earth"),
    earthDeep: color("board-earth-deep"),
    highlight: color("board-highlight"),
    pieceShadow: color("board-piece-shadow"),
    plaqueEdge: color("board-plaque-edge"),
    plaqueFace: color("board-plaque-face"),
    plaqueInk: color("board-plaque-ink"),
    plaqueMid: color("board-plaque-mid"),
    plaqueShadow: color("board-plaque-shadow"),
    players: {
      blue: color("player-blue"),
      green: color("player-green"),
      orange: color("player-orange"),
      pink: color("player-pink"),
      purple: color("player-purple"),
      red: color("player-red"),
      teal: color("player-teal"),
      yellow: color("player-yellow"),
    } satisfies Record<PlayerColor, string>,
    portAccents: {
      any: color("board-port-any"),
      brick: color("board-port-brick"),
      sheep: color("board-port-sheep"),
      stone: color("board-port-stone"),
      tree: color("board-port-tree"),
      wheat: color("board-port-wheat"),
    } satisfies Record<"any" | ResourceType, string>,
    robberGlow: color("board-robber-glow"),
    terrain: {
      desert: color("board-terrain-desert"),
      fields: color("board-terrain-fields"),
      forest: color("board-terrain-forest"),
      hills: color("board-terrain-hills"),
      mountains: color("board-terrain-mountains"),
      pasture: color("board-terrain-pasture"),
    } satisfies Record<TerrainType, string>,
    sand: color("board-sand"),
    sandLight: color("board-sand-light"),
    shadow: color("board-shadow"),
    tokenEdge: color("board-token-edge"),
    tokenFace: color("board-token-face"),
    tokenHot: color("board-token-hot"),
    tokenInk: color("board-token-ink"),
  };
}

type BoardPalette = ReturnType<typeof getBoardPalette>;

function drawTerrain(
  context: CanvasRenderingContext2D,
  scene: StaticScene,
  terrainAtlas: HTMLImageElement | null,
  palette: BoardPalette,
) {
  const tiles = scene.tiles
    .map((tile) => ({
      point: getTilePoint(scene.boardLayout, tile),
      tile,
    }))
    .sort((first, second) => first.point.y - second.point.y);

  drawCoastline(context, scene.boardLayout, palette);

  for (const { point } of tiles) {
    createRoundedHexagonPath(
      context,
      { x: point.x, y: point.y + 8 },
      scene.boardLayout.tileRadius + 0.65,
      0,
      0,
    );
    context.fillStyle = palette.earthDeep;
    context.fill();
  }

  for (const { point } of tiles) {
    createRoundedHexagonPath(context, point, scene.boardLayout.tileRadius + 0.65, 8, 0);
    const bevel = context.createLinearGradient(
      point.x,
      point.y - scene.boardLayout.tileRadius,
      point.x,
      point.y + scene.boardLayout.tileRadius,
    );
    bevel.addColorStop(0, palette.sandLight);
    bevel.addColorStop(0.5, palette.sand);
    bevel.addColorStop(1, palette.earth);
    context.fillStyle = bevel;
    context.fill();
  }

  const terrainRadius = scene.boardLayout.tileRadius - TILE_TERRAIN_INSET;
  const textureSize = terrainRadius * 2;
  for (const { point, tile } of tiles) {
    context.save();
    createRoundedHexagonPath(context, point, terrainRadius, 5, 0);
    if (terrainAtlas) {
      const frame = TERRAIN_ATLAS.frames[tile.terrain];
      context.clip();
      context.drawImage(
        terrainAtlas,
        frame.column * TERRAIN_ATLAS.frameSize,
        frame.row * TERRAIN_ATLAS.frameSize,
        TERRAIN_ATLAS.frameSize,
        TERRAIN_ATLAS.frameSize,
        point.x - textureSize / 2,
        point.y - textureSize / 2,
        textureSize,
        textureSize,
      );
    } else {
      context.fillStyle = palette.terrain[tile.terrain];
      context.fill();
    }
    context.restore();
  }

  for (const { point } of tiles) {
    createRoundedHexagonPath(context, point, terrainRadius, 5, 0);
    context.lineWidth = 1.2;
    context.strokeStyle = palette.sandLight;
    context.stroke();
  }

  for (const { point, tile } of tiles) {
    if (tile.numberToken !== null) {
      drawNumberToken(context, tile.numberToken, point, scene.boardLayout.tileSize, palette);
    }
  }
}

function drawCoastline(
  context: CanvasRenderingContext2D,
  layout: BoardLayout,
  palette: BoardPalette,
) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const [edgeKey, tileIds] of Object.entries(layout.topology.edgeTileIds)) {
    if (tileIds.length !== 1) continue;
    const vertices = layout.topology.edgeVertices[edgeKey];
    const start = vertices?.[0] ? getVertexPoint(layout, vertices[0]) : null;
    const end = vertices?.[1] ? getVertexPoint(layout, vertices[1]) : null;
    if (!start || !end) continue;
    const tile = layout.topology.tileById[tileIds[0]!];
    if (!tile) continue;
    const point = getTilePoint(layout, tile);
    const bevel = context.createLinearGradient(
      0,
      point.y - layout.tileRadius,
      0,
      point.y + layout.tileRadius,
    );
    bevel.addColorStop(0, palette.sandLight);
    bevel.addColorStop(0.5, palette.sand);
    bevel.addColorStop(1, palette.earth);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = bevel;
    context.lineWidth = 12;
    context.stroke();
  }
  context.restore();
}

function drawNumberToken(
  context: CanvasRenderingContext2D,
  number: NumberToken,
  tilePoint: PixelCoordinate,
  tileSize: number,
  palette: BoardPalette,
) {
  const point = { x: tilePoint.x, y: tilePoint.y + tileSize * 0.16 };
  const radius = Math.min(44, tileSize * 0.125);
  const isHot = number === 6 || number === 8;
  const ink = isHot ? palette.tokenHot : palette.tokenInk;

  context.save();
  context.shadowBlur = 8;
  context.shadowColor = palette.shadow;
  context.shadowOffsetY = 3;
  createRoundedHexagonPath(context, point, radius, 5, Math.PI / 6);
  context.fillStyle = palette.tokenEdge;
  context.fill();
  context.restore();

  createRoundedHexagonPath(context, point, radius - 1.2, 4, Math.PI / 6);
  const face = context.createRadialGradient(
    point.x - radius * 0.28,
    point.y - radius * 0.34,
    radius * 0.15,
    point.x,
    point.y,
    radius,
  );
  face.addColorStop(0, palette.tokenFace);
  face.addColorStop(0.8, palette.tokenFace);
  face.addColorStop(1, palette.tokenEdge);
  context.fillStyle = face;
  context.fill();
  context.lineWidth = isHot ? 3 : 2;
  context.strokeStyle = isHot ? palette.tokenHot : palette.tokenEdge;
  context.stroke();

  context.fillStyle = ink;
  context.font = `800 ${Math.round(radius * 0.92)}px ui-rounded, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), point.x, point.y - radius * 0.08);

  const pips = NUMBER_TOKEN_PIPS[number];
  const pipGap = Math.max(6.2, radius * 0.2);
  const firstPipX = point.x - ((pips - 1) * pipGap) / 2;
  context.fillStyle = ink;
  for (let index = 0; index < pips; index += 1) {
    context.beginPath();
    context.arc(
      firstPipX + index * pipGap,
      point.y + radius * 0.42,
      radius * 0.075,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawPorts(
  context: CanvasRenderingContext2D,
  scene: StaticScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  const ports = scene.ports.flatMap((port) => {
    const placement = getPortPlacement(scene.boardLayout, port.edgeKey);
    return placement ? [{ placement, port }] : [];
  });

  for (const { placement } of ports) {
    for (const dock of placement.docks) {
      drawDock(context, dock.start, dock.end, palette);
    }
  }

  for (const { placement, port } of ports) {
    drawPort(
      context,
      placement,
      port.trade,
      images.get(PORT_BOAT_ASSET_PATH) ?? null,
      port.trade === "any" ? null : (images.get(RESOURCE_CARD_ASSET_PATHS[port.trade]) ?? null),
      palette,
    );
  }
}

function drawDock(
  context: CanvasRenderingContext2D,
  start: PixelCoordinate,
  end: PixelCoordinate,
  palette: BoardPalette,
) {
  const plankLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (plankLength < 4) {
    return;
  }

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const half = PORT_DOCK_WIDTH / 2;

  context.save();
  context.translate((start.x + end.x) / 2, (start.y + end.y) / 2);
  context.rotate(angle);
  context.lineJoin = "round";

  context.fillStyle = palette.earthDeep;
  createRoundedRectPath(
    context,
    -plankLength / 2 + 1,
    -half + 1.5,
    plankLength,
    PORT_DOCK_WIDTH,
    3,
  );
  context.fill();

  const wood = context.createLinearGradient(0, -half, 0, half);
  wood.addColorStop(0, palette.sandLight);
  wood.addColorStop(0.5, palette.sand);
  wood.addColorStop(1, palette.earth);
  createRoundedRectPath(context, -plankLength / 2, -half, plankLength, PORT_DOCK_WIDTH, 3);
  context.fillStyle = wood;
  context.fill();

  context.fillStyle = palette.earth;
  createRoundedRectPath(context, -plankLength / 2, -half, plankLength, 2.1, 1);
  context.fill();
  createRoundedRectPath(context, -plankLength / 2, half - 2.1, plankLength, 2.1, 1);
  context.fill();

  context.strokeStyle = palette.sandLight;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-plankLength / 2 + 4, -half + 3.2);
  context.lineTo(plankLength / 2 - 4, -half + 3.2);
  context.stroke();

  context.strokeStyle = palette.earth;
  context.globalAlpha = 0.45;
  context.lineWidth = 1;
  const seamCount = Math.max(2, Math.round(plankLength / 22));
  for (let index = 1; index < seamCount; index += 1) {
    const x = -plankLength / 2 + (plankLength * index) / seamCount;
    context.beginPath();
    context.moveTo(x, -half + 2.4);
    context.lineTo(x, half - 2.4);
    context.stroke();
  }

  context.restore();
}

function drawPort(
  context: CanvasRenderingContext2D,
  placement: PortPlacement,
  trade: "any" | ResourceType,
  boatImage: HTMLImageElement | null,
  resourceImage: HTMLImageElement | null,
  palette: BoardPalette,
) {
  const { height, width } = PORT_BOAT_RENDER_SIZE;

  if (boatImage) {
    context.save();
    context.translate(placement.x, placement.y);
    context.shadowBlur = 5;
    context.shadowColor = withAlpha(palette.pieceShadow, 0.24);
    context.shadowOffsetY = 3;
    context.drawImage(boatImage, -width / 2, -height / 2, width, height);
    context.restore();
  }

  drawPortTradeBadge(context, getPortTradeBadgePoint(placement), trade, resourceImage, palette);
}

function drawRoads(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  const path = PIECE_ASSET_PATHS.road;
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
      getTintedPieceCanvas(image, path, getPlayerTint(scene, road.playerId, palette)),
      placement,
      ROAD_PIECE_SIZE,
      palette,
      placement.angle,
      ROAD_PIECE_SCALE_Y,
    );
  }
}

function drawBuildings(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  for (const building of scene.buildings) {
    const point = getVertexPoint(scene.boardLayout, building.vertexKey);
    const path = PIECE_ASSET_PATHS[building.kind];
    const image = images.get(path) ?? null;
    if (!point || !image) {
      continue;
    }

    drawPlayerPiece(
      context,
      getTintedPieceCanvas(image, path, getPlayerTint(scene, building.playerId, palette)),
      point,
      building.kind === "city" ? CITY_PIECE_SIZE : SETTLEMENT_PIECE_SIZE,
      palette,
    );
  }
}

function getPlayerTint(scene: DynamicScene, playerId: string, palette: BoardPalette): string {
  return palette.players[scene.playerThemes.get(playerId) ?? "red"];
}

function drawRobber(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  image: HTMLImageElement | null,
  palette: BoardPalette,
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
  context.shadowColor = withAlpha(palette.pieceShadow, 0.42);
  context.shadowOffsetY = 4;
  context.drawImage(image, point.x - size / 2, point.y - size * 0.5, size, size);
  context.restore();
}

function drawTargets(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  // The hovered target paints last so its glow and full-size preview are never
  // clipped by a neighbouring marker.
  const ordered = [...scene.targets].sort(
    (first, second) => Number(Boolean(first.highlighted)) - Number(Boolean(second.highlighted)),
  );

  for (const target of ordered) {
    if (target.asset === "robber") {
      drawRobberTarget(context, target, images.get(ROBBER_ASSET_PATH) ?? null, palette);
      continue;
    }

    const path = PIECE_ASSET_PATHS[target.asset];
    const image = images.get(path) ?? null;
    const accent = palette.players[target.theme];
    const preview = image ? getTintedPieceCanvas(image, path, accent) : null;

    if (target.asset === "road") {
      drawRoadTarget(context, target, preview, accent, palette);
    } else {
      drawVertexTarget(context, target, preview, accent, palette);
    }
  }
}

/** Legal settlement/city corner: a marker ring at rest, the piece itself on hover. */
function drawVertexTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  preview: HTMLCanvasElement | null,
  accent: string,
  palette: BoardPalette,
) {
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
    drawMarkerRing(context, palette, () => {
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
      palette,
    );
  }

  context.restore();
}

/** Legal road edge: no marker ring, just the road piece ghosted along the edge. */
function drawRoadTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  preview: HTMLCanvasElement | null,
  accent: string,
  palette: BoardPalette,
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
    accent,
    palette,
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
  palette: BoardPalette,
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
  context.shadowColor = highlighted ? withAlpha(accent, 0.9) : withAlpha(palette.pieceShadow, 0.5);
  context.shadowOffsetY = highlighted ? 0 : 2;
  context.drawImage(preview, -size / 2, -size / 2, size, size);
  context.restore();
}

function drawRobberTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  image: HTMLImageElement | null,
  palette: BoardPalette,
) {
  context.save();
  context.translate(target.point.x, target.point.y);
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;

  if (target.highlighted) {
    drawTargetGlow(context, palette.robberGlow, () => {
      context.beginPath();
      context.arc(0, 0, 58, 0, Math.PI * 2);
    });

    if (image) {
      context.globalAlpha *= 0.94;
      context.shadowBlur = 12;
      context.shadowColor = withAlpha(palette.robberGlow, 0.72);
      context.drawImage(image, -46, -46, 92, 92);
    }
  } else {
    drawMarkerRing(context, palette, () => {
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
function drawMarkerRing(
  context: CanvasRenderingContext2D,
  palette: BoardPalette,
  createPath: () => void,
) {
  context.save();
  createPath();
  context.fillStyle = withAlpha(palette.highlight, 0.16);
  context.fill();
  context.lineWidth = 4.5;
  context.strokeStyle = withAlpha(palette.pieceShadow, 0.5);
  context.stroke();
  context.lineWidth = 2;
  context.strokeStyle = withAlpha(palette.highlight, 0.72);
  context.stroke();
  context.restore();
}

/** The hover affordance: a soft player-tinted pool under the previewed piece. */
function drawTargetGlow(context: CanvasRenderingContext2D, accent: string, createPath: () => void) {
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
  tintedPiece: HTMLCanvasElement,
  point: PixelCoordinate,
  size: number,
  palette: BoardPalette,
  angle = 0,
  scaleY = 1,
) {
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
  context.shadowColor = withAlpha(palette.pieceShadow, 0.34);
  context.shadowOffsetY = 2;
  context.drawImage(tintedPiece, -size / 2, -size / 2, size, size);
  context.restore();
}

function getTintedPieceCanvas(
  image: HTMLImageElement,
  path: string,
  color: string,
): HTMLCanvasElement {
  const key = `${path}:${color}`;
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
  palette: BoardPalette,
) {
  const { height, width } = PORT_TRADE_BADGE_SIZE;
  const left = point.x - width / 2;
  const top = point.y - height / 2;
  const accent = palette.portAccents[trade];
  const mark = { x: point.x - 19.5, y: point.y };
  const plaque = context.createLinearGradient(left, top, left + width, top + height);
  plaque.addColorStop(0, palette.plaqueFace);
  plaque.addColorStop(0.56, palette.plaqueMid);
  plaque.addColorStop(1, palette.plaqueEdge);

  context.save();
  createRoundedRectPath(context, left, top, width, height, 12);
  context.fillStyle = plaque;
  context.shadowBlur = 3;
  context.shadowColor = withAlpha(palette.plaqueShadow, 0.34);
  context.shadowOffsetY = 2;
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 3;
  context.strokeStyle = accent;
  context.stroke();

  createRoundedRectPath(context, left + 3, top + 3, width - 6, height - 6, 9);
  context.lineWidth = 1.2;
  context.strokeStyle = withAlpha(palette.highlight, 0.52);
  context.stroke();

  context.beginPath();
  context.moveTo(point.x, top + 7);
  context.lineTo(point.x, top + height - 7);
  context.lineWidth = 1.4;
  context.strokeStyle = withAlpha(accent, 0.4);
  context.stroke();

  if (trade === "any") {
    drawAnyResourceMark(context, mark, palette);
  } else if (resourceImage) {
    drawCroppedResourceMark(context, mark, resourceImage, accent);
  }

  context.fillStyle = palette.plaqueInk;
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

/** A ring of every resource's accent: the harbor takes any one of them. */
function drawAnyResourceMark(
  context: CanvasRenderingContext2D,
  point: PixelCoordinate,
  palette: BoardPalette,
) {
  context.save();
  context.shadowBlur = 2;
  context.shadowColor = withAlpha(palette.pieceShadow, 0.25);
  RESOURCE_ORDER.forEach((resource, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / RESOURCE_ORDER.length;
    context.beginPath();
    context.arc(
      point.x + Math.cos(angle) * 7.2,
      point.y + Math.sin(angle) * 7.2,
      3.8,
      0,
      Math.PI * 2,
    );
    context.fillStyle = palette.portAccents[resource];
    context.fill();
    context.strokeStyle = withAlpha(palette.highlight, 0.95);
    context.lineWidth = 1.2;
    context.stroke();
  });
  context.restore();
}

function createRoundedHexagonPath(
  context: CanvasRenderingContext2D,
  center: PixelCoordinate,
  radius: number,
  cornerRadius: number,
  rotation: number,
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
    image.onload = () => {
      loadedImages.set(path, image);
      resolve(image);
    };
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
