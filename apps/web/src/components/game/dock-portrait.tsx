import type { PlayerViewState } from "@settersaga/game";
import Image from "next/image";

import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import { getPlayerPortraitSrc } from "@/lib/game/hud-portraits";
import { getPlayerColor } from "@/lib/game/view";

import { usePortraitSources } from "./portrait-sources-context";

/**
 * The player's portrait in a round frame filled with their color: the same picture the crew list
 * shows for them. Size comes from the parent's CSS.
 */
export function DockPortrait({
  player,
}: {
  player: Pick<PlayerViewState, "isBot" | "isViewer" | "seatIndex">;
}) {
  const sources = usePortraitSources();
  const color = getPlayerColor(player);
  const src = sources ? getPlayerPortraitSrc(player, sources) : getPlayerPortraitPath(color);
  return (
    <span aria-hidden="true" className={`game-dock-portrait player-${color}`}>
      <Image
        alt=""
        className="game-dock-portrait-art"
        draggable={false}
        height={256}
        loading="eager"
        sizes="3rem"
        src={src}
        // Profile photos come from the sign-in provider; only the game's own art is resized.
        unoptimized={!src.startsWith("/")}
        width={256}
      />
    </span>
  );
}
