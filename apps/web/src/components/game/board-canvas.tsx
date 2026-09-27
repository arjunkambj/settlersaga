"use client";

import {
  NUMBER_TOKEN_PIPS,
  type PixelCoordinate,
  type PlayerColor,
  type PlayerGameView,
  type ResourceType,
  type TerrainType,
} from "@settersaga/game";
import { memo, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { preload } from "react-dom";

import { getPlayerPieceArt } from "@/components/game/board-piece-art";
import {
  BOARD_PIECE_ART_PATHS,
  PORT_BOAT_ASSET_PATH,
  PORT_BOAT_RENDER_SIZE,
  PORT_BOAT_SAIL,
  PORT_WALKWAY_ASSET_PATH,
  ROAD_TEXTURE_ASSET_PATH,
  ROBBER_ASSET_PATH,
  TERRAIN_ATLAS,
  TERRAIN_FEATURE_ASSET_PATHS,
  TERRAIN_GROUND_ATLAS_ASSET_PATH,
  TERRAIN_ICON_ASSET_PATHS,
} from "@/constants/game/board-assets";
import {
  BOARD_CANVAS,
  getPortPlacement,
  getTilePoint,
  getVertexPoint,
  type BoardLayout,
  type PortPlacement,
} from "@/lib/game/board-layout";
import { mixColor, withAlpha } from "@/lib/game/canvas-colors";

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

// The sizes below are multiples of the tile radius (center to corner), so every
// map keeps the same proportions whatever radius its layout fits.
/** Half the sand seam between neighbouring tiles. */
const TILE_GAP = 0.045;
const GROUND_TEXTURE_OPACITY = 0.4;
const TILE_BEVEL = 0.05;
const TERRAIN_FEATURE_WIDTH = 1.0;
const TERRAIN_FEATURE_OFFSET_Y = -0.43;
const TOKEN_RADIUS = 0.28;
const TOKEN_OFFSET_Y = 0.3;
// Piece art is drawn at these sizes; each image leaves room around the piece.
const SETTLEMENT_ART_SIZE = 0.68;
const CITY_ART_SIZE = 0.9;
// A road is a raised wooden bar: its top face is ROAD_WIDTH wide and its side
// shows ROAD_DEPTH below it, straight down whatever the road's angle, like the
// houses' own walls under their roofs.
const ROAD_WIDTH = 0.13;
const ROAD_DEPTH = 0.05;
const ROAD_OUTLINE = 0.03;
/** How far a road end that joins nothing stops short of its corner. */
const ROAD_END_GAP = 0.13;
const ROBBER_SIZE = 0.9;
/** The robber stands on the tile's art, above the number, so the number stays readable. */
const ROBBER_OFFSET_Y = -0.4;
/** On a tile without a number (the desert) it stands in the middle. */
const ROBBER_OFFSET_Y_NO_NUMBER = 0.05;
const PORT_WALKWAY_WIDTH = 0.2;

/** Placement targets: a small ring (or an edge slot) at rest, the real piece on hover. */
const VERTEX_MARKER_RADIUS = 0.14;
const VERTEX_GLOW_RADIUS = 0.36;
const TARGET_DISABLED_ALPHA = 0.2;
/** A hovered spot previews the piece see-through, so it never reads as already built. */
const TARGET_PREVIEW_ALPHA = 0.5;

/** The terrain whose icon marks each resource's harbor. */
const RESOURCE_TERRAIN: Readonly<Record<ResourceType, TerrainType>> = {
  brick: "hills",
  sheep: "pasture",
  stone: "mountains",
  tree: "forest",
  wheat: "fields",
};

const STATIC_ART_PATHS = [
  TERRAIN_GROUND_ATLAS_ASSET_PATH,
  ...Object.values(TERRAIN_FEATURE_ASSET_PATHS),
  ...Object.values(TERRAIN_ICON_ASSET_PATHS),
  PORT_BOAT_ASSET_PATH,
  PORT_WALKWAY_ASSET_PATH,
];
const DYNAMIC_ART_PATHS = [
  ROBBER_ASSET_PATH,
  ROAD_TEXTURE_ASSET_PATH,
  ...Object.values(BOARD_PIECE_ART_PATHS),
];

const imagePromises = new Map<string, Promise<HTMLImageElement | null>>();
const loadedImages = new Map<string, HTMLImageElement>();

export const BoardCanvas = memo(function BoardCanvas({
  board,
  boardLayout,
  playerThemes,
  renderScale,
  targets,
}: BoardCanvasProps) {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  for (const path of [
    TERRAIN_GROUND_ATLAS_ASSET_PATH,
    ...Object.values(TERRAIN_FEATURE_ASSET_PATHS),
  ]) {
    preload(path, { as: "image", fetchPriority: "high" });
  }
  for (const path of [...STATIC_ART_PATHS, ...DYNAMIC_ART_PATHS]) {
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

  // Before the redraw below, so a draw always paints the committed scene.
  useLayoutEffect(() => {
    sceneRef.current = scene;
  });

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
  await drawWhileImagesLoad(STATIC_ART_PATHS, isCancelled, (images) => {
    const context = prepareCanvas(canvas, scene.renderScale);
    if (!context) {
      return;
    }

    const palette = getBoardPalette(canvas);
    drawTerrain(context, scene, images, palette);
    drawPorts(context, scene, images, palette);
  });
}

async function renderDynamicScene(
  canvas: HTMLCanvasElement,
  scene: DynamicScene,
  isCancelled: () => boolean,
) {
  await drawWhileImagesLoad(DYNAMIC_ART_PATHS, isCancelled, (images) => {
    const context = prepareCanvas(canvas, scene.renderScale);
    if (!context) {
      return;
    }

    const palette = getBoardPalette(canvas);
    drawRoads(context, scene, images, palette);
    drawBuildings(context, scene, images, palette);
    drawRobber(context, scene, images.get(ROBBER_ASSET_PATH) ?? null, palette);
    drawTargets(context, scene, images, palette);
  });
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
    foam: color("board-foam"),
    highlight: color("board-highlight"),
    ocean: color("board-ocean"),
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
    shallows: color("board-shallows"),
    target: color("board-target"),
    window: color("board-window"),
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
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  const { tileRadius } = scene.boardLayout;
  const tiles = scene.tiles
    .map((tile) => ({
      point: getTilePoint(scene.boardLayout, tile),
      tile,
    }))
    .sort((first, second) => first.point.y - second.point.y);

  drawIsland(
    context,
    tiles.map(({ point }) => point),
    tileRadius,
    palette,
  );

  const ground = images.get(TERRAIN_GROUND_ATLAS_ASSET_PATH) ?? null;
  for (const { point, tile } of tiles) {
    drawTile(
      context,
      point,
      tileRadius,
      tile.terrain,
      ground,
      images.get(TERRAIN_FEATURE_ASSET_PATHS[tile.terrain]) ?? null,
      palette,
    );
  }

  for (const { point, tile } of tiles) {
    if (tile.numberToken !== null) {
      drawNumberToken(context, tile.numberToken, point, tileRadius, palette);
    }
  }
}

/**
 * Foam, shallows and a sand beach around the island. Each ring is every tile's
 * hexagon grown by the same amount, so together they trace the coastline.
 */
function drawIsland(
  context: CanvasRenderingContext2D,
  points: readonly PixelCoordinate[],
  tileRadius: number,
  palette: BoardPalette,
) {
  const rings = [
    { color: mixColor(palette.ocean, palette.foam, 0.78), scale: 1.33 },
    { color: palette.shallows, scale: 1.28 },
    { color: palette.earth, scale: 1.17 },
    { color: palette.sand, scale: 1.14 },
  ];

  for (const { color, scale } of rings) {
    context.fillStyle = color;
    for (const point of points) {
      createRoundedHexagonPath(context, point, tileRadius * scale, tileRadius * 0.3, 0);
      context.fill();
    }
  }
}

/**
 * One terrain tile: the terrain's flat color with its ground texture faded over
 * it, the terrain's feature at the same size and spot on every tile, and one frame
 * shared by every tile. The flat color carries the terrain; the texture only adds
 * warmth, so it stays quiet behind the number token.
 */
function drawTile(
  context: CanvasRenderingContext2D,
  point: PixelCoordinate,
  tileRadius: number,
  terrain: TerrainType,
  ground: HTMLImageElement | null,
  feature: HTMLImageElement | null,
  palette: BoardPalette,
) {
  const radius = tileRadius * (1 - TILE_GAP);

  context.save();
  createRoundedHexagonPath(context, point, radius, 6, 0);
  context.clip();
  context.fillStyle = palette.terrain[terrain];
  context.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  if (ground) {
    const frame = TERRAIN_ATLAS.frames[terrain];
    const size = radius * 2.04;
    context.globalAlpha = GROUND_TEXTURE_OPACITY;
    context.drawImage(
      ground,
      frame.column * TERRAIN_ATLAS.frameSize,
      frame.row * TERRAIN_ATLAS.frameSize,
      TERRAIN_ATLAS.frameSize,
      TERRAIN_ATLAS.frameSize,
      point.x - size / 2,
      point.y - size / 2,
      size,
      size,
    );
    context.globalAlpha = 1;
  }
  // A raised-tile bevel, the same on every tile: lit along the top edges,
  // shaded along the bottom ones.
  const bevel = context.createLinearGradient(point.x, point.y - radius, point.x, point.y + radius);
  bevel.addColorStop(0, withAlpha(palette.highlight, 0.7));
  bevel.addColorStop(0.45, withAlpha(palette.highlight, 0));
  bevel.addColorStop(0.55, withAlpha(palette.pieceShadow, 0));
  bevel.addColorStop(1, withAlpha(palette.pieceShadow, 0.5));
  createRoundedHexagonPath(context, point, radius, 6, 0);
  context.lineWidth = tileRadius * TILE_BEVEL * 2;
  context.strokeStyle = bevel;
  context.stroke();
  context.restore();

  createRoundedHexagonPath(context, point, radius, 6, 0);
  context.lineWidth = 1.5;
  context.strokeStyle = withAlpha(palette.pieceShadow, 0.35);
  context.stroke();

  if (feature) {
    const width = tileRadius * TERRAIN_FEATURE_WIDTH;
    const height = (width * feature.naturalHeight) / feature.naturalWidth;
    context.drawImage(
      feature,
      point.x - width / 2,
      point.y + tileRadius * TERRAIN_FEATURE_OFFSET_Y - height / 2,
      width,
      height,
    );
  }
}

function drawNumberToken(
  context: CanvasRenderingContext2D,
  number: NumberToken,
  tilePoint: PixelCoordinate,
  tileRadius: number,
  palette: BoardPalette,
) {
  const point = { x: tilePoint.x, y: tilePoint.y + tileRadius * TOKEN_OFFSET_Y };
  const radius = tileRadius * TOKEN_RADIUS;
  const isHot = number === 6 || number === 8;
  const ink = isHot ? palette.tokenHot : palette.tokenInk;

  context.save();
  context.shadowBlur = 8;
  context.shadowColor = palette.shadow;
  context.shadowOffsetY = 3;
  createRoundedHexagonPath(context, point, radius, 7, 0);
  context.fillStyle = palette.tokenEdge;
  context.fill();
  context.restore();
  // The same dark keyline as the pieces keeps the pale token crisp on pale tiles.
  createRoundedHexagonPath(context, point, radius + 1.5, 7, 0);
  context.lineWidth = 3;
  context.strokeStyle = withAlpha(palette.pieceShadow, 0.85);
  context.stroke();

  createRoundedHexagonPath(context, point, radius - 2, 6, 0);
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
  context.font = `900 ${Math.round(radius * 1.02)}px ui-rounded, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), point.x, point.y - radius * 0.1);

  const pips = NUMBER_TOKEN_PIPS[number];
  const pipGap = radius * 0.24;
  const firstPipX = point.x - ((pips - 1) * pipGap) / 2;
  for (let index = 0; index < pips; index += 1) {
    context.beginPath();
    context.arc(firstPipX + index * pipGap, point.y + radius * 0.52, radius * 0.1, 0, Math.PI * 2);
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

  const walkway = images.get(PORT_WALKWAY_ASSET_PATH) ?? null;
  for (const { placement } of ports) {
    for (const dock of placement.docks) {
      drawDock(context, dock.start, dock.end, scene.boardLayout.tileRadius, walkway);
    }
  }

  for (const { placement, port } of ports) {
    drawPort(
      context,
      placement,
      port.trade,
      images.get(PORT_BOAT_ASSET_PATH) ?? null,
      port.trade === "any"
        ? null
        : (images.get(TERRAIN_ICON_ASSET_PATHS[RESOURCE_TERRAIN[port.trade]]) ?? null),
      palette,
    );
  }
}

/** A wooden pier from a harbor corner out to its ship. */
function drawDock(
  context: CanvasRenderingContext2D,
  start: PixelCoordinate,
  end: PixelCoordinate,
  tileRadius: number,
  walkway: HTMLImageElement | null,
) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (!walkway || length < 4) {
    return;
  }

  const width = tileRadius * PORT_WALKWAY_WIDTH;
  context.save();
  context.translate((start.x + end.x) / 2, (start.y + end.y) / 2);
  context.rotate(Math.atan2(end.y - start.y, end.x - start.x));
  context.drawImage(walkway, -length / 2, -width / 2, length, width);
  context.restore();
}

/** The harbor ship, with its trade printed on the sail: the resource (or "?") and the rate. */
function drawPort(
  context: CanvasRenderingContext2D,
  placement: PortPlacement,
  trade: "any" | ResourceType,
  shipImage: HTMLImageElement | null,
  resourceIcon: HTMLImageElement | null,
  palette: BoardPalette,
) {
  const { height, width } = PORT_BOAT_RENDER_SIZE;
  const left = placement.x - width / 2;
  const top = placement.y - height / 2;

  if (shipImage) {
    context.save();
    context.shadowBlur = 6;
    context.shadowColor = withAlpha(palette.pieceShadow, 0.3);
    context.shadowOffsetY = 4;
    context.drawImage(shipImage, left, top, width, height);
    context.restore();
  }

  const sailX = left + width * PORT_BOAT_SAIL.centerX;
  const sailY = top + height * PORT_BOAT_SAIL.centerY;
  const sailWidth = width * PORT_BOAT_SAIL.width;
  const sailHeight = height * PORT_BOAT_SAIL.height;
  const markX = sailX - sailWidth * 0.22;
  const markSize = Math.min(sailHeight * 0.82, sailWidth * 0.42);

  context.save();
  context.fillStyle = palette.plaqueInk;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (trade === "any") {
    context.font = `900 ${Math.round(sailHeight * 0.74)}px ui-rounded, system-ui, sans-serif`;
    context.fillText("?", markX, sailY + 1);
  } else if (resourceIcon) {
    context.drawImage(resourceIcon, markX - markSize / 2, sailY - markSize / 2, markSize, markSize);
  }
  context.font = `900 ${Math.round(sailHeight * 0.46)}px ui-rounded, system-ui, sans-serif`;
  context.fillText(trade === "any" ? "3:1" : "2:1", sailX + sailWidth * 0.2, sailY + 1);
  context.restore();
}

/**
 * Roads are drawn in passes (every outline, then every painted fill), so a
 * player's roads that meet at a corner join into one continuous path. A road end
 * with no road of the same player beyond it stops short of the corner, so rival
 * roads that share a corner never overlap.
 */
function drawRoads(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  const { tileRadius, topology } = scene.boardLayout;
  const roadsAtCorner = new Map<string, number>();
  for (const road of scene.roads) {
    for (const vertexKey of topology.edgeVertices[road.edgeKey] ?? []) {
      const key = `${road.playerId}:${vertexKey}`;
      roadsAtCorner.set(key, (roadsAtCorner.get(key) ?? 0) + 1);
    }
  }

  const segments = scene.roads.flatMap((road) => {
    const [startKey, endKey] = topology.edgeVertices[road.edgeKey] ?? [];
    const start = startKey ? getVertexPoint(scene.boardLayout, startKey) : null;
    const end = endKey ? getVertexPoint(scene.boardLayout, endKey) : null;
    if (!startKey || !endKey || !start || !end) {
      return [];
    }

    const joins = (vertexKey: string) =>
      (roadsAtCorner.get(`${road.playerId}:${vertexKey}`) ?? 0) > 1;
    return [
      {
        color: getPlayerTint(scene, road.playerId, palette),
        ...trimRoadEnds(start, end, tileRadius * ROAD_END_GAP, joins(startKey), joins(endKey)),
      },
    ];
  });

  drawRoadSegments(
    context,
    segments,
    tileRadius,
    images.get(ROAD_TEXTURE_ASSET_PATH) ?? null,
    palette,
    getPlacedShadow(palette),
  );
}

interface RoadSegment extends RoadEnds {
  color: string;
}

/**
 * Raised wooden roads, drawn in passes (every outline, then every side face,
 * then every top face) so roads that meet at a corner join into one path.
 */
function drawRoadSegments(
  context: CanvasRenderingContext2D,
  segments: readonly RoadSegment[],
  tileRadius: number,
  texture: HTMLImageElement | null,
  palette: BoardPalette,
  shadow: PieceShadow,
) {
  const width = tileRadius * ROAD_WIDTH;
  const depth = tileRadius * ROAD_DEPTH;
  const outline = tileRadius * ROAD_OUTLINE;

  context.save();
  context.lineCap = "round";
  // One shadow under the whole bar; the outline sweep below would stack it.
  context.save();
  applyShadow(context, shadow);
  context.lineWidth = width + outline * 2;
  context.strokeStyle = palette.pieceShadow;
  for (const segment of segments) {
    traceRoad(context, segment, depth);
    context.stroke();
  }
  context.restore();

  context.lineWidth = width + outline * 2;
  context.strokeStyle = palette.pieceShadow;
  for (const segment of segments) {
    sweepRoad(context, segment, depth);
  }
  context.lineWidth = width;
  for (const segment of segments) {
    context.strokeStyle = mixColor(segment.color, palette.pieceShadow, 0.38);
    sweepRoad(context, segment, depth);
  }
  context.restore();

  for (const segment of segments) {
    drawRoadTop(context, segment, texture, tileRadius, palette);
  }
}

/** Strokes a road from its top face down to its base, sweeping out the raised bar. */
function sweepRoad(context: CanvasRenderingContext2D, road: RoadEnds, depth: number) {
  for (const step of [0, 0.5, 1]) {
    traceRoad(context, road, depth * step);
    context.stroke();
  }
}

/** Pulls each road end that does not join another road back from its corner by `gap`. */
function trimRoadEnds(
  start: PixelCoordinate,
  end: PixelCoordinate,
  gap: number,
  startJoins: boolean,
  endJoins: boolean,
): RoadEnds {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const ux = (end.x - start.x) / length;
  const uy = (end.y - start.y) / length;
  const startInset = startJoins ? 0 : gap;
  const endInset = endJoins ? 0 : gap;
  return {
    end: { x: end.x - ux * endInset, y: end.y - uy * endInset },
    start: { x: start.x + ux * startInset, y: start.y + uy * startInset },
  };
}

interface RoadEnds {
  end: PixelCoordinate;
  start: PixelCoordinate;
}

/** The two corners an edge runs between, from its midpoint and angle. */
function getRoadEnds(center: PixelCoordinate, angle: number, tileRadius: number): RoadEnds {
  const half = tileRadius / 2;
  const dx = Math.cos((angle * Math.PI) / 180) * half;
  const dy = Math.sin((angle * Math.PI) / 180) * half;
  return {
    end: { x: center.x + dx, y: center.y + dy },
    start: { x: center.x - dx, y: center.y - dy },
  };
}

function traceRoad(context: CanvasRenderingContext2D, { end, start }: RoadEnds, drop = 0) {
  context.beginPath();
  context.moveTo(start.x, start.y + drop);
  context.lineTo(end.x, end.y + drop);
}

/**
 * A road's top face: painted wood in the seat color with a lit upper rim and
 * plank seams laid across it. The seams run across the road at every angle, so
 * nothing in the shading turns with it.
 */
function drawRoadTop(
  context: CanvasRenderingContext2D,
  road: RoadSegment,
  texture: HTMLImageElement | null,
  tileRadius: number,
  palette: BoardPalette,
) {
  const width = tileRadius * ROAD_WIDTH;
  const length = Math.hypot(road.end.x - road.start.x, road.end.y - road.start.y);
  context.save();
  context.translate(road.start.x, road.start.y);
  context.rotate(Math.atan2(road.end.y - road.start.y, road.end.x - road.start.x));
  createRoundedRectPath(context, -width / 2, -width / 2, length + width, width, width / 2);
  context.fillStyle = road.color;
  context.fill();
  context.clip();
  if (texture) {
    // The middle band of the painted wood: its grain, without its top-lit edge.
    const art = getPlayerPieceArt(texture, ROAD_TEXTURE_ASSET_PATH, road.color);
    const band = art.height * 0.4;
    const tileLength = (art.width / band) * width;
    context.globalAlpha *= 0.55;
    for (let x = -width / 2; x < length + width / 2; x += tileLength) {
      context.drawImage(
        art,
        0,
        art.height * 0.3,
        art.width,
        band,
        x,
        -width / 2,
        tileLength,
        width,
      );
    }
    context.globalAlpha /= 0.55;
  }

  context.strokeStyle = withAlpha(mixColor(road.color, palette.pieceShadow, 0.5), 0.85);
  context.lineWidth = Math.max(1, width * 0.13);
  const plank = width * 0.9;
  for (let x = plank * 0.75; x < length - plank * 0.25; x += plank) {
    context.beginPath();
    context.moveTo(x, -width / 2);
    context.lineTo(x, width / 2);
    context.stroke();
  }
  context.restore();
}

function drawBuildings(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  for (const building of scene.buildings) {
    const point = getVertexPoint(scene.boardLayout, building.vertexKey);
    const path = BOARD_PIECE_ART_PATHS[building.kind];
    const art = images.get(path) ?? null;
    if (!point || !art) {
      continue;
    }

    context.save();
    context.translate(point.x, point.y);
    drawBuildingArt(
      context,
      getPlayerPieceArt(art, path, getPlayerTint(scene, building.playerId, palette)),
      scene.boardLayout.tileRadius *
        (building.kind === "city" ? CITY_ART_SIZE : SETTLEMENT_ART_SIZE),
      getPlacedShadow(palette),
    );
    context.restore();
  }
}

/** A building centered on the current origin. */
function drawBuildingArt(
  context: CanvasRenderingContext2D,
  art: HTMLCanvasElement,
  size: number,
  shadow: PieceShadow,
) {
  context.save();
  applyShadow(context, shadow);
  context.drawImage(art, -size / 2, -size / 2, size, size);
  context.restore();
}

function getPlayerTint(scene: DynamicScene, playerId: string, palette: BoardPalette): string {
  return palette.players[scene.playerThemes.get(playerId) ?? "red"];
}

/** A soft drop shadow under a piece. */
interface PieceShadow {
  blur: number;
  color: string;
  offsetY: number;
}

function getPlacedShadow(palette: BoardPalette): PieceShadow {
  return { blur: 7, color: withAlpha(palette.pieceShadow, 0.55), offsetY: 4 };
}

function applyShadow(context: CanvasRenderingContext2D, shadow: PieceShadow) {
  context.shadowBlur = shadow.blur;
  context.shadowColor = shadow.color;
  context.shadowOffsetY = shadow.offsetY;
}

/**
 * The robber stands on the tile's art, over the resource it blocks, and leaves
 * the number below it readable; on a tile without a number it stands in the middle.
 */
function getRobberPoint(
  tilePoint: PixelCoordinate,
  tileRadius: number,
  hasNumber: boolean,
): PixelCoordinate {
  return {
    x: tilePoint.x,
    y: tilePoint.y + tileRadius * (hasNumber ? ROBBER_OFFSET_Y : ROBBER_OFFSET_Y_NO_NUMBER),
  };
}

function tileHasNumber(scene: DynamicScene, tilePoint: PixelCoordinate): boolean {
  const tile = scene.tiles.find((candidate) => {
    const point = getTilePoint(scene.boardLayout, candidate);
    return Math.abs(point.x - tilePoint.x) < 1 && Math.abs(point.y - tilePoint.y) < 1;
  });
  return tile?.numberToken != null;
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

  const { tileRadius } = scene.boardLayout;
  const point = getRobberPoint(
    getTilePoint(scene.boardLayout, tile),
    tileRadius,
    tile.numberToken !== null,
  );
  const size = tileRadius * ROBBER_SIZE;
  context.save();
  context.shadowBlur = 5;
  context.shadowColor = withAlpha(palette.pieceShadow, 0.42);
  context.shadowOffsetY = 4;
  context.drawImage(image, point.x - size / 2, point.y - size / 2, size, size);
  context.restore();
}

function drawTargets(
  context: CanvasRenderingContext2D,
  scene: DynamicScene,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  const { tileRadius } = scene.boardLayout;
  // The hovered target paints last so its glow and full-size preview are never
  // clipped by a neighbouring marker.
  const ordered = [...scene.targets].sort(
    (first, second) => Number(Boolean(first.highlighted)) - Number(Boolean(second.highlighted)),
  );

  for (const target of ordered) {
    if (target.asset === "robber") {
      drawRobberTarget(
        context,
        target,
        tileRadius,
        tileHasNumber(scene, target.point),
        images.get(ROBBER_ASSET_PATH) ?? null,
        palette,
      );
    } else if (target.asset === "road") {
      drawRoadTarget(
        context,
        target,
        tileRadius,
        images.get(ROAD_TEXTURE_ASSET_PATH) ?? null,
        palette,
      );
    } else {
      drawVertexTarget(context, target, tileRadius, images, palette);
    }
  }
}

/** Legal settlement/city corner: a marker ring at rest, the piece itself on hover. */
function drawVertexTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  tileRadius: number,
  images: ReadonlyMap<string, HTMLImageElement | null>,
  palette: BoardPalette,
) {
  const accent = palette.players[target.theme];

  context.save();
  context.translate(target.point.x, target.point.y);
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;

  if (target.highlighted) {
    drawTargetGlow(context, accent, () => {
      context.beginPath();
      context.arc(0, 0, tileRadius * VERTEX_GLOW_RADIUS, 0, Math.PI * 2);
    });
    const path = BOARD_PIECE_ART_PATHS[target.asset === "city" ? "city" : "settlement"];
    const art = images.get(path) ?? null;
    if (art) {
      context.globalAlpha *= TARGET_PREVIEW_ALPHA;
      drawBuildingArt(
        context,
        getPlayerPieceArt(art, path, accent),
        tileRadius * (target.asset === "city" ? CITY_ART_SIZE : SETTLEMENT_ART_SIZE),
        getPlacedShadow(palette),
      );
    }
  } else {
    drawMarkerRing(context, palette, () => {
      context.beginPath();
      context.arc(0, 0, tileRadius * VERTEX_MARKER_RADIUS, 0, Math.PI * 2);
    });
  }

  context.restore();
}

/** Legal road edge: a slot along the edge at rest, the road itself on hover. */
function drawRoadTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  tileRadius: number,
  texture: HTMLImageElement | null,
  palette: BoardPalette,
) {
  const accent = palette.players[target.theme];
  const road = getRoadEnds(target.point, target.angle, tileRadius);

  context.save();
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;
  context.lineCap = "round";

  if (target.highlighted) {
    context.save();
    context.shadowBlur = 22;
    context.shadowColor = withAlpha(accent, 0.85);
    traceRoad(context, road);
    context.lineWidth = tileRadius * ROAD_WIDTH;
    context.strokeStyle = withAlpha(accent, 0.3);
    context.stroke();
    context.restore();
    drawSeeThrough(context, TARGET_PREVIEW_ALPHA, (layer) =>
      drawRoadSegments(
        layer,
        [{ ...road, color: accent }],
        tileRadius,
        texture,
        palette,
        getPlacedShadow(palette),
      ),
    );
  } else {
    // A soft, see-through bar a little shorter than the edge, so the corner
    // rings stay clear; the target's CSS ripple makes it pulse.
    context.save();
    context.translate(target.point.x, target.point.y);
    context.rotate((target.angle * Math.PI) / 180);
    const length = tileRadius * 0.62;
    const width = tileRadius * ROAD_WIDTH;
    createRoundedRectPath(
      context,
      -length / 2 - width / 2,
      -width / 2,
      length + width,
      width,
      width / 2,
    );
    context.fillStyle = withAlpha(palette.target, 0.55);
    context.fill();
    context.restore();
  }

  context.restore();
}

function drawRobberTarget(
  context: CanvasRenderingContext2D,
  target: BoardCanvasTarget,
  tileRadius: number,
  hasNumber: boolean,
  image: HTMLImageElement | null,
  palette: BoardPalette,
) {
  const point = getRobberPoint(target.point, tileRadius, hasNumber);
  const size = tileRadius * ROBBER_SIZE;

  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = target.disabled ? TARGET_DISABLED_ALPHA : 1;

  if (target.highlighted) {
    drawTargetGlow(context, palette.robberGlow, () => {
      context.beginPath();
      context.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    });

    if (image) {
      context.globalAlpha *= 0.94;
      context.shadowBlur = 12;
      context.shadowColor = withAlpha(palette.robberGlow, 0.72);
      context.drawImage(image, -size / 2, -size / 2, size, size);
    }
  } else {
    drawMarkerRing(context, palette, () => {
      context.beginPath();
      context.arc(0, 0, tileRadius * VERTEX_MARKER_RADIUS * 0.6, 0, Math.PI * 2);
    });
  }

  context.restore();
}

/**
 * The resting affordance: a white ring with a firm dark keyline, so every legal
 * spot stands out on the pale sand seams as well as on the dark forest tiles.
 */
function drawMarkerRing(
  context: CanvasRenderingContext2D,
  palette: BoardPalette,
  createPath: () => void,
) {
  context.save();
  createPath();
  context.fillStyle = withAlpha(palette.target, 0.3);
  context.fill();
  context.lineWidth = 5.5;
  context.strokeStyle = withAlpha(palette.pieceShadow, 0.78);
  context.stroke();
  context.lineWidth = 2.6;
  context.strokeStyle = palette.target;
  context.stroke();
  context.restore();
}

let seeThroughLayer: HTMLCanvasElement | null = null;

/**
 * Draws a preview at full strength on a scratch layer, then lays the whole layer
 * down at `alpha`, so the preview's overlapping parts do not stack into a solid piece.
 */
function drawSeeThrough(
  context: CanvasRenderingContext2D,
  alpha: number,
  draw: (layer: CanvasRenderingContext2D) => void,
) {
  const { height, width } = context.canvas;
  seeThroughLayer ??= document.createElement("canvas");
  if (seeThroughLayer.width !== width || seeThroughLayer.height !== height) {
    seeThroughLayer.width = width;
    seeThroughLayer.height = height;
  }
  const layer = seeThroughLayer.getContext("2d");
  if (!layer) {
    return;
  }

  layer.resetTransform();
  layer.clearRect(0, 0, width, height);
  layer.setTransform(context.getTransform());
  draw(layer);
  context.save();
  context.resetTransform();
  context.globalAlpha *= alpha;
  context.drawImage(seeThroughLayer, 0, 0);
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
