"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
} from "react";

import {
  DEFAULT_BOARD_VIEWPORT,
  clampBoardViewport,
  getDefaultBoardViewport,
  getBoardViewportFocus,
  getBoardViewportTransform,
  isCompactBoardViewport,
  normalizeBoardWheelDelta,
  panBoardViewport,
  pinchBoardViewport,
  zoomBoardViewport,
  type BoardViewportPoint,
  type BoardViewportRect,
  type BoardViewportState,
} from "@/lib/game/board-viewport";

const DRAG_THRESHOLD = 5;
const MAX_WHEEL_DELTA = 80;
const WHEEL_IDLE_DELAY = 140;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const FALLBACK_STAGE_BOUNDS: BoardViewportRect = {
  height: 1,
  left: 0,
  top: 0,
  width: 1,
};

type ActivePointer = BoardViewportPoint;

interface PanGestureBaseline {
  kind: "pan";
  origin: BoardViewportState;
  pointerId: number;
  startPoint: BoardViewportPoint;
}

interface PinchGestureBaseline {
  kind: "pinch";
  origin: BoardViewportState;
  pointerIds: readonly [number, number];
  startCentroid: BoardViewportPoint;
  startDistance: number;
  startFocus: BoardViewportPoint;
}

type GestureBaseline = PanGestureBaseline | PinchGestureBaseline;

interface PointerGesture {
  baseline: GestureBaseline;
  hasDragged: boolean;
  startedOnBuildTarget: Element | null;
}

export interface BoardCamera {
  boardSceneRef: RefObject<HTMLDivElement | null>;
  boardShellRef: RefObject<HTMLElement | null>;
  boardStageRef: RefObject<HTMLDivElement | null>;
  boardViewport: BoardViewportState;
  cancelPointerGesture: PointerEventHandler<HTMLElement>;
  changeZoomBy(amount: number): void;
  handleClickCapture: MouseEventHandler<HTMLElement>;
  handleLostPointerCapture: PointerEventHandler<HTMLElement>;
  isInteracting(): boolean;
  movePointerGesture: PointerEventHandler<HTMLElement>;
  panBoardBy(x: number, y: number): void;
  resetBoardViewport(): void;
  startPointerGesture: PointerEventHandler<HTMLElement>;
  stopPointerGesture: PointerEventHandler<HTMLElement>;
}

