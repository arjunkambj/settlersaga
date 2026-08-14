import Image from "next/image";

import {
  SETTERSAGA_MARK_ASSET_PATH,
  SETTERSAGA_WORDMARK_ASSET_PATH,
} from "@/constants/game/brand-assets";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      alt="SetterSaga"
      className={cn("size-14 object-contain drop-shadow-lg", className)}
      height={921}
      priority={priority}
      src={SETTERSAGA_MARK_ASSET_PATH}
      width={921}
    />
  );
}

export function BrandWordmark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      alt="SetterSaga"
      className={cn("h-auto w-full object-contain drop-shadow-lg", className)}
      height={605}
      priority={priority}
      src={SETTERSAGA_WORDMARK_ASSET_PATH}
      width={558}
    />
  );
}
