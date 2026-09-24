import {
  getTileId,
  type GameCommand,
  type PixelCoordinate,
  type PlayerColor,
  type PlayerGameView,
} from "@settersaga/game";

import { TERRAIN_LABELS } from "@/constants/game/labels";

import { getEdgePlacement, getTilePoint, getVertexPoint, type BoardLayout } from "./board-layout";

export type BoardBuildMode = "city" | "road" | "settlement" | null;
export type BoardTargetMode = Exclude<BoardBuildMode, null> | "robber";

type BoardTile = PlayerGameView["board"]["tiles"][number];

interface BoardCanvasTargetBase<TAsset extends BoardTargetMode, TCommand extends GameCommand> {
  readonly angle: number;
  readonly asset: TAsset;
  readonly command: TCommand;
  readonly id: string;
  readonly label: string;
  readonly point: Readonly<PixelCoordinate>;
  readonly successMessage: string;
  readonly theme: PlayerColor;
}

export type BoardCanvasTargetModel =
  | BoardCanvasTargetBase<"city", Extract<GameCommand, { kind: "build_city" }>>
  | BoardCanvasTargetBase<"road", Extract<GameCommand, { kind: "place_road" }>>
  | BoardCanvasTargetBase<"robber", Extract<GameCommand, { kind: "move_robber" }>>
  | BoardCanvasTargetBase<"settlement", Extract<GameCommand, { kind: "place_settlement" }>>;

export function createBoardCanvasTargetModels({
  game,
  layout,
  mode,
  viewerTheme,
}: {
  game: PlayerGameView;
  layout: BoardLayout;
  mode: BoardTargetMode | null;
  viewerTheme: PlayerColor;
}): readonly BoardCanvasTargetModel[] {
  switch (mode) {
    case "city":
    case "settlement":
      return createVertexTargets(mode, game, layout, viewerTheme);
    case "road":
      return createRoadTargets(game, layout, viewerTheme);
    case "robber":
      return createRobberTargets(game, layout, viewerTheme);
    case null:
      return [];
  }
}

export function resolveBoardTargetMode(
  game: PlayerGameView,
  buildMode: BoardBuildMode,
): BoardTargetMode | null {
  if (!game.legalActions.isRequiredActor) {
    return null;
  }

  switch (game.phase.kind) {
    case "setup_settlement":
      return "settlement";
    case "setup_road":
    case "road_building":
      return "road";
    case "move_robber":
      return "robber";
    default:
      return buildMode;
  }
}

export function findNearestBoardTarget<T extends Pick<BoardCanvasTargetModel, "point">>(
  targets: readonly T[],
  point: Readonly<PixelCoordinate>,
): T | null {
  return targets.reduce<T | null>((nearest, target) => {
    if (!nearest) {
      return target;
    }

    return distanceSquared(target.point, point) < distanceSquared(nearest.point, point)
      ? target
      : nearest;
  }, null);
}

export function mapClientPointToBoard(
  point: Readonly<PixelCoordinate>,
  bounds: Readonly<{ height: number; left: number; top: number; width: number }>,
  boardSize: Readonly<{ height: number; width: number }>,
): PixelCoordinate | null {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return {
    x: ((point.x - bounds.left) / bounds.width) * boardSize.width,
    y: ((point.y - bounds.top) / bounds.height) * boardSize.height,
  };
}

function createVertexTargets(
  kind: "city" | "settlement",
  game: PlayerGameView,
  layout: BoardLayout,
  theme: PlayerColor,
): readonly BoardCanvasTargetModel[] {
  const tilesByTopologyId = indexTilesByTopologyId(game.board.tiles);
  const vertexKeys =
    kind === "city" ? game.legalActions.cityVertexKeys : game.legalActions.settlementVertexKeys;
  const targets = vertexKeys.flatMap((vertexKey) => {
    const point = getVertexPoint(layout, vertexKey);
    return point ? [{ point, vertexKey }] : [];
  });

  return targets.map(({ point, vertexKey }, index) => {
    const terrainContext = getAdjacentTerrainContext(
      layout.topology.vertexTileIds[vertexKey],
      tilesByTopologyId,
    );
    const label = getTargetLabel(kind, terrainContext, index, targets.length);
    return kind === "city"
      ? {
          angle: 0,
          asset: "city",
          command: { kind: "build_city", vertexKey },
          id: `city:${vertexKey}`,
          label,
          point,
          successMessage: "City completed.",
          theme,
        }
      : {
          angle: 0,
          asset: "settlement",
          command: { kind: "place_settlement", vertexKey },
          id: `settlement:${vertexKey}`,
          label,
          point,
          successMessage: "Settlement placed.",
          theme,
        };
  });
}

