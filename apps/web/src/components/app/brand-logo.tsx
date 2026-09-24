import Image from "next/image";

import { SETTERSAGA_WORDMARK_ASSET_PATH } from "@/constants/game/brand-assets";
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
      // Every screen draws it 256px wide at most, so the optimizer never needs the 1200px source.
      sizes="256px"
      src={SETTERSAGA_WORDMARK_ASSET_PATH}
      width={1200}
    />
  );
}
