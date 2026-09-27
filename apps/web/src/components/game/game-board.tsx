import type { GameCommand, PlayerGameView, ResourceType } from "@settersaga/game";
import recenterIcon from "@iconify-icons/solar/gps-bold";
import zoomInIcon from "@iconify-icons/solar/magnifer-zoom-in-bold";
import zoomOutIcon from "@iconify-icons/solar/magnifer-zoom-out-bold";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import {
  BOARD_CANVAS,
  createBoardLayout,
  getBoardFrame,
  getBoardPlaneStyle,
  getEdgePlacement,
  getPointStyle,
  getPortPlacement,
  type BoardLayout,
} from "@/lib/game/board-layout";
import { BOARD_VIEWPORT_SCALE, DEFAULT_BOARD_VIEWPORT } from "@/lib/game/board-viewport";
import {
  createBoardCanvasTargetModels,
  findNearestBoardTarget,
  mapClientPointToBoard,
  resolveBoardTargetMode,
  type BoardBuildMode,
  type BoardCanvasTargetModel,
  type BoardTargetMode,
} from "@/lib/game/board-canvas-model";
import { getPlayerColor } from "@/lib/game/view";

import { BoardCanvas, type BoardCanvasTarget } from "./board-canvas";
import { useBoardCamera } from "./use-board-camera";

interface BoardInspectionDetail {
  label: string;
  value: string;
}

interface BoardInspection {
  accessibleLabel: string;
  details: readonly BoardInspectionDetail[];
  id: string;
  kicker: string;
  resource?: ResourceType;
  title: string;
}

interface InspectableBoardItemProps {
  inspection: BoardInspection;
  isKeyboardTarget: boolean;
  onInspect(id: string | null): void;
  onKeyboardFocus(id: string): void;
  onKeyboardNavigate(event: ReactKeyboardEvent<HTMLElement>, id: string): void;
}

