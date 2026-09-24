import type { BotDifficulty, PlayerViewState } from "@settersaga/game";

import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import { BOT_DIFFICULTY_DETAILS } from "@/lib/lobby/bot-difficulty";

import { getPlayerColor } from "./view";

export interface PortraitSources {
  /** Every bot at the table plays at the room's difficulty. */
  botDifficulty: BotDifficulty;
  viewerProfileImageUrl: string | null;
}

/** The viewer's profile photo, a bot's difficulty art, or the seat's emblem. */
export function getPlayerPortraitSrc(
  player: Pick<PlayerViewState, "isBot" | "isViewer" | "seatIndex">,
  { botDifficulty, viewerProfileImageUrl }: PortraitSources,
): string {
  if (player.isViewer && viewerProfileImageUrl) {
    return viewerProfileImageUrl;
  }
  if (player.isBot) {
    return BOT_DIFFICULTY_DETAILS[botDifficulty].artSrc;
  }
  return getPlayerPortraitPath(getPlayerColor(player));
}