export function useBoardCamera(): BoardCamera {
  const boardShellRef = useRef<HTMLElement | null>(null);
  const boardStageRef = useRef<HTMLDivElement | null>(null);
  const boardSceneRef = useRef<HTMLDivElement | null>(null);
  const [boardViewport, setBoardViewport] = useState(DEFAULT_BOARD_VIEWPORT);
  const viewportRef = useRef(DEFAULT_BOARD_VIEWPORT);
  const stageBoundsRef = useRef<BoardViewportRect>({ ...FALLBACK_STAGE_BOUNDS });
  const activePointersRef = useRef(new Map<number, ActivePointer>());
  const pointerCaptureTargetsRef = useRef(new Map<number, Element>());
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const interactionRef = useRef(false);
  const draggingRef = useRef(false);
  const wheelInteractingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const wheelIdleTimerRef = useRef<number | null>(null);
  const suppressedBuildTargetRef = useRef<Element | null>(null);
  const suppressedClickTimerRef = useRef<number | null>(null);
  const shellRef = useRef<Element | null>(null);
  const defaultViewportModeRef = useRef<"compact" | "regular" | null>(null);
  const refreshStageBoundsRef = useRef<() => void>(() => undefined);

  const scheduleSceneWrite = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const viewport = viewportRef.current;
      const scene = boardSceneRef.current;

      if (scene) {
        scene.style.transform = getBoardViewportTransform(viewport);
      }
    });
  }, []);

  const setTransientViewport = useCallback(
    (nextViewport: BoardViewportState) => {
      if (areBoardViewportsEqual(viewportRef.current, nextViewport)) {
        return;
      }

      viewportRef.current = nextViewport;
      scheduleSceneWrite();
    },
    [scheduleSceneWrite],
  );

  const commitViewport = useCallback(() => {
    const nextViewport = viewportRef.current;
    setBoardViewport((currentViewport) =>
      areBoardViewportsEqual(currentViewport, nextViewport) ? currentViewport : nextViewport,
    );
  }, []);

  const updateInteractionClasses = useCallback(() => {
    const shell = boardShellRef.current;
    const isInteracting = draggingRef.current || wheelInteractingRef.current;
    interactionRef.current = isInteracting;

    shell?.classList.toggle("is-interacting", isInteracting);
    shell?.classList.toggle("is-dragging", draggingRef.current);

    const gamePage = shellRef.current ?? shell?.closest("[data-game-shell]") ?? null;
    shellRef.current = gamePage;
    gamePage?.classList.toggle("is-board-interacting", isInteracting);
  }, []);

  const rebasePointerGesture = useCallback(() => {
    const baseline = createGestureBaseline(
      activePointersRef.current,
      viewportRef.current,
      stageBoundsRef.current,
    );
    const currentGesture = pointerGestureRef.current;

    pointerGestureRef.current = baseline
      ? {
          baseline,
          hasDragged: currentGesture?.hasDragged ?? false,
          startedOnBuildTarget: currentGesture?.startedOnBuildTarget ?? null,
        }
      : null;
  }, []);

  const finishWheelInteraction = useCallback(
    (shouldCommit: boolean) => {
      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      if (!wheelInteractingRef.current) {
        return;
      }

      wheelInteractingRef.current = false;
      if (shouldCommit) {
        commitViewport();
      }
      updateInteractionClasses();
    },
    [commitViewport, updateInteractionClasses],
  );

  const commitControlViewport = useCallback(
    (nextViewport: BoardViewportState) => {
      finishWheelInteraction(false);
      setTransientViewport(nextViewport);
      commitViewport();
      rebasePointerGesture();
    },
    [commitViewport, finishWheelInteraction, rebasePointerGesture, setTransientViewport],
  );

  const changeZoomBy = useCallback(
    (amount: number) => {
      const currentViewport = viewportRef.current;
      commitControlViewport(
        zoomBoardViewport(
          currentViewport,
          currentViewport.scale + amount,
          { x: 0, y: 0 },
          stageBoundsRef.current,
        ),
      );
    },
    [commitControlViewport],
  );

  const panBoardBy = useCallback(
    (x: number, y: number) => {
      commitControlViewport(
        panBoardViewport(viewportRef.current, { x, y }, stageBoundsRef.current),
      );
    },
    [commitControlViewport],
  );

  const resetBoardViewport = useCallback(() => {
    commitControlViewport(getDefaultBoardViewport(stageBoundsRef.current));
  }, [commitControlViewport]);

  const handleNativeWheel = useCallback(
    (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      event.preventDefault();
      if (activePointersRef.current.size > 0) {
        return;
      }

      const delta = normalizeBoardWheelDelta(
        event.deltaY,
        event.deltaMode,
        stageBoundsRef.current.height,
        MAX_WHEEL_DELTA,
      );
      if (delta === 0) {
        return;
      }

      if (!wheelInteractingRef.current) {
        wheelInteractingRef.current = true;
        updateInteractionClasses();
        refreshStageBoundsRef.current();
      }

      const stageBounds = stageBoundsRef.current;
      const focus = getBoardViewportFocus({ x: event.clientX, y: event.clientY }, stageBounds);
      const currentViewport = viewportRef.current;
      const nextViewport = zoomBoardViewport(
        currentViewport,
        currentViewport.scale * Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY),
        focus,
        stageBounds,
      );

      setTransientViewport(nextViewport);
      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current);
      }
      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelIdleTimerRef.current = null;
        wheelInteractingRef.current = false;
        commitViewport();
        updateInteractionClasses();
      }, WHEEL_IDLE_DELAY);
    },
    [commitViewport, setTransientViewport, updateInteractionClasses],
  );

  const startPointerGesture = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (
        event.button !== 0 ||
        activePointersRef.current.size >= 2 ||
        shouldIgnorePointerGesture(event.target)
      ) {
        return;
      }

      finishWheelInteraction(true);
      const buildTarget = getBuildTarget(event.target);
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const captureTarget = event.target instanceof Element ? event.target : event.currentTarget;
      captureTarget.setPointerCapture(event.pointerId);
      pointerCaptureTargetsRef.current.set(event.pointerId, captureTarget);
      updateInteractionClasses();

      if (activePointersRef.current.size === 1) {
        refreshStageBoundsRef.current();
      }

      const previousGesture = pointerGestureRef.current;
      const baseline = createGestureBaseline(
        activePointersRef.current,
        viewportRef.current,
        stageBoundsRef.current,
      );
      if (!baseline) {
        return;
      }

      pointerGestureRef.current = {
        baseline,
        hasDragged: previousGesture?.hasDragged ?? false,
        startedOnBuildTarget: previousGesture?.startedOnBuildTarget ?? buildTarget,
      };
    },
    [finishWheelInteraction, updateInteractionClasses],
  );

  const movePointerGesture = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (!activePointersRef.current.has(event.pointerId)) {
        return;
      }

      event.preventDefault();
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      const gesture = pointerGestureRef.current;
      if (!gesture) {
        return;
      }

      const movement = getGestureMovement(gesture.baseline, activePointersRef.current);
      if (!gesture.hasDragged && movement < DRAG_THRESHOLD) {
        return;
      }
      if (!gesture.hasDragged) {
        gesture.hasDragged = true;
        draggingRef.current = true;
        updateInteractionClasses();
      }

      const nextViewport = getGestureViewport(
        gesture.baseline,
        activePointersRef.current,
        stageBoundsRef.current,
      );
      if (nextViewport) {
        setTransientViewport(nextViewport);
      }
    },
    [setTransientViewport, updateInteractionClasses],
  );

  const finishPointer = useCallback(
    (pointerId: number, shouldSuppressClick: boolean) => {
      if (!activePointersRef.current.delete(pointerId)) {
        return;
      }
      pointerCaptureTargetsRef.current.delete(pointerId);

      const completedGesture = pointerGestureRef.current;
      if (
        shouldSuppressClick &&
        completedGesture?.hasDragged &&
        completedGesture.startedOnBuildTarget
      ) {
        suppressedBuildTargetRef.current = completedGesture.startedOnBuildTarget;
        if (suppressedClickTimerRef.current !== null) {
          window.clearTimeout(suppressedClickTimerRef.current);
        }
        suppressedClickTimerRef.current = window.setTimeout(() => {
          suppressedBuildTargetRef.current = null;
          suppressedClickTimerRef.current = null;
        }, 0);
      }

      if (activePointersRef.current.size > 0) {
        rebasePointerGesture();
        updateInteractionClasses();
        return;
      }

      pointerGestureRef.current = null;
      draggingRef.current = false;
      commitViewport();
      updateInteractionClasses();
    },
    [commitViewport, rebasePointerGesture, updateInteractionClasses],
  );

  const stopPointerGesture = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const captureTarget = pointerCaptureTargetsRef.current.get(event.pointerId);
      finishPointer(event.pointerId, true);
      if (captureTarget?.hasPointerCapture(event.pointerId)) {
        captureTarget.releasePointerCapture(event.pointerId);
      }
    },
    [finishPointer],
  );

  const cancelPointerGesture = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      finishPointer(event.pointerId, false);
    },
    [finishPointer],
  );

  const handleLostPointerCapture = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      finishPointer(event.pointerId, false);
    },
    [finishPointer],
  );

  const handleClickCapture = useCallback<MouseEventHandler<HTMLElement>>((event) => {
    if (!suppressedBuildTargetRef.current) {
      return;
    }

    suppressedBuildTargetRef.current = null;
    if (suppressedClickTimerRef.current !== null) {
      window.clearTimeout(suppressedClickTimerRef.current);
      suppressedClickTimerRef.current = null;
    }

    event.preventDefault();
    event.stopPropagation();
  }, []);

  const isInteracting = useCallback(() => interactionRef.current, []);

  useLayoutEffect(() => {
    const shell = boardShellRef.current;
    const stage = boardStageRef.current;
    if (!shell || !stage) {
      return;
    }

    shellRef.current = shell.closest("[data-game-shell]");
    const updateStageBounds = () => {
      const rect = stage.getBoundingClientRect();
      stageBoundsRef.current = {
        height: Math.max(1, rect.height),
        left: rect.left,
        top: rect.top,
        width: Math.max(1, rect.width),
      };

      const viewportMode = isCompactBoardViewport(stageBoundsRef.current) ? "compact" : "regular";
      const crossedViewportMode = defaultViewportModeRef.current !== viewportMode;
      const clampedViewport = clampBoardViewport(
        crossedViewportMode ? getDefaultBoardViewport(stageBoundsRef.current) : viewportRef.current,
        stageBoundsRef.current,
      );
      defaultViewportModeRef.current = viewportMode;
      setTransientViewport(clampedViewport);
      commitViewport();
      rebasePointerGesture();
    };

    refreshStageBoundsRef.current = updateStageBounds;
    updateStageBounds();
    scheduleSceneWrite();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateStageBounds);
    resizeObserver?.observe(shell);
    resizeObserver?.observe(stage);
    window.addEventListener("resize", updateStageBounds, { passive: true });
    shell.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      shell.removeEventListener("wheel", handleNativeWheel);
      window.removeEventListener("resize", updateStageBounds);
      resizeObserver?.disconnect();
      refreshStageBoundsRef.current = () => undefined;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      if (suppressedClickTimerRef.current !== null) {
        window.clearTimeout(suppressedClickTimerRef.current);
        suppressedClickTimerRef.current = null;
      }

      activePointersRef.current.clear();
      pointerCaptureTargetsRef.current.clear();
      pointerGestureRef.current = null;
      wheelInteractingRef.current = false;
      interactionRef.current = false;
      draggingRef.current = false;
      suppressedBuildTargetRef.current = null;
      shell.classList.remove("is-interacting", "is-dragging");
      shellRef.current?.classList.remove("is-board-interacting");
      shellRef.current = null;
    };
  }, [
    commitViewport,
    handleNativeWheel,
    rebasePointerGesture,
    scheduleSceneWrite,
    setTransientViewport,
  ]);

  return {
    boardSceneRef,
    boardShellRef,
    boardStageRef,
    boardViewport,
    cancelPointerGesture,
    changeZoomBy,
    handleClickCapture,
    handleLostPointerCapture,
    isInteracting,
    movePointerGesture,
    panBoardBy,
    resetBoardViewport,
    startPointerGesture,
    stopPointerGesture,
  };
}