function createRoadTargets(
  game: PlayerGameView,
  layout: BoardLayout,
  theme: PlayerColor,
): readonly BoardCanvasTargetModel[] {
  const tilesByTopologyId = indexTilesByTopologyId(game.board.tiles);
  const targets = game.legalActions.roadEdgeKeys.flatMap((edgeKey) => {
    const placement = getEdgePlacement(layout, edgeKey);
    return placement ? [{ edgeKey, placement }] : [];
  });

  return targets.map(({ edgeKey, placement }, index) => ({
    angle: placement.angle,
    asset: "road",
    command: { edgeKey, kind: "place_road" },
    id: `road:${edgeKey}`,
    label: getTargetLabel(
      "road",
      getAdjacentTerrainContext(layout.topology.edgeTileIds[edgeKey], tilesByTopologyId),
      index,
      targets.length,
    ),
    point: { x: placement.x, y: placement.y },
    successMessage: "Road placed.",
    theme,
  }));
}

function createRobberTargets(
  game: PlayerGameView,
  layout: BoardLayout,
  theme: PlayerColor,
): readonly BoardCanvasTargetModel[] {
  const tilesById = new Map(game.board.tiles.map((tile) => [tile.id, tile] as const));
  const tiles = game.legalActions.robberTileIds.flatMap((tileId) => {
    const tile = tilesById.get(tileId);
    return tile ? [tile] : [];
  });

  return tiles.map((tile, index) => ({
    angle: 0,
    asset: "robber",
    command: { kind: "move_robber", tileId: tile.id },
    id: `robber:${tile.id}`,
    label: getTargetLabel("robber", getTerrainContext(tile), index, tiles.length),
    point: getTilePoint(layout, tile),
    successMessage: "Robber moved.",
    theme,
  }));
}

function indexTilesByTopologyId(tiles: readonly BoardTile[]): ReadonlyMap<string, BoardTile> {
  return new Map(tiles.map((tile) => [getTileId(tile), tile] as const));
}

function getAdjacentTerrainContext(
  tileIds: readonly string[] | undefined,
  tilesByTopologyId: ReadonlyMap<string, BoardTile>,
): string {
  const labels = (tileIds ?? []).flatMap((tileId) => {
    const tile = tilesByTopologyId.get(tileId);
    return tile ? [getTerrainContext(tile)] : [];
  });

  return formatList(labels);
}

function getTerrainContext(tile: BoardTile): string {
  const terrain = TERRAIN_LABELS[tile.terrain];
  return tile.numberToken === null ? terrain : `${terrain} ${tile.numberToken}`;
}

function formatList(values: readonly string[]): string {
  if (values.length < 2) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function getTargetLabel(
  mode: BoardTargetMode,
  terrainContext: string,
  index: number,
  optionCount: number,
): string {
  return `${getTargetActionLabel(mode, terrainContext)}; option ${index + 1} of ${optionCount}`;
}

function getTargetActionLabel(mode: BoardTargetMode, terrainContext: string): string {
  const adjacentContext = terrainContext ? ` beside ${terrainContext}` : "";

  switch (mode) {
    case "city":
      return `Upgrade settlement to city${adjacentContext}`;
    case "road":
      return `Place road at legal edge${adjacentContext}`;
    case "robber":
      return terrainContext ? `Move robber to ${terrainContext} tile` : "Move robber to legal tile";
    case "settlement":
      return `Place settlement at legal vertex${adjacentContext}`;
  }
}

function distanceSquared(first: Readonly<PixelCoordinate>, second: Readonly<PixelCoordinate>) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}
