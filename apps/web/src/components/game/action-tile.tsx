"use client";

import checkIcon from "@iconify-icons/solar/check-circle-bold";
import lockIcon from "@iconify-icons/solar/lock-keyhole-minimalistic-bold";
import { Icon } from "@iconify/react/offline";
import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { getLockNote } from "@/lib/game/dock-actions";

/**
 * What a dock tile says about itself, in words, on its status line:
 * - ready: it can be used now. A green "Ready" chip (or `label`, such as "Road" on the phone
 *   Build tile);
 * - need: the player can't pay for it yet, and `label` says what is missing ("Need 1 Brick");
 * - locked: something else stops it, and `label` says what in a few words ("No open corner", "Roll
 *   first"), beside a lock.
 */
export type ActionTileState =
  | { kind: "locked"; label: string }
  | { kind: "need"; label: string }
  | { kind: "ready"; label?: string };

export interface ActionTileProps {
  /** Dock: the status line while the tile is pressed (its build mode is on), "Pick a spot". */
  activeLabel?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaLabel: string;
  art: ReactNode;
  /**
   * Poster: a line under the title. Dock: a quiet caption beside the name, such as "5 left".
   */
  caption?: ReactNode;
  /** Dock: the caption shows only where the tiles are wide rows (md up), not in the phone tray. */
  captionWideOnly?: boolean;
  /** The price as resource icons, on its own line under the name. */
  cost?: ReactNode;
  /** Poster only: a count chip on the corner. */
  count?: ReactNode;
  /** Dock: a working tile that has nothing ready behind it (the phone Build tile), drawn quiet. */
  dimmed?: boolean;
  /** Read by the game screen to return focus to a build tile after placement. */
  kind: string;
  /** Why the tile can't be used now. The tile stays focusable and pressable so it can say so. */
  lockReason?: string | null;
  meta?: ReactNode;
  onClick(): void;
  pressed?: boolean;
  /** "poster" is the large preset used by the UI preview; the dock look lives in game-dock.css. */
  size?: "dock" | "poster";
  /**
   * Dock: the status line. Without it a locked tile shows its lock and the few words for
   * `lockReason`, and an open tile shows no status (Trade is simply a button).
   */
  state?: ActionTileState;
  title: string;
  /** Hover and focus hint for an unlocked dock tile, such as its price. */
  tooltip?: string;
}

/** The status line's look: the state, or "active" while the tile's build mode is on. */
type TileLook = "active" | "idle" | ActionTileState["kind"];

function StatusLine({
  activeLabel,
  look,
  state,
}: {
  activeLabel: string | undefined;
  look: TileLook;
  state: ActionTileState | undefined;
}) {
  if (look === "active") {
    return activeLabel ? <span className="game-action-status">{activeLabel}</span> : null;
  }
  if (!state) {
    return null;
  }
  switch (state.kind) {
    case "ready":
      return (
        <span className="game-action-status">
          <span className="game-ready-chip">
            <Icon icon={checkIcon} />
            {state.label ?? "Ready"}
          </span>
        </span>
      );
    case "need":
      return <span className="game-action-status">{state.label}</span>;
    case "locked":
      return (
        <span className="game-action-status">
          <Icon className="game-action-status-icon" icon={lockIcon} />
          {state.label}
        </span>
      );
  }
}

export function ActionTile({
  activeLabel,
  ariaControls,
  ariaExpanded,
  ariaLabel,
  art,
  caption,
  captionWideOnly = false,
  cost,
  count,
  dimmed = false,
  kind,
  lockReason,
  meta,
  onClick,
  pressed,
  size = "dock",
  state,
  title,
  tooltip,
}: ActionTileProps) {
  if (size === "poster") {
    return (
      <button
        aria-label={ariaLabel}
        className="relative grid w-[4.6rem] justify-items-center gap-1 rounded-lg bg-well-fill p-1.5 text-center select-none"
        data-action-kind={kind}
        onClick={onClick}
        type="button"
      >
        <span aria-hidden="true" className="block size-full">
          {art}
        </span>
        {count === undefined ? null : (
          <span aria-hidden="true" className="game-count-chip">
            {count}
          </span>
        )}
        <span aria-hidden="true" className="max-w-full truncate font-display text-xs">
          {title}
        </span>
        {meta ? (
          <span className="max-w-full truncate text-xs text-muted-foreground">{meta}</span>
        ) : null}
        {caption ? (
          <small className="max-w-full truncate text-xs text-muted-foreground">{caption}</small>
        ) : null}
      </button>
    );
  }

  const shown: ActionTileState | undefined =
    state ?? (lockReason ? { kind: "locked", label: getLockNote(lockReason) } : undefined);
  const look: TileLook = pressed
    ? "active"
    : (shown?.kind ?? (lockReason || dimmed ? "idle" : "ready"));
  const tile = (
    <button
      aria-controls={ariaControls}
      aria-disabled={lockReason ? true : undefined}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="game-action-tile"
      data-action-kind={kind}
      data-state={look}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="game-action-tile-art">
        {art}
      </span>
      <span aria-hidden="true" className="game-action-head">
        <span className="game-action-label">{title}</span>
        {caption ? (
          <span className="game-action-caption" data-wide-only={captionWideOnly || undefined}>
            {caption}
          </span>
        ) : null}
      </span>
      {cost ? (
        <span aria-hidden="true" className="game-action-tile-cost">
          {cost}
        </span>
      ) : null}
      <span aria-hidden="true" className="game-action-status-slot">
        <StatusLine activeLabel={activeLabel} look={look} state={shown} />
      </span>
    </button>
  );

  const hint = lockReason ?? tooltip;
  return hint ? (
    <Tooltip label={hint} side="top">
      {tile}
    </Tooltip>
  ) : (
    tile
  );
}
