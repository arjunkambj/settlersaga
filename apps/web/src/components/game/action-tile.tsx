"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      className={cn(
        "relative grid justify-items-center h-auto min-h-0 text-center select-none transition-all duration-150",
        size === "dock"
          ? "w-16 min-w-16 p-0 bg-transparent hover:bg-transparent border-0 rounded-lg aspect-[2/3]"
          : "w-[4.6rem] bg-background/40 hover:bg-card/80 border border-white/5 rounded-lg gap-1 p-1.5",
        pressed &&
          (size === "dock" ? "brightness-110 -translate-y-0.5" : "bg-primary/20 border-primary/40"),
        unavailable && "opacity-60 cursor-not-allowed",
        size === "dock" &&
          !unavailable &&
          !disabled &&
          "hover:brightness-105 hover:-translate-y-0.5",
        className,
      )}
      data-action-kind={kind}
      disabled={disabled || unavailable}
      onClick={handleClick}
      title={title}
      variant="secondary"
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-full rounded-lg overflow-hidden transition-transform duration-150",
          size === "dock" && !unavailable && "hover:-translate-y-0.5 hover:brightness-105",
        )}
      >
        {art}
      </span>
      {count === undefined ? null : (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 z-10 grid min-w-5 h-5 place-items-center px-1 rounded-full bg-primary text-primary-foreground text-[0.66rem] font-black tabular-nums pointer-events-none shadow-sm"
        >
          {count}
        </span>
      )}
      {size === "dock" ? null : (
        <span
          aria-hidden="true"
          className="self-center truncate text-center text-[0.52rem] font-extrabold text-muted-foreground leading-none max-w-full"
        >
          {title}
        </span>
      )}
      {meta ? (
        <span className="text-[0.58rem] text-muted-foreground leading-tight max-w-full truncate">
          {meta}
        </span>
      ) : null}
      {caption ? (
        <small className="text-[0.55rem] text-muted-foreground/80 leading-tight max-w-full truncate">
          {caption}
        </small>
      ) : null}
    </Button>
  );
}
