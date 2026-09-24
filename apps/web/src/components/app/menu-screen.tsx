import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/app/brand-logo";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import { cn } from "@/lib/utils";

/**
 * A full-screen game menu: the island backdrop and one panel with the wordmark riding its top
 * edge, an optional ribbon title, the screen's content, then its buttons stacked full width.
 */
export function MenuScreen({
  actions,
  children,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  title?: string;
}) {
  return (
    <main
      className="relative flex min-h-dvh items-center justify-center px-4 pt-24 pb-10 sm:px-6"
      id="main-content"
    >
      <SceneBackdrop />
      <section className="game-menu-panel flex w-full max-w-sm flex-col items-center gap-5 px-6 pt-2 pb-6 text-center motion-safe:animate-game-pop sm:max-w-md">
        <BrandWordmark className="-mt-16 w-56 sm:w-64" priority />
        {title ? <h1 className="game-ribbon">{title}</h1> : null}
        {children}
        {actions ? <div className="flex w-full flex-col gap-3">{actions}</div> : null}
      </section>
    </main>
  );
}

/** The body copy of a menu screen. */
export function MenuScreenText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-base font-medium text-balance text-muted-foreground", className)}>
      {children}
    </p>
  );
}