export function GameBoard({
  buildMode,
  game,
  longestRoadByPlayerId,
  onCancelBuildMode,
  onCommand,
  onPlacementExit,
  pending,
}: {
  buildMode: BoardBuildMode;
  game: PlayerGameView;
  longestRoadByPlayerId: ReadonlyMap<string, number>;
  onCancelBuildMode(): void;
  onCommand(command: GameCommand, successMessage: string): void;
  onPlacementExit(mode: BoardTargetMode): void;
  pending: boolean;
}) {
  const playersById = useMemo(
    () => new Map(game.players.map((player) => [player.id, player])),
    [game.players],
  );
  const playerThemes = useMemo(
    () => new Map(game.players.map((player) => [player.id, getPlayerColor(player)])),
    [game.players],
  );
  const boardLayout = useMemo(() => createBoardLayout(game.board.tiles), [game.board.tiles]);
  const boardFrame = useMemo(
    () =>
      getBoardFrame(
        boardLayout,
        game.board.ports.map((port) => port.edgeKey),
      ),
    [boardLayout, game.board.ports],
  );
  const viewerTheme = playerThemes.get(game.viewerPlayerId) ?? "red";
  const ports = useMemo(
    () =>
      game.board.ports.flatMap((port) => {
        const placement = getPortPlacement(boardLayout, port.edgeKey);
        return placement ? [{ ...port, placement }] : [];
      }),
    [boardLayout, game.board.ports],
  );
  const portInspections = useMemo(
    () =>
      ports.map((port) =>
        createPortInspection(port.id, port.trade, port.edgeKey, game, boardLayout),
      ),
    [boardLayout, game, ports],
  );
  const roadInspections = useMemo(
    () =>
      game.board.roads.map((road) =>
        createRoadInspection(
          `road:${road.edgeKey}`,
          playersById.get(road.playerId)?.displayName ?? "Unknown player",
          longestRoadByPlayerId.get(road.playerId) ?? 0,
        ),
      ),
    [game.board.roads, longestRoadByPlayerId, playersById],
  );
  const inspectionById = useMemo(
    () =>
      new Map(
        [...portInspections, ...roadInspections].map((inspection) => [inspection.id, inspection]),
      ),
    [portInspections, roadInspections],
  );
  const inspectionOrder = useMemo(() => [...inspectionById.keys()], [inspectionById]);
  const targetMode = resolveBoardTargetMode(game, buildMode);
  const boardTargets = useMemo(
    () =>
      createBoardCanvasTargetModels({
        game,
        layout: boardLayout,
        mode: targetMode,
        viewerTheme,
      }),
    [boardLayout, game, targetMode, viewerTheme],
  );
  const firstBoardTargetId = boardTargets[0]?.id ?? null;
  const [focusedTargetId, setFocusedTargetId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [keyboardTargetId, setKeyboardTargetId] = useState<string | null>(null);
  const activeTargetId = hoveredTargetId ?? focusedTargetId;
  const effectiveKeyboardTargetId = boardTargets.some((target) => target.id === keyboardTargetId)
    ? keyboardTargetId
    : firstBoardTargetId;
  const canvasTargets = useMemo<readonly BoardCanvasTarget[]>(
    () =>
      boardTargets.map((target) => ({
        ...target,
        disabled: pending,
        highlighted: target.id === activeTargetId,
      })),
    [activeTargetId, boardTargets, pending],
  );
  const boardPlaneRef = useRef<HTMLDivElement>(null);
  const {
    boardSceneRef,
    boardShellRef,
    boardStageRef,
    boardViewport,
    cancelPointerGesture,
    changeZoomBy,
    handleClickCapture,
    isInteracting,
    movePointerGesture,
    resetBoardViewport,
    startPointerGesture,
    stopPointerGesture,
  } = useBoardCamera();
  const findPointerTarget = (clientX: number, clientY: number) => {
    const bounds = boardPlaneRef.current?.getBoundingClientRect();
    if (!bounds) {
      return null;
    }

    const boardPoint = mapClientPointToBoard({ x: clientX, y: clientY }, bounds, BOARD_CANVAS);
    return boardPoint ? findNearestBoardTarget(boardTargets, boardPoint) : null;
  };
  const previousTargetModeRef = useRef<BoardTargetMode | null>(null);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [keyboardInspectionId, setKeyboardInspectionId] = useState<string | null>(null);
  const inspectedItem = inspectedItemId ? (inspectionById.get(inspectedItemId) ?? null) : null;
  const isDefaultView =
    boardViewport.scale === DEFAULT_BOARD_VIEWPORT.scale &&
    boardViewport.x === DEFAULT_BOARD_VIEWPORT.x &&
    boardViewport.y === DEFAULT_BOARD_VIEWPORT.y;
  const effectiveKeyboardInspectionId =
    keyboardInspectionId && inspectionById.has(keyboardInspectionId)
      ? keyboardInspectionId
      : (inspectionOrder[0] ?? null);

  useEffect(() => {
    const previousTargetMode = previousTargetModeRef.current;
    previousTargetModeRef.current = targetMode;

    if (previousTargetMode !== null && targetMode === null) {
      onPlacementExit(previousTargetMode);
      return;
    }

    if (targetMode === null || previousTargetMode === targetMode || firstBoardTargetId === null) {
      return;
    }

    setKeyboardTargetId(firstBoardTargetId);
    focusBoardElement(boardShellRef.current, "data-board-target-id", firstBoardTargetId);
  }, [boardShellRef, firstBoardTargetId, onPlacementExit, targetMode]);

  const inspectBoardItem = (id: string | null) => {
    if (id !== null && isInteracting()) {
      return;
    }
    setInspectedItemId(id);
  };

  const focusBoardItem = (id: string) => {
    setKeyboardInspectionId(id);
    inspectBoardItem(id);
  };

  const navigateBoardItems = (event: ReactKeyboardEvent<HTMLElement>, id: string) => {
    const nextId = getRovingTarget(event, inspectionOrder, id);
    if (nextId === null) {
      return;
    }

    focusBoardItem(nextId);
    focusBoardElement(boardShellRef.current, "data-board-inspection-id", nextId);
  };

  const navigateBuildTargets = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    const nextId = getRovingTarget(
      event,
      boardTargets.map((target) => target.id),
      id,
    );
    if (nextId === null) {
      return;
    }

    setKeyboardTargetId(nextId);
    focusBoardElement(boardShellRef.current, "data-board-target-id", nextId);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoomBy(BOARD_VIEWPORT_SCALE.step);
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      changeZoomBy(-BOARD_VIEWPORT_SCALE.step);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      resetBoardViewport();
      return;
    }

    if (event.key === "Escape" && buildMode !== null) {
      event.preventDefault();
      onCancelBuildMode();
    }
  };

  return (
    <section
      aria-label="Game board. Hover a board item for visual details, or Tab into the board items and use arrow keys to inspect them. Drag to pan. Use the mouse wheel or plus and minus keys to zoom, and press zero to reset."
      className="board-shell"
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={cancelPointerGesture}
      onPointerCancel={cancelPointerGesture}
      onPointerDown={startPointerGesture}
      onPointerMove={movePointerGesture}
      onPointerUp={stopPointerGesture}
      ref={boardShellRef}
    >
      {targetMode && boardTargets.length > 0 ? (
        <p aria-live="polite" className="sr-only" role="status">
          {getTargetModeLabel(targetMode)}. {boardTargets.length} legal
          {boardTargets.length === 1 ? " location" : " locations"}.
          {buildMode !== null ? " Press Escape to cancel." : null}
        </p>
      ) : null}
      <div
        className="board-stage"
        ref={boardStageRef}
        style={{ "--board-aspect": `${boardFrame.width} / ${boardFrame.height}` } as CSSProperties}
      >
        <div className="game-board" ref={boardSceneRef}>
          <div className="board-plane" ref={boardPlaneRef} style={getBoardPlaneStyle(boardFrame)}>
            <BoardCanvas
              board={game.board}
              boardLayout={boardLayout}
              playerThemes={playerThemes}
              renderScale={boardViewport.scale}
              targets={canvasTargets}
            />

            {ports.map((port, index) => {
              const inspection = portInspections[index];
              return inspection ? (
                <BoardHitTarget
                  className="port-hit-target"
                  inspection={inspection}
                  isKeyboardTarget={inspection.id === effectiveKeyboardInspectionId}
                  key={port.id}
                  onInspect={inspectBoardItem}
                  onKeyboardFocus={focusBoardItem}
                  onKeyboardNavigate={navigateBoardItems}
                  point={port.placement}
                />
              ) : null;
            })}

            {game.board.roads.map((road, index) => {
              const point = getEdgePlacement(boardLayout, road.edgeKey);
              const inspection = roadInspections[index];
              return point && inspection ? (
                <BoardHitTarget
                  angle={point.angle}
                  className="piece-hit-target-road"
                  inspection={inspection}
                  isKeyboardTarget={inspection.id === effectiveKeyboardInspectionId}
                  key={road.edgeKey}
                  onInspect={inspectBoardItem}
                  onKeyboardFocus={focusBoardItem}
                  onKeyboardNavigate={navigateBoardItems}
                  point={point}
                />
              ) : null;
            })}

            {boardTargets.map((target) => (
              <BuildTarget
                disabled={pending}
                isKeyboardTarget={target.id === effectiveKeyboardTargetId}
                key={target.id}
                onClick={(event) => {
                  const selectedTarget =
                    event.detail === 0
                      ? target
                      : (findPointerTarget(event.clientX, event.clientY) ?? target);
                  onCommand(selectedTarget.command, selectedTarget.successMessage);
                }}
                onFocus={(id) => {
                  setFocusedTargetId(id);
                  if (id) {
                    setKeyboardTargetId(id);
                  }
                }}
                onHover={setHoveredTargetId}
                onKeyboardNavigate={navigateBuildTargets}
                onPointerMove={(clientX, clientY) => {
                  setHoveredTargetId(findPointerTarget(clientX, clientY)?.id ?? null);
                }}
                target={target}
              />
            ))}
          </div>
        </div>
      </div>
      <BoardInspector inspection={inspectedItem} />
      <div
        aria-label="Map view"
        className="board-camera"
        data-moved={isDefaultView ? undefined : true}
        onPointerDown={(event) => event.stopPropagation()}
        role="group"
      >
        <CameraButton
          className="board-camera-zoom"
          disabled={boardViewport.scale >= BOARD_VIEWPORT_SCALE.max}
          icon={zoomInIcon}
          label="Zoom in"
          onClick={() => changeZoomBy(BOARD_VIEWPORT_SCALE.step)}
        />
        <CameraButton
          className="board-camera-zoom"
          disabled={boardViewport.scale <= BOARD_VIEWPORT_SCALE.min}
          icon={zoomOutIcon}
          label="Zoom out"
          onClick={() => changeZoomBy(-BOARD_VIEWPORT_SCALE.step)}
        />
        <CameraButton
          disabled={isDefaultView}
          icon={recenterIcon}
          label="Recenter map"
          onClick={resetBoardViewport}
        />
      </div>
    </section>
  );
}

