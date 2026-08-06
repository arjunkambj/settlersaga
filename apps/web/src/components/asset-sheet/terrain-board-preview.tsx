import { createBoard } from "@settersaga/game";

import {
  TERRAIN_ATLAS,
  TERRAIN_ATLAS_ASSET_PATH,
  getTerrainAtlasFrame,
} from "@/constants/game/board-assets";
import { BOARD_CANVAS, createBoardLayout, getTilePoint } from "@/lib/game/board-layout";

const TERRAIN_PREVIEW_BOARD = createBoard("base", "terrain-atlas-browser-preview");
const TERRAIN_PREVIEW_LAYOUT = createBoardLayout(TERRAIN_PREVIEW_BOARD.tiles);
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;

export function TerrainBoardPreview() {
  const textureSize = TERRAIN_PREVIEW_LAYOUT.tileRadius * 2;
  const tiles = TERRAIN_PREVIEW_BOARD.tiles
    .map((tile) => ({ point: getTilePoint(TERRAIN_PREVIEW_LAYOUT, tile), tile }))
    .sort((first, second) => first.point.y - second.point.y);

  return (
    <figure className="mt-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg">Masked board preview</h3>
          <p className="text-xs text-muted-foreground">
            Live 19-tile render using production atlas frames and board coordinates.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500 uppercase tracking-wider whitespace-nowrap">
          Actual fit
        </span>
      </div>

      <div
        className="relative aspect-[10/11] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-[#0876c9] bg-[url('/game-assets/ui/ocean-board-canvas.webp')] bg-cover bg-center shadow-none"
        data-testid="terrain-board-preview"
      >
        <svg
          aria-label="Terrain atlas clipped into the base 19-tile board"
          className="h-full w-full block"
          role="img"
          viewBox={`0 0 ${BOARD_CANVAS.width} ${BOARD_CANVAS.height}`}
        >
          <defs>
            {tiles.map(({ point, tile }) => (
              <clipPath id={`terrain-preview-${tile.id}`} key={tile.id}>
                <polygon
                  points={getFlatTopHexagonPoints(
                    point.x,
                    point.y,
                    TERRAIN_PREVIEW_LAYOUT.tileRadius,
                  )}
                />
              </clipPath>
            ))}
          </defs>

          {tiles.map(({ point, tile }) => {
            const frame = getTerrainAtlasFrame(tile.terrain, tile.id);
            return (
              <image
                clipPath={`url(#terrain-preview-${tile.id})`}
                height={textureSize * TERRAIN_ATLAS.rows}
                href={TERRAIN_ATLAS_ASSET_PATH}
                key={tile.id}
                preserveAspectRatio="none"
                width={textureSize * TERRAIN_ATLAS.columns}
                x={point.x - textureSize / 2 - frame.column * textureSize}
                y={point.y - textureSize / 2 - frame.row * textureSize}
              />
            );
          })}

          {tiles.map(({ point, tile }) => {
            const points = getFlatTopHexagonPoints(
              point.x,
              point.y,
              TERRAIN_PREVIEW_LAYOUT.tileRadius - 1,
            );
            return (
              <g className="fill-none stroke-round" key={`border-${tile.id}`}>
                <polygon className="stroke-[#100707]/90 stroke-[8px]" points={points} />
                <polygon className="stroke-[#e5a72e]/95 stroke-[4.5px]" points={points} />
                <polygon className="stroke-[#ffe082]/80 stroke-[1.5px]" points={points} />
              </g>
            );
          })}

          {tiles.flatMap(({ point, tile }) =>
            tile.numberToken === null
              ? []
              : [
                  <g
                    className="select-none"
                    key={`token-${tile.id}`}
                    transform={`translate(${point.x} ${point.y + TERRAIN_PREVIEW_LAYOUT.tileSize * 0.11 + 2})`}
                  >
                    <circle r="42" fill="#fff4d8" stroke="#cb8f33" strokeWidth="7" />
                    <text
                      dominantBaseline="central"
                      textAnchor="middle"
                      fill="#493547"
                      fontSize="36"
                      fontWeight="950"
                      fontFamily="var(--font-ui)"
                    >
                      {tile.numberToken}
                    </text>
                  </g>,
                ],
          )}
        </svg>
      </div>
    </figure>
  );
}

function getFlatTopHexagonPoints(centerX: number, centerY: number, radius: number) {
  return [
    [centerX + radius, centerY],
    [centerX + radius / 2, centerY + radius * SQRT_THREE_OVER_TWO],
    [centerX - radius / 2, centerY + radius * SQRT_THREE_OVER_TWO],
    [centerX - radius, centerY],
    [centerX - radius / 2, centerY - radius * SQRT_THREE_OVER_TWO],
    [centerX + radius / 2, centerY - radius * SQRT_THREE_OVER_TWO],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}
