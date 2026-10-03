import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/app/brand-logo";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import { cn } from "@/lib/utils";

/**
 * A full-screen game menu: the island backdrop, the wordmark standing clear above one panel, an
 * optional title, the screen's content, then its buttons stacked full width.
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
      className="relative flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6"
      id="main-content"
    >
      <SceneBackdrop />
      <div className="flex w-full max-w-sm flex-col items-center gap-4 motion-safe:animate-game-pop sm:max-w-md lg:max-w-lg lg:gap-5">
        <BrandWordmark className="w-56 sm:w-72 lg:w-[26rem]" priority />
        <section className="game-menu-panel flex w-full flex-col items-center gap-5 px-6 py-6 text-center lg:gap-6 lg:px-10 lg:py-8">
          {title ? <h1 className="game-heading text-[1.75rem] lg:text-[2rem]">{title}</h1> : null}
          {children}
          {actions ? <div className="flex w-full flex-col gap-3">{actions}</div> : null}
        </section>
      </div>
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
    <p className={cn("text-base font-medium text-balance text-ui-text-soft lg:text-lg", className)}>
      {children}
    </p>
  );
}