function CameraButton({
  className,
  disabled,
  icon,
  label,
  onClick,
}: {
  className?: string;
  disabled: boolean;
  icon: IconifyIcon;
  label: string;
  onClick(): void;
}) {
  return (
    <Tooltip label={label} side="left">
      <Button
        aria-label={label}
        className={className}
        disabled={disabled}
        onClick={onClick}
        size="game-md"
        variant="game-icon"
      >
        <Icon aria-hidden="true" icon={icon} />
      </Button>
    </Tooltip>
  );
}

function BoardHitTarget({
  angle = 0,
  className,
  inspection,
  isKeyboardTarget,
  onInspect,
  onKeyboardFocus,
  onKeyboardNavigate,
  point,
}: InspectableBoardItemProps & {
  angle?: number;
  className: string;
  point: { x: number; y: number };
}) {
  return (
    <span
      aria-label={inspection.accessibleLabel}
      className={`board-hit-target ${className}`}
      data-board-inspection-id={inspection.id}
      onBlur={() => onInspect(null)}
      onFocus={() => onKeyboardFocus(inspection.id)}
      onKeyDown={(event) => onKeyboardNavigate(event, inspection.id)}
      onPointerDown={() => onInspect(inspection.id)}
      onPointerEnter={() => onInspect(inspection.id)}
      onPointerLeave={(event) => {
        if (document.activeElement !== event.currentTarget) {
          onInspect(null);
        }
      }}
      role="img"
      style={{ ...getPointStyle(point), "--hit-rotation": `${angle}deg` } as CSSProperties}
      tabIndex={isKeyboardTarget ? 0 : -1}
    />
  );
}