function createGestureBaseline(
  activePointers: ReadonlyMap<number, ActivePointer>,
  origin: BoardViewportState,
  stageBounds: BoardViewportRect,
): GestureBaseline | null {
  const pointers = [...activePointers.entries()];
  const firstPointer = pointers[0];
  if (!firstPointer) {
    return null;
  }

  const secondPointer = pointers[1];
  if (!secondPointer) {
    return {
      kind: "pan",
      origin,
      pointerId: firstPointer[0],
      startPoint: firstPointer[1],
    };
  }

  const centroid = getCentroid(firstPointer[1], secondPointer[1]);
  return {
    kind: "pinch",
    origin,
    pointerIds: [firstPointer[0], secondPointer[0]],
    startCentroid: centroid,
    startDistance: Math.max(1, getDistance(firstPointer[1], secondPointer[1])),
    startFocus: getBoardViewportFocus(centroid, stageBounds),
  };
}

function getGestureMovement(
  baseline: GestureBaseline,
  activePointers: ReadonlyMap<number, ActivePointer>,
): number {
  if (baseline.kind === "pan") {
    const pointer = activePointers.get(baseline.pointerId);
    return pointer ? getDistance(pointer, baseline.startPoint) : 0;
  }

  const firstPointer = activePointers.get(baseline.pointerIds[0]);
  const secondPointer = activePointers.get(baseline.pointerIds[1]);
  if (!firstPointer || !secondPointer) {
    return 0;
  }

  const currentCentroid = getCentroid(firstPointer, secondPointer);
  const centroidMovement = getDistance(baseline.startCentroid, currentCentroid);
  const distanceMovement = Math.abs(
    getDistance(firstPointer, secondPointer) - baseline.startDistance,
  );
  return Math.max(centroidMovement, distanceMovement);
}

