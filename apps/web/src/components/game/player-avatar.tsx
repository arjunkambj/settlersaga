import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A round portrait in a ring of the player's color (`.game-avatar`, game-hud.css), over initials
 * (or a bot mark) in case the image fails.
 */
export function PlayerAvatar({
  className,
  imageSize,
  isBot,
  name,
  src,
}: {
  /** Size, ring width and initials font size. */
  className: string;
  /** Rendered width in CSS pixels; the optimizer serves it at 1x and 2x. */
  imageSize: number;
  isBot: boolean;
  name: string;
  src?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("game-avatar", className)}>
      <span className="absolute">
        {isBot ? <Icon className="size-[1.35em]" icon={botIcon} /> : getPlayerInitials(name)}
      </span>
      {src ? (
        <Image
          alt=""
          className="relative size-full object-cover"
          draggable={false}
          height={imageSize}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={src}
          // Profile photos come from the sign-in provider; only the game's own art is resized.
          unoptimized={!src.startsWith("/")}
          width={imageSize}
        />
      ) : null}
    </span>
  );
}

function getPlayerInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
