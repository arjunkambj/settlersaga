"use client";

import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export type ActionTileSize = "dock" | "poster";

export interface ActionTileProps {
  ariaControls?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaHasPopup?: "dialog";
  ariaLabel: string;
  art: ReactNode;
  caption?: ReactNode;
  className?: string;
  count?: ReactNode;
  disabled?: boolean;
  kind: string;
  meta?: ReactNode;
  onPress?(event: React.MouseEvent<HTMLButtonElement>): void;
  onClick?(): void;
  pressed?: boolean;
  size?: ActionTileSize;
  title: string;
  unavailable?: boolean;
}

export function ActionTile({
  ariaControls,
  ariaDescribedBy,
  ariaExpanded,
  ariaHasPopup,
  ariaLabel,
  art,
  caption,
  className = "",
  count,
  disabled = false,
  kind,
  meta,
  onClick,
  onPress,
  pressed,
  size = "dock",
  title,
  unavailable = false,
}: ActionTileProps) {
  const handleClick = onPress ?? onClick;
  return (
    <Button
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedBy}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className={[
        "action-button",
        "action-tile",
        "action-tile-preset",
        `action-tile-preset--${size}`,
        pressed ? "is-selected" : "",
        unavailable ? "is-unavailable" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-action-kind={kind}
      disabled={disabled || unavailable}
      onClick={handleClick}
      variant="secondary"
    >
      {count === undefined ? null : (
        <span aria-hidden="true" className="action-count">
          {count}
        </span>
      )}
      <span aria-hidden="true" className="action-tile-preset__art">
        {art}
      </span>
      <strong className="action-tile-preset__title">{title}</strong>
      {meta ? <span className="action-tile-preset__meta">{meta}</span> : null}
      {caption ? <small className="action-tile-preset__caption">{caption}</small> : null}
    </Button>
  );
}
