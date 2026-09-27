"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Wraps a single trigger element (usually a Button) with a small glass tooltip. */
function Tooltip({
  children,
  className,
  label,
  side = "bottom",
}: {
  children: ReactElement;
  className?: string;
  label: ReactNode;
  side?: "bottom" | "left" | "right" | "top";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={200} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={10}>
          <TooltipPrimitive.Popup
            className={cn(
              "game-popover z-50 max-w-64 origin-(--transform-origin) rounded-[0.625rem] px-3 py-1.5 text-[0.8125rem] font-semibold duration-100 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className,
            )}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip };
