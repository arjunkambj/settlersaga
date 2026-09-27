"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import copyIcon from "@iconify-icons/solar/copy-bold";
import dangerIcon from "@iconify-icons/solar/danger-circle-bold";
import { Icon } from "@iconify/react/offline";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

const FEEDBACK_MS = 2_400;

/**
 * Copies `value()` and says how it went in a bubble under the button, so the label (and the
 * button's width) never changes. With `share`, touch screens open the device's share sheet instead.
 */
export function CopyButton({
  children,
  className,
  copiedMessage,
  failedMessage,
  share = false,
  size,
  value,
  variant = "game-secondary",
}: {
  children: ReactNode;
  className?: string;
  copiedMessage: string;
  /** What to do instead, e.g. read the code out. */
  failedMessage: string;
  share?: boolean;
  size: "game-sm" | "game-md";
  value: () => string;
  variant?: "game-icon" | "game-secondary";
}) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const message = result === "copied" ? copiedMessage : result === "failed" ? failedMessage : "";

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const copy = async () => {
    const text = value();
    if (share && "share" in navigator && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ url: text });
        return;
      } catch (cause) {
        // Closing the share sheet is a choice, not a failure; anything else falls back to copying.
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }
    let next: "copied" | "failed" = "copied";
    try {
      // `navigator.clipboard` is missing on insecure origins, e.g. a phone testing over the LAN.
      await navigator.clipboard.writeText(text);
    } catch {
      next = "failed";
    }
    window.clearTimeout(resetTimer.current);
    setResult(next);
    resetTimer.current = window.setTimeout(() => setResult(null), FEEDBACK_MS);
  };

  return (
    <>
      <Tooltip.Root open={result !== null}>
        <Tooltip.Trigger
          render={
            <Button
              className={className}
              onClick={() => void copy()}
              size={size}
              variant={variant}
            />
          }
        >
          <Icon
            data-icon="inline-start"
            icon={result === "copied" ? checkIcon : result === "failed" ? dangerIcon : copyIcon}
          />
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner collisionPadding={16} side="bottom" sideOffset={10}>
            <Tooltip.Popup className="game-popover z-50 max-w-64 px-3 py-1.5 text-center text-sm font-bold outline-hidden motion-safe:animate-game-pop">
              {message}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
    </>
  );
}
