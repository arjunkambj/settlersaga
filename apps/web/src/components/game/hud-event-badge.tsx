import closeIcon from "@iconify-icons/solar/close-circle-bold";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import startIcon from "@iconify-icons/solar/flag-bold";
import tradeIcon from "@iconify-icons/solar/hand-shake-bold";
import discardIcon from "@iconify-icons/solar/inbox-out-bold";
import pauseIcon from "@iconify-icons/solar/pause-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import Image from "next/image";

import { PIECE_ASSET_PATHS, ROBBER_ASSET_PATH } from "@/constants/game/board-assets";
import {
  DEVELOPMENT_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
} from "@/constants/game/card-assets";
import { END_TURN_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import type { RoomEventView } from "@/lib/game/types";

import { DieFace } from "./die-face";

const BANK_ART_PATH = "/game-assets/ui/bank.png";

type EventBadge = { art: string } | { die: true } | { icon: IconifyIcon };

/** Game art where the table already has a picture for the move; a glyph for the rest. */
const EVENT_BADGES: Readonly<Record<RoomEventView["kind"], EventBadge>> = {
  bot_control_started: { icon: botIcon },
  build_city: { art: PIECE_ASSET_PATHS.city },
  buy_development_card: { art: DEVELOPMENT_CARD_BACK_ASSET_PATH },
  cancel_trade: { icon: closeIcon },
  confirm_trade: { icon: tradeIcon },
  discard: { icon: discardIcon },
  end_turn: { art: END_TURN_ICON_ASSET_PATH },
  game_paused: { icon: pauseIcon },
  game_resumed: { icon: playIcon },
  game_started: { icon: startIcon },
  move_robber: { art: ROBBER_ASSET_PATH },
  move_robber_and_steal: { art: ROBBER_ASSET_PATH },
  place_road: { art: PIECE_ASSET_PATHS.road },
  place_settlement: { art: PIECE_ASSET_PATHS.settlement },
  play_knight: { art: DEVELOPMENT_CARD_ASSET_PATHS.knight },
  play_monopoly: { art: DEVELOPMENT_CARD_ASSET_PATHS.monopoly },
  play_road_building: { art: DEVELOPMENT_CARD_ASSET_PATHS["road-building"] },
  play_year_of_plenty: { art: DEVELOPMENT_CARD_ASSET_PATHS["year-of-plenty"] },
  propose_trade: { icon: tradeIcon },
  respond_trade: { icon: tradeIcon },
  roll: { die: true },
  steal: { art: ROBBER_ASSET_PATH },
  trade_bank: { art: BANK_ART_PATH },
};

/** A round badge that says what kind of move a log line is. */
export function EventKindBadge({ kind }: { kind: RoomEventView["kind"] }) {
  const badge = EVENT_BADGES[kind];
  return (
    <span aria-hidden="true" className="game-log-badge">
      {"art" in badge ? (
        <Image alt="" draggable={false} height={32} src={badge.art} width={32} />
      ) : "die" in badge ? (
        <DieFace tone="ember" value={5} />
      ) : (
        <Icon icon={badge.icon} />
      )}
    </span>
  );
}