function BuildTarget({
  disabled,
  isKeyboardTarget,
  onClick,
  onFocus,
  onHover,
  onKeyboardNavigate,
  onPointerMove,
  target,
}: {
  disabled: boolean;
  isKeyboardTarget: boolean;
  onClick(event: ReactMouseEvent<HTMLButtonElement>): void;
  onFocus(id: string | null): void;
  onHover(id: string | null): void;
  onKeyboardNavigate(event: ReactKeyboardEvent<HTMLButtonElement>, id: string): void;
  onPointerMove(clientX: number, clientY: number): void;
  target: BoardCanvasTargetModel;
}) {
  return (
    <button
      aria-label={target.label}
      className="build-target"
      data-asset={target.asset}
      data-board-target-id={target.id}
      disabled={disabled}
      onBlur={() => onFocus(null)}
      onClick={onClick}
      onFocus={() => onFocus(target.id)}
      onKeyDown={(event) => onKeyboardNavigate(event, target.id)}
      onPointerEnter={(event) => onPointerMove(event.clientX, event.clientY)}
      onPointerLeave={() => onHover(null)}
      onPointerMove={(event) => onPointerMove(event.clientX, event.clientY)}
      style={
        {
          ...getPointStyle(target.point),
          "--target-rotation": `${target.angle}deg`,
        } as CSSProperties
      }
      tabIndex={isKeyboardTarget ? 0 : -1}
      type="button"
    />
  );
}

