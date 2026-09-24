import type { PlayerViewState } from "@settersaga/game";
import Image from "next/image";

import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import { getPlayerColor } from "@/lib/game/view";

/** The player's portrait in a round frame filled with their color. Size comes from the parent's CSS. */
export function DockPortrait({ player }: { player: Pick<PlayerViewState, "seatIndex"> }) {
  const color = getPlayerColor(player);
  return (
    <span aria-hidden="true" className={`game-dock-portrait player-${color}`}>
      <Image
        alt=""
        className="game-dock-portrait-art"
        draggable={false}
        height={256}
        loading="eager"
        sizes="3rem"
        src={getPlayerPortraitPath(color)}
        width={256}
      />
    </span>
  );
}
