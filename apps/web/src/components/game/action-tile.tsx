"use client";

import lockIcon from "@iconify-icons/solar/lock-keyhole-minimalistic-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

/**
 * How a dock tile looks. The tile's words are in its label and tooltip; on the tile itself:
 * - ready: it can be used now. The tile is lit: a raised face, full-color art, a white name;
 * - short: the player can't pay for it yet. A quiet tile whose price shows the cards still
 *   missing as faint icons;
 * - quiet: it can't be used for another reason, or something stops the whole panel (not your
 *   turn, roll first…): a quiet tile and nothing else;
 * - locked: something the price can't fix stops it (no open spot, none left, deck empty): a lock
 *   and `note`, one short line, in the price's place.
 */
export type ActionTileState =
  | { kind: "locked"; note: string }
  | { kind: "quiet" }
  | { kind: "ready" }
  | { kind: "short" };

export interface ActionTileProps {
  /** Dock: the tile's third line while it is pressed (its build mode is on), "Pick a spot". */
  activeLabel?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaLabel: string;
  art: ReactNode;
  /**
   * Poster: a line under the title. Dock: a short quiet line in the price's place on a tile
   * without one (Trade), shown only where it fits.
   */
  caption?: ReactNode;
  /** The price as resource icons (CostPips), on the line under the name. */
  cost?: ReactNode;
  /** Poster only: a count chip on the corner. */
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
  /** Dock: how the tile looks (above). Without it the tile is ready unless `lockReason` is set. */
  state?: ActionTileState;
  title: string;
  /** Hover and focus hint: the tile's name and its state in words. */
  tooltip?: string;
}

/** A tile's art: one bold icon of the piece or the action, on nothing. */
export function TileArt({ src }: { src: string }) {
  return (
    <Image
      alt=""
      className="game-action-art-image"
      draggable={false}
      height={512}
      loading="eager"
      sizes="3.5rem"
      src={src}
      width={512}
    />
  );
}

/** The tile's look: its state, or "active" while its build mode is on. */
type TileLook = "active" | ActionTileState["kind"];

export function ActionTile({
  activeLabel,
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

  const look: TileLook = pressed ? "active" : (state?.kind ?? (lockReason ? "quiet" : "ready"));
  // The third line: what to do while placing, why it is locked, or else the price.
  const note = look === "active" ? activeLabel : state?.kind === "locked" ? state.note : undefined;
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
      <span aria-hidden="true" className="game-action-label">
        {title}
      </span>
      <span
        aria-hidden="true"
        className="game-action-line"
        data-tone={note ? (look === "active" ? "active" : "locked") : undefined}
      >
        {note ? (
          <>
            {look === "locked" ? <Icon className="game-action-line-icon" icon={lockIcon} /> : null}
            <span className="game-action-line-text">{note}</span>
          </>
        ) : (
          (cost ?? caption)
        )}
      </span>
    </button>
  );

  const hint = tooltip ?? lockReason;
  return hint ? (
    <Tooltip label={hint} side="top">
      {tile}
    </Tooltip>
  ) : (
    tile
  );
}
