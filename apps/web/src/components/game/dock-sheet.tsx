"use client";

import closeIcon from "@iconify-icons/solar/close-circle-bold";
import { Icon } from "@iconify/react/offline";
import type { ReactNode, Ref } from "react";

import { Button } from "@/components/ui/button";

import { HandDockPortal } from "./hand-dock";

/**
 * The panel every dock sheet (trade composer, trade offer, discard) uses: a clean title centered
 * between equal side slots, the body, and a footer whose buttons share the width equally. It
 * renders into the sheet slot above the dock, so the hand stays in view.
 */
export function DockSheet({
  children,
  footer,
  id,
  onClose,
  sheetRef,
  title,
  titleId,
}: {
  children: ReactNode;
  footer?: ReactNode;
  id: string;
  onClose?: () => void;
  sheetRef?: Ref<HTMLElement>;
  title: string;
  titleId: string;
}) {
  return (
    <HandDockPortal>
      <section
        aria-labelledby={titleId}
        className="game-dock-sheet motion-safe:animate-game-rise"
        id={id}
        ref={sheetRef}
        tabIndex={-1}
      >
        <header className="game-dock-sheet-head">
          <h2 className="game-heading" id={titleId}>
            {title}
          </h2>
          {onClose ? (
            <Button
              aria-label="Close"
              className="game-dock-sheet-close"
              onClick={onClose}
              size="game-md"
              variant="game-icon"
            >
              <Icon aria-hidden="true" icon={closeIcon} />
            </Button>
          ) : null}
        </header>
        {children}
        {footer ? <footer className="game-dock-sheet-foot">{footer}</footer> : null}
      </section>
    </HandDockPortal>
  );
}

/** A line under a sheet's body that says what is ready, missing or happening. */
export function DockStatus({
  children,
  id,
  tone = "neutral",
}: {
  children: ReactNode;
  id?: string;
  tone?: "error" | "neutral" | "ready";
}) {
  return (
    <p aria-live="polite" className="game-dock-status" data-tone={tone} id={id}>
      {children}
    </p>
  );
}