function getGestureViewport(
  baseline: GestureBaseline,
  activePointers: ReadonlyMap<number, ActivePointer>,
  stageBounds: BoardViewportRect,
): BoardViewportState | null {
  if (baseline.kind === "pan") {
    const pointer = activePointers.get(baseline.pointerId);
    return pointer
      ? panBoardViewport(
          baseline.origin,
          {
            x: pointer.x - baseline.startPoint.x,
            y: pointer.y - baseline.startPoint.y,
          },
          stageBounds,
        )
      : null;
  }

  const firstPointer = activePointers.get(baseline.pointerIds[0]);
  const secondPointer = activePointers.get(baseline.pointerIds[1]);
  if (!firstPointer || !secondPointer) {
    return null;
  }

  const currentDistance = getDistance(firstPointer, secondPointer);
  const currentFocus = getBoardViewportFocus(getCentroid(firstPointer, secondPointer), stageBounds);
  return pinchBoardViewport(
    baseline.origin,
    baseline.origin.scale * (currentDistance / baseline.startDistance),
    baseline.startFocus,
    currentFocus,
    stageBounds,
  );
}

function getCentroid(
  firstPoint: BoardViewportPoint,
  secondPoint: BoardViewportPoint,
): BoardViewportPoint {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  };
}

function getDistance(firstPoint: BoardViewportPoint, secondPoint: BoardViewportPoint): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function shouldIgnorePointerGesture(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'a, button:not(.build-target), input, select, textarea, [contenteditable="true"]',
    ),
  );
}

function getBuildTarget(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(".build-target") : null;
}

function areBoardViewportsEqual(
  firstViewport: BoardViewportState,
  secondViewport: BoardViewportState,
): boolean {
  return (
    firstViewport.scale === secondViewport.scale &&
    firstViewport.x === secondViewport.x &&
    firstViewport.y === secondViewport.y
  );
}
