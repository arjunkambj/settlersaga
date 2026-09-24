import { AVAILABLE_GAME_MAPS, axialToPixel, createBoard, type GameMapId } from "@settersaga/game";
import { useId } from "react";

import { TERRAIN_ATLAS, TERRAIN_ATLAS_ASSET_PATH } from "@/constants/game/board-assets";
import { cn } from "@/lib/utils";

const TILE_RADIUS = 100;
const RIM_WIDTH = 7;
const TEXTURE_SIZE = TILE_RADIUS * 2;

// Every island is drawn at the same tile size inside one shared frame, so the bigger tables
// read as bigger islands.
const PREVIEW_TILES = new Map(
  AVAILABLE_GAME_MAPS.map((map) => [
    map.id,
    createBoard(map.id, `lobby-preview:${map.id}`).tiles.map((tile) => ({
      frame: TERRAIN_ATLAS.frames[tile.terrain],
      id: tile.id,
      point: axialToPixel(tile, TILE_RADIUS),
    })),
  ]),
);
const PREVIEW_EXTENT = Math.max(
  ...[...PREVIEW_TILES.values()]
    .flat()
    .flatMap(({ point }) => [
      Math.abs(point.x) + TILE_RADIUS + RIM_WIDTH,
      Math.abs(point.y) + TILE_RADIUS + RIM_WIDTH,
    ]),
);
const VIEW_BOX = `${-PREVIEW_EXTENT} ${-PREVIEW_EXTENT} ${PREVIEW_EXTENT * 2} ${PREVIEW_EXTENT * 2}`;
const TILE_POINTS = hexagonPoints(TILE_RADIUS);
const RIM_POINTS = hexagonPoints(TILE_RADIUS + RIM_WIDTH);

export function MapPreview({ className, mapId }: { className?: string; mapId: GameMapId }) {
  const clipId = `${useId()}-hex`;

  return (
    <svg aria-hidden="true" className={cn("block", className)} viewBox={VIEW_BOX}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={TILE_POINTS} />
        </clipPath>
      </defs>
      {PREVIEW_TILES.get(mapId)?.map((tile) => (
        <polygon
          fill="var(--board-sand)"
          key={`rim-${tile.id}`}
          points={RIM_POINTS}
          transform={`translate(${tile.point.x} ${tile.point.y})`}
        />
      ))}
      {PREVIEW_TILES.get(mapId)?.map((tile) => (
        <g key={tile.id} transform={`translate(${tile.point.x} ${tile.point.y})`}>
          <image
            clipPath={`url(#${clipId})`}
            height={TEXTURE_SIZE * TERRAIN_ATLAS.rows}
            href={TERRAIN_ATLAS_ASSET_PATH}
            preserveAspectRatio="none"
            width={TEXTURE_SIZE * TERRAIN_ATLAS.columns}
            x={-TEXTURE_SIZE / 2 - tile.frame.column * TEXTURE_SIZE}
            y={-TEXTURE_SIZE / 2 - tile.frame.row * TEXTURE_SIZE}
          />
        </g>
      ))}
    </svg>
  );
}

// Rounded because Math.cos/sin may differ in the last digit between the server and the
// browser, which would break hydration.
function hexagonPoints(radius: number) {
  return Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 3) * corner;
    return `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}
