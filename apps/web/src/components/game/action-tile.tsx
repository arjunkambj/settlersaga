"use client";

import type { ResourceInventory } from "@settersaga/game";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import lockIcon from "@iconify-icons/solar/lock-keyhole-minimalistic-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

import { ResourceIcons } from "./dock-resource";

/**
 * How a dock tile looks. The tile's words are in its label and tooltip; on the tile itself:
 * - ready: it can be used now. The tile is lit, and its status line says "✓ Ready";
 * - short: the player can't pay for it yet. A quiet tile whose status line says "Need" with only
 *   the missing cards, as icons with their counts;
 * - quiet: it can't be used for another reason, or something stops the whole panel (not your
 *   turn, roll first…): a quiet tile with no status line (the panel dims its whole row then);
 * - locked: something the price can't fix stops it (no open spot, none left, deck empty): a lock
 *   and `note`, one short muted line.
 * On phones the tile keeps its older look: the price as mini cards (ghosted where missing) and a
 * small check or lock on the art.
 */
export type ActionTileState =
  | { kind: "locked"; note: string }
  | { kind: "quiet" }
  | { kind: "ready" }
  | { kind: "short"; missing: Readonly<ResourceInventory> };

export interface ActionTileProps {
  /** Dock: the tile's one line while it is pressed (its build mode is on), "Pick a spot". */
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
  /** The price as mini cards (CostCards), on its own line under the name. */
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

/**
 * A tile's art: its card, whole (frame and all), like the cards in the hand. Every tile shows
 * one the same way, so no tile sits on a colored square of its own.
 */
export function TileArt({ src }: { src: string }) {
  return (
    <Image
      alt=""
      className="game-action-art-image"
      draggable={false}
      height={768}
      loading="eager"
      sizes="2.5rem"
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
      data-priced={cost ? true : undefined}
      data-state={look}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="game-action-tile-art">
        {art}
        {look === "locked" ? (
          <span className="game-action-badge" data-tone="locked">
            <Icon icon={lockIcon} />
          </span>
        ) : look === "ready" ? (
          <span className="game-action-badge" data-tone="ready">
            <Icon icon={checkIcon} />
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className="game-action-label">
        {title}
      </span>
      <span aria-hidden="true" className="game-action-tile-cost">
        {cost ?? (caption ? <span className="game-action-caption">{caption}</span> : null)}
      </span>
      <span aria-hidden="true" className="game-action-note">
        {note}
      </span>
      <TileStatus activeLabel={activeLabel} look={look} state={state} />
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

/**
 * The dock row's status line (styles/game-dock.css; phones use the note and the art's badge):
 * "✓ Ready" in green, "Need" with only the missing cards in amber, a lock and the short reason in
 * the muted color, or the build mode's "Pick a spot". A quiet tile has none.
 */
function TileStatus({
  activeLabel,
  look,
  state,
}: {
  activeLabel?: string;
  look: TileLook;
  state?: ActionTileState;
}) {
  if (look === "active") {
    return activeLabel ? (
      <span aria-hidden="true" className="game-action-status" data-tone="active">
        <span className="game-action-status-text">{activeLabel}</span>
      </span>
    ) : null;
  }
  switch (state?.kind) {
    case "ready":
      return (
        <span aria-hidden="true" className="game-action-status" data-tone="ready">
          <Icon className="game-action-status-icon" icon={checkIcon} />
          <span className="game-action-status-text">Ready</span>
        </span>
      );
    case "short":
      return (
        <span aria-hidden="true" className="game-action-status" data-tone="need">
          <span className="game-action-status-text">Need</span>
          <ResourceIcons cards={state.missing} />
        </span>
      );
    case "locked":
      return (
        <span aria-hidden="true" className="game-action-status" data-tone="locked">
          <Icon className="game-action-status-icon" icon={lockIcon} />
          <span className="game-action-status-text">{state.note}</span>
        </span>
      );
    default:
      return null;
  }
}