function BoardInspector({ inspection }: { inspection: BoardInspection | null }) {
  if (!inspection) {
    return null;
  }

  return (
    <aside aria-label="Board inspector" className="board-inspector">
      <span className="font-display text-xs tracking-wider uppercase text-foreground/70">
        {inspection.kicker}
      </span>
      <span className="flex items-center gap-2">
        {inspection.resource ? (
          <Image
            alt=""
            draggable={false}
            height={34}
            src={RESOURCE_CARD_ASSET_PATHS[inspection.resource]}
            unoptimized
            width={34}
          />
        ) : null}
        <strong className="text-sm font-extrabold text-foreground">{inspection.title}</strong>
      </span>
      <dl className="grid grid-cols-2 gap-2 m-0">
        {inspection.details.map((detail) => (
          <div className="grid gap-0.5" key={detail.label}>
            <dt className="font-display text-xs tracking-wider uppercase text-muted-foreground">
              {detail.label}
            </dt>
            <dd className="m-0 text-xs font-black text-foreground">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function createPortInspection(
  id: string,
  trade: "any" | ResourceType,
  edgeKey: string,
  game: PlayerGameView,
  layout: BoardLayout,
): BoardInspection {
  const isAnyResource = trade === "any";
  const resourceLabel = isAnyResource ? "any resource" : RESOURCE_LABELS[trade];
  const rate = isAnyResource ? "3:1" : "2:1";
  const title = isAnyResource ? "Open harbor" : `${resourceLabel} harbor`;
  const endpointKeys = new Set(layout.topology.edgeVertices[edgeKey] ?? []);
  const ownerIds = [
    ...new Set(
      game.board.buildings
        .filter((building) => endpointKeys.has(building.vertexKey))
        .map((building) => building.playerId),
    ),
  ];
  const ownerNames = ownerIds.map(
    (ownerId) =>
      game.players.find((player) => player.id === ownerId)?.displayName ?? "Unknown player",
  );
  const access = ownerIds.includes(game.viewerPlayerId)
    ? "Available to you"
    : ownerNames.length > 0
      ? `Used by ${ownerNames.join(" and ")}`
      : "Build a settlement on its corner to use it";

  return {
    accessibleLabel: `${rate} ${title}, trades ${resourceLabel}. ${access}.`,
    details: [{ label: "Access", value: access }],
    id: `port:${id}`,
    kicker: "Harbor",
    resource: isAnyResource ? undefined : trade,
    title: `${rate} ${title}`,
  };
}

function createRoadInspection(
  id: string,
  ownerName: string,
  longestRoadLength: number,
): BoardInspection {
  return {
    accessibleLabel: `${ownerName}'s road. Their longest road is ${longestRoadLength} ${longestRoadLength === 1 ? "road" : "roads"} long.`,
    details: [{ label: "Longest road", value: String(longestRoadLength) }],
    id,
    kicker: "Road",
    title: `${ownerName}'s road`,
  };
}

/** Arrow keys wrap through the items; Home and End jump to either end. */
function getRovingTarget(
  event: ReactKeyboardEvent<HTMLElement>,
  ids: readonly string[],
  currentId: string,
): string | null {
  const direction = getRovingDirection(event.key);
  if (direction === null || ids.length === 0) {
    return null;
  }

  event.preventDefault();
  event.stopPropagation();
  const currentIndex = Math.max(0, ids.indexOf(currentId));
  const nextIndex =
    direction === "first"
      ? 0
      : direction === "last"
        ? ids.length - 1
        : (currentIndex + direction + ids.length) % ids.length;
  return ids[nextIndex] ?? null;
}

function getRovingDirection(key: string): "first" | "last" | -1 | 1 | null {
  switch (key) {
    case "Home":
      return "first";
    case "End":
      return "last";
    case "ArrowLeft":
    case "ArrowUp":
      return -1;
    case "ArrowRight":
    case "ArrowDown":
      return 1;
    default:
      return null;
  }
}

function focusBoardElement(
  root: HTMLElement | null,
  attribute: "data-board-inspection-id" | "data-board-target-id",
  id: string,
) {
  root?.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(id)}"]`)?.focus();
}

function getTargetModeLabel(mode: BoardTargetMode): string {
  switch (mode) {
    case "city":
      return "Pick a settlement to upgrade";
    case "road":
      return "Pick a spot for your road";
    case "robber":
      return "Pick a tile for the robber";
    case "settlement":
      return "Pick a corner for your settlement";
  }
}
