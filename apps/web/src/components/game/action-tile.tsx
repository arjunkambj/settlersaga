"use client";

import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

export interface ActionTileProps {
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaLabel: string;
  art: ReactNode;
  caption?: ReactNode;
  /** The price as resource pips, hung on the bottom edge of the art. */
  cost?: ReactNode;
  count?: ReactNode;
  /** Read by the game screen to return focus to a build tile after placement. */
  kind: string;
  /** Why the tile can't be used now. The tile stays focusable and pressable so it can say so. */
  lockReason?: string | null;
  meta?: ReactNode;
  onClick(): void;
  pressed?: boolean;
  /** "poster" is the large preset used by the UI preview; the dock look lives in game-dock.css. */
  size?: "dock" | "poster";
  title: string;
  /** Hover and focus hint for an unlocked dock tile, such as its price. */
  tooltip?: string;
}

export function ActionTile({
  ariaControls,
  ariaExpanded,
  ariaLabel,
  art,
  caption,
  cost,
  count,
  kind,
  lockReason,
  meta,
  onClick,
  pressed,
  size = "dock",
  title,
  tooltip,
}: ActionTileProps) {
  if (size === "poster") {
    return (
      <button
        aria-label={ariaLabel}
        className="relative grid w-[4.6rem] justify-items-center gap-1 rounded-lg bg-well p-1.5 text-center select-none"
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

  const tile = (
    <button
      aria-controls={ariaControls}
      aria-disabled={lockReason ? true : undefined}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="game-action-tile"
      data-action-kind={kind}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="game-action-tile-art">
        {art}
      </span>
      {cost ? <span className="game-action-tile-cost">{cost}</span> : null}
      {count === undefined ? null : (
        <span aria-hidden="true" className="game-count-chip">
          {count}
        </span>
      )}
      <span aria-hidden="true" className="game-action-label">
        {title}
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
