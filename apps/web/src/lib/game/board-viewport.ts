interface BoardViewportBounds {
  height: number;
  width: number;
}

export interface BoardViewportRect extends BoardViewportBounds {
  left: number;
  top: number;
}

export interface BoardViewportPoint {
  x: number;
  y: number;
}

export interface BoardViewportState extends BoardViewportPoint {
  scale: number;
}

/** At scale 1 the framed island exactly fits the stage. */
export const DEFAULT_BOARD_VIEWPORT: BoardViewportState = {
  scale: 1,
  x: 0,
  y: 0,
};

export const BOARD_VIEWPORT_SCALE = {
  max: 2.4,
  min: 0.82,
  step: 0.2,
} as const;

const BOARD_VIEWPORT_PAN = {
  fittedX: 0.28,
  fittedY: 0.22,
} as const;

export function clampBoardViewport(
  viewport: BoardViewportState,
  bounds: BoardViewportBounds,
): BoardViewportState {
  const scale = clamp(viewport.scale, BOARD_VIEWPORT_SCALE.min, BOARD_VIEWPORT_SCALE.max);
  const overflow = Math.max(0, scale - 1);
  const fittedProgress = clamp(
    (scale - BOARD_VIEWPORT_SCALE.min) / (1 - BOARD_VIEWPORT_SCALE.min),
    0,
    1,
  );
  const maxX = bounds.width * (BOARD_VIEWPORT_PAN.fittedX * fittedProgress + overflow * 0.5);
  const maxY = bounds.height * (BOARD_VIEWPORT_PAN.fittedY * fittedProgress + overflow * 0.5);

  return {
    scale,
    x: clampOffset(viewport.x, maxX),
    y: clampOffset(viewport.y, maxY),
  };
}

export function panBoardViewport(
  viewport: BoardViewportState,
  delta: BoardViewportPoint,
  bounds: BoardViewportBounds,
): BoardViewportState {
  return clampBoardViewport(
    {
      ...viewport,
      x: viewport.x + delta.x,
      y: viewport.y + delta.y,
    },
    bounds,
  );
}

export function zoomBoardViewport(
  viewport: BoardViewportState,
  nextScale: number,
  focus: BoardViewportPoint,
  bounds: BoardViewportBounds,
): BoardViewportState {
  const scale = clamp(nextScale, BOARD_VIEWPORT_SCALE.min, BOARD_VIEWPORT_SCALE.max);
  const ratio = scale / viewport.scale;

  return clampBoardViewport(
    {
      scale,
      x: focus.x - (focus.x - viewport.x) * ratio,
      y: focus.y - (focus.y - viewport.y) * ratio,
    },
    bounds,
  );
}

export function pinchBoardViewport(
  viewport: BoardViewportState,
  nextScale: number,
  startFocus: BoardViewportPoint,
  currentFocus: BoardViewportPoint,
  bounds: BoardViewportBounds,
): BoardViewportState {
  const scale = clamp(nextScale, BOARD_VIEWPORT_SCALE.min, BOARD_VIEWPORT_SCALE.max);
  const ratio = scale / viewport.scale;

  return clampBoardViewport(
    {
      scale,
      x: currentFocus.x - (startFocus.x - viewport.x) * ratio,
      y: currentFocus.y - (startFocus.y - viewport.y) * ratio,
    },
    bounds,
  );
}

export function getBoardViewportFocus(
  clientPoint: BoardViewportPoint,
  stageBounds: BoardViewportRect,
): BoardViewportPoint {
  return {
    x: clientPoint.x - stageBounds.left - stageBounds.width / 2,
    y: clientPoint.y - stageBounds.top - stageBounds.height / 2,
  };
}

export function normalizeBoardWheelDelta(
  delta: number,
  deltaMode: number,
  pageHeight: number,
  maxMagnitude: number,
): number {
  const normalizedDelta =
    deltaMode === 1 ? delta * 16 : deltaMode === 2 ? delta * Math.max(1, pageHeight) : delta;

  return clamp(normalizedDelta, -maxMagnitude, maxMagnitude);
}

export function getBoardViewportTransform(viewport: BoardViewportState): string {
  return `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampOffset(value: number, max: number): number {
  return max === 0 ? 0 : clamp(value, -max, max);
}
