import { createBoard } from "@colonistsaga/game";

import {
  TERRAIN_ATLAS,
  TERRAIN_ATLAS_ASSET_PATH,
  getTerrainAtlasFrame,
} from "@/constants/game/board-assets";
import { BOARD_CANVAS, createBoardLayout, getTilePoint } from "@/lib/game/board-layout";

import styles from "./asset-sheet.module.css";

const TERRAIN_PREVIEW_BOARD = createBoard("base", "terrain-atlas-browser-preview");
const TERRAIN_PREVIEW_LAYOUT = createBoardLayout(TERRAIN_PREVIEW_BOARD.tiles);
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;

export function TerrainBoardPreview() {
  const textureSize = TERRAIN_PREVIEW_LAYOUT.tileRadius * 2;
  const tiles = TERRAIN_PREVIEW_BOARD.tiles
    .map((tile) => ({ point: getTilePoint(TERRAIN_PREVIEW_LAYOUT, tile), tile }))
    .sort((first, second) => first.point.y - second.point.y);

  return (
    <figure className={styles.terrainBoardFigure}>
      <div className={styles.terrainBoardHeader}>
        <div>
          <h3>Masked board preview</h3>
          <p>Live 19-tile render using production atlas frames and board coordinates.</p>
        </div>
        <span>Actual fit</span>
      </div>

      <div className={styles.terrainBoardViewport} data-testid="terrain-board-preview">
        <svg
          aria-label="Terrain atlas clipped into the base 19-tile board"
          className={styles.terrainBoardSvg}
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
              <g className={styles.terrainPreviewBorder} key={`border-${tile.id}`}>
                <polygon className={styles.terrainPreviewBorderOuter} points={points} />
                <polygon className={styles.terrainPreviewBorderMiddle} points={points} />
                <polygon className={styles.terrainPreviewBorderHighlight} points={points} />
              </g>
            );
          })}

          {tiles.flatMap(({ point, tile }) =>
            tile.numberToken === null
              ? []
              : [
                  <g
                    className={styles.terrainPreviewToken}
                    key={`token-${tile.id}`}
                    transform={`translate(${point.x} ${point.y + TERRAIN_PREVIEW_LAYOUT.tileSize * 0.11 + 2})`}
                  >
                    <circle r="42" />
                    <text dominantBaseline="central" textAnchor="middle">
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
