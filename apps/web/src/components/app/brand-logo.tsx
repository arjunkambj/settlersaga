import Image from "next/image";

import {
  SETTERSAGA_MARK_ASSET_PATH,
  SETTERSAGA_WORDMARK_ASSET_PATH,
} from "@/constants/game/brand-assets";
import { cn } from "@/lib/utils";

export function BrandWordmark({
  className,
  priority = false,
}: {
  className?: string;
  /** Preload it: the wordmark is the first thing a menu screen shows. */
  priority?: boolean;
}) {
  return (
    <Image
      alt="SetterSaga"
      className={cn("h-auto w-full object-contain drop-shadow-lg", className)}
      height={311}
      preload={priority}
      // Menus draw it 224-288px wide, and 416px on large screens (lg:w-[26rem]), so the
      // optimizer never needs the full-size source. `h-auto` keeps the file's own shape.
      sizes="(min-width: 1024px) 416px, 288px"
      src={SETTERSAGA_WORDMARK_ASSET_PATH}
      width={1200}
    />
  );
}

/**
 * The hex mark on its own: the small lockup for tight spots (the phone game header), where the
 * wordmark's letters would shrink below a readable size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      alt="SetterSaga"
      className={cn("aspect-square h-auto object-contain", className)}
      height={512}
      sizes="48px"
      src={SETTERSAGA_MARK_ASSET_PATH}
      width={512}
    />
  );
}
