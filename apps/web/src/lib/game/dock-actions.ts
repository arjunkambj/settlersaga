import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  RESOURCE_ORDER,
  totalResources,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
} from "@settersaga/game";

import { ROBBER_ASSET_PATH } from "@/constants/game/board-assets";
import {
  ACTION_CARD_ASSET_PATHS,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";

import { RESOURCE_LABELS } from "@/constants/game/labels";

import type { PhaseCopy } from "./dock-phase-copy";
import { eventActionLabel, noticeText } from "./event-log-model";
import { getMissingInventory, getMissingResourcesReason } from "./resources";
import type { RoomEventView } from "./types";

/**
 * What the turn slot of the dock offers the viewer right now. A task is a short, one-line pointer
 * to where the move is made ("Pick a corner" on the board, "Reply to offer" in the sheet); the
 * turn card above says what the move is.
 */
export type TurnControlState =
  | { kind: "end_turn" }
  | { kind: "roll" }
  | { art: string; kind: "task"; label: string }
  | { kind: "waiting" };

export function getTurnControlState(game: PlayerGameView): TurnControlState {
  const legal = game.legalActions;
  if (legal.discardCount !== null) {
    return { art: UNKNOWN_RESOURCE_CARD_ASSET_PATH, kind: "task", label: "Pick cards" };
  }
  if (legal.canRespondToTrade) {
    return { art: ACTION_CARD_ASSET_PATHS.trade, kind: "task", label: "Reply to offer" };
  }
  if (game.activePlayerId !== game.viewerPlayerId || !legal.isRequiredActor) {
    return { kind: "waiting" };
  }
  if (legal.canRoll) {
    return { kind: "roll" };
  }
  switch (game.phase.kind) {
    case "build_and_trade":
      return { kind: "end_turn" };
    case "move_robber":
      return { art: ROBBER_ASSET_PATH, kind: "task", label: "Pick a tile" };
    case "steal":
      return { art: ROBBER_ASSET_PATH, kind: "task", label: "Pick a player" };
    case "road_building":
      return { art: ACTION_CARD_ASSET_PATHS.road, kind: "task", label: "Pick a path" };
    case "setup_settlement":
      return { art: ACTION_CARD_ASSET_PATHS.settlement, kind: "task", label: "Pick a corner" };
    case "setup_road":
      return { art: ACTION_CARD_ASSET_PATHS.road, kind: "task", label: "Pick a path" };
    default:
      return { kind: "waiting" };
  }
}

/**
 * Every panel-wide lock: the sentence for tooltips and callouts, and the few words a tile shows
 * beside its lock ("Roll first").
 */
const DOCK_LOCKS = {
  discard: { note: "Discard first", reason: "Discard your cards first" },
  otherTurn: { note: "Not your turn", reason: "It's not your turn yet" },
  crewDiscarding: { note: "Wait a moment", reason: "Waiting for others to discard" },
  roll: { note: "Roll first", reason: "Roll the dice first" },
  robber: { note: "Move robber", reason: "Move the robber first" },
  steal: { note: "Steal first", reason: "Pick someone to steal from first" },
  freeRoads: { note: "Place roads", reason: "Place your free roads first" },
  opening: { note: "Opening round", reason: "Place your starting pieces first" },
} as const satisfies Record<string, { note: string; reason: string }>;

/** The panel-wide lock before this turn's roll. */
export const ROLL_FIRST_REASON = DOCK_LOCKS.roll.reason;

/** The few words a locked tile shows for a lock sentence ("Roll first"). */
export function getLockNote(reason: string): string {
  return Object.values(DOCK_LOCKS).find((lock) => lock.reason === reason)?.note ?? "Not now";
}

/** Why every build and trade tile is locked right now, if they are. */
export function getActionDockLockReason(game: PlayerGameView): string | undefined {
  const legal = game.legalActions;
  if (legal.discardCount !== null) {
    return DOCK_LOCKS.discard.reason;
  }
  if (game.activePlayerId !== game.viewerPlayerId) {
    return DOCK_LOCKS.otherTurn.reason;
  }
  if (!legal.isRequiredActor) {
    return DOCK_LOCKS.crewDiscarding.reason;
  }
  if (legal.canRoll) {
    return DOCK_LOCKS.roll.reason;
  }
  switch (game.phase.kind) {
    case "build_and_trade":
      return undefined;
    case "move_robber":
      return DOCK_LOCKS.robber.reason;
    case "steal":
      return DOCK_LOCKS.steal.reason;
    case "road_building":
      return DOCK_LOCKS.freeRoads.reason;
    default:
      return DOCK_LOCKS.opening.reason;
  }
}

export interface BuildPieceRule {
  label: string;
  /** The few words a tile shows when the board has no place for the piece ("No open corner"). */
  noTargetNote: string;
  noTargetReason: string;
  outOfPiecesReason: string;
  piece: "city" | "road" | "settlement";
  remaining: keyof PrivatePlayerState["piecesRemaining"];
  targets: "cityVertexKeys" | "roadEdgeKeys" | "settlementVertexKeys";
}

export const BUILD_PIECE_RULES: readonly BuildPieceRule[] = [
  {
    label: "Road",
    noTargetNote: "No open path",
    noTargetReason: "There's no open path for a road",
    outOfPiecesReason: "You've built all your roads",
    piece: "road",
    remaining: "roads",
    targets: "roadEdgeKeys",
  },
  {
    label: "Settlement",
    noTargetNote: "No open corner",
    noTargetReason: "There's no open corner for a settlement. Build a road out first",
    outOfPiecesReason: "You've built all your settlements",
    piece: "settlement",
    remaining: "settlements",
    targets: "settlementVertexKeys",
  },
  {
    label: "City",
    noTargetNote: "No settlement",
    noTargetReason: "You need a settlement to upgrade",
    outOfPiecesReason: "You've built all your cities",
    piece: "city",
    remaining: "cities",
    targets: "cityVertexKeys",
  },
];

/**
 * How a build or development card tile reads right now:
 * - ready: it can be used now;
 * - short: the player can't pay for it. `note` says what is missing in a few words ("Need 1
 *   Brick") and `reason` in full for the tooltip and callout;
 * - blocked: something other than the price stops it; `note` is a few words for the tile
 *   ("No open corner") and `reason` the full sentence. `by` says whether the supply ran out
 *   ("None left", which stands whatever the phase) or the board or the phase offers nothing right
 *   now ("No open corner", "Not now").
 */
export type ActionTileStatus =
  | { by: "board" | "supply"; kind: "blocked"; note: string; reason: string }
  | { kind: "ready" }
  | { kind: "short"; note: string; reason: string };

/** More kinds of card than this and the "Need" line counts the cards instead of naming them. */
const NEED_NOTE_KINDS = 2;

/**
 * What a price still needs, short enough for one line of a tile: "Need 1 Brick", "Need 2 Stone,
 * 1 Wheat", or "Need 4 more cards" when three or more kinds are missing.
 */
export function getNeedNote(missing: Readonly<ResourceInventory>): string {
  const kinds = RESOURCE_ORDER.filter((resource) => missing[resource] > 0);
  if (kinds.length > NEED_NOTE_KINDS) {
    return `Need ${totalResources(missing)} more cards`;
  }
  return `Need ${kinds.map((resource) => `${missing[resource]} ${RESOURCE_LABELS[resource]}`).join(", ")}`;
}

function getPriceStatus(
  cost: Readonly<ResourceInventory>,
  resources: Readonly<ResourceInventory>,
): Extract<ActionTileStatus, { kind: "short" }> | null {
  const reason = getMissingResourcesReason(cost, resources);
  return reason
    ? { kind: "short", note: getNeedNote(getMissingInventory(cost, resources)), reason }
    : null;
}

/**
 * A building tile's status. The single place the checks and their order live: out of pieces, then
 * the price, then an open spot on the board.
 */
export function getBuildTileStatus(
  rule: BuildPieceRule,
  game: PlayerGameView,
  me: PrivatePlayerState,
): ActionTileStatus {
  if (me.piecesRemaining[rule.remaining] <= 0) {
    return { by: "supply", kind: "blocked", note: "None left", reason: rule.outOfPiecesReason };
  }
  const short = getPriceStatus(BUILD_COSTS[rule.piece], me.resources);
  if (short) {
    return short;
  }
  return game.legalActions[rule.targets].length === 0
    ? { by: "board", kind: "blocked", note: rule.noTargetNote, reason: rule.noTargetReason }
    : { kind: "ready" };
}

/** The development card tile's status: an empty deck, then the price, then the buy check. */
export function getDevelopmentCardTileStatus(
  game: PlayerGameView,
  me: PrivatePlayerState,
): ActionTileStatus {
  if (game.developmentCardSupply <= 0) {
    return {
      by: "supply",
      kind: "blocked",
      note: "Deck empty",
      reason: "No development cards are left",
    };
  }
  const short = getPriceStatus(DEVELOPMENT_CARD_COST, me.resources);
  if (short) {
    return short;
  }
  return game.legalActions.canBuyDevelopmentCard
    ? { kind: "ready" }
    : { by: "board", kind: "blocked", note: "Not now", reason: "You can't buy one right now" };
}

/** How many pieces are left to build before they run low; below this every tile says so. */
const PIECES_LOW_AT = 2;

/**
 * A quiet caption for a building tile: how many of the piece are left ("5 left", "Last one").
 * `low` is set once they run low; the wide rows (md up) show every count, and the phone tray only
 * the low ones.
 */
export function getPiecesLeftCaption(left: number): { low: boolean; text: string } {
  return {
    low: left <= PIECES_LOW_AT,
    text: left === 1 ? "Last one" : `${left} left`,
  };
}

/** What a roll just paid the viewer, shown in the phase line until the next move. */
export interface RollOutcome {
  /** The move the roll was; the outcome only stands while it is still the latest one. */
  actionNumber: number;
  gains: ResourceInventory;
  sum: number;
}

const ROLL_TEXT = /^rolled (\d+) \+ (\d+) \((\d+)\)\.\s*(.*)$/i;

function withoutFinalStop(text: string): string {
  return text.replace(/\.$/, "");
}

/**
 * The latest move in a few words, for the phase line where no log is in view: "You rolled 8:
 * +1 Wood", "Peter Bot rolled 6: you got +1 Wheat", "Mira ended the turn". The viewer reads as
 * "you" throughout; a table notice ("Game paused") stays as it is.
 */
export function summarizeLatestMove(
  event: Pick<RoomEventView, "actorPlayerId" | "text"> | undefined,
  players: PlayerGameView["players"],
): string | null {
  if (!event) {
    return null;
  }
  const text = noticeText(event.text);
  const actor = players.find((player) => player.id === event.actorPlayerId);
  const label = actor ? eventActionLabel(text, actor.displayName) : text;
  if (!actor || label === text) {
    return withoutFinalStop(text);
  }
  const viewer = players.find((player) => player.isViewer);
  const who = actor.isViewer ? "You" : actor.displayName;

  const roll = ROLL_TEXT.exec(label);
  if (roll) {
    const [, , , sum, production = ""] = roll;
    const viewerShare = viewer
      ? withoutFinalStop(production)
          .split(", ")
          .find((share) => share.startsWith(`${viewer.displayName} +`))
      : undefined;
    const gains = viewerShare?.slice((viewer?.displayName.length ?? 0) + 1).replaceAll(" +", ", +");
    if (actor.isViewer) {
      return `You rolled ${sum}: ${gains ?? "nothing for you"}`;
    }
    return gains ? `${who} rolled ${sum}: you got ${gains}` : `${who} rolled ${sum}`;
  }

  const rest = withoutFinalStop(viewer ? label.replaceAll(viewer.displayName, "you") : label);
  return `${who} ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
}

/** "+1 Wood, +2 Brick", or null when nothing was gained. */
export function formatGains(gains: Readonly<ResourceInventory>): string | null {
  const parts = RESOURCE_ORDER.flatMap((resource) =>
    gains[resource] > 0 ? [`+${gains[resource]} ${RESOURCE_LABELS[resource]}`] : [],
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * The phase copy for the dock. During build and trade the detail line says what the roll just
 * gave the viewer, then what they can actually do, instead of a generic "build, trade or end".
 */
export function getDockPhaseCopy(
  game: PlayerGameView,
  base: PhaseCopy,
  rollOutcome: RollOutcome | null = null,
): PhaseCopy {
  if (game.phase.kind !== "build_and_trade") {
    return base;
  }
  const isViewerTurn = game.activePlayerId === game.viewerPlayerId;
  if (rollOutcome && rollOutcome.actionNumber === game.actionNumber) {
    const gains = formatGains(rollOutcome.gains);
    return {
      ...base,
      detail: gains
        ? `Rolled ${rollOutcome.sum}: ${isViewerTurn ? "" : "you got "}${gains}`
        : `Rolled ${rollOutcome.sum}: nothing for you`,
    };
  }
  const me = game.players.find((player) => player.isViewer);
  if (!isViewerTurn || !me?.isViewer || !game.legalActions.isRequiredActor) {
    return base;
  }
  if (game.tradeOffer) {
    return { ...base, detail: "Waiting for replies to your offer" };
  }
  return { ...base, detail: getBuildOptionsLine(game, me) };
}

const BUILD_NAMES: Readonly<Record<BuildPieceRule["piece"], string>> = {
  city: "city",
  road: "road",
  settlement: "settlement",
};

/** "Build a road or buy a dev card", or the nearest thing worth trading for. */
function getBuildOptionsLine(game: PlayerGameView, me: PrivatePlayerState): string {
  const pieces = BUILD_PIECE_RULES.filter(
    (rule) => getBuildTileStatus(rule, game, me).kind === "ready",
  ).map((rule) => BUILD_NAMES[rule.piece]);
  const canBuyCard = getDevelopmentCardTileStatus(game, me).kind === "ready";
  const options = [
    pieces.length > 0 ? `Build a ${joinWithOr(pieces)}` : null,
    canBuyCard ? `${pieces.length > 0 ? "buy" : "Buy"} a dev card` : null,
  ].filter((option) => option !== null);
  if (options.length > 0) {
    return options.join(" or ");
  }

  // Nothing is ready: name the goal that is fewest cards away (one or two), if there is one.
  const hasSettlement = game.board.buildings.some(
    (building) => building.playerId === me.id && building.kind === "settlement",
  );
  const goals = [
    {
      cost: BUILD_COSTS.city,
      name: "build a city",
      open: hasSettlement && me.piecesRemaining.cities > 0,
    },
    { cost: DEVELOPMENT_CARD_COST, name: "buy a dev card", open: game.developmentCardSupply > 0 },
    { cost: BUILD_COSTS.road, name: "build a road", open: me.piecesRemaining.roads > 0 },
  ];
  const nearest = goals
    .filter((goal) => goal.open)
    .map((goal) => ({ ...goal, missing: getMissingInventory(goal.cost, me.resources) }))
    .filter((goal) => totalResources(goal.missing) <= 2)
    .sort((left, right) => totalResources(left.missing) - totalResources(right.missing))[0];
  if (nearest && totalResources(nearest.missing) > 0) {
    const short = RESOURCE_ORDER.filter((resource) => nearest.missing[resource] > 0);
    const [only] = short;
    return short.length === 1 && only
      ? `Trade for ${nearest.missing[only]} ${RESOURCE_LABELS[only]} to ${nearest.name}`
      : `Trade for ${totalResources(nearest.missing)} cards to ${nearest.name}`;
  }
  return "Nothing to build yet. Trade or end your turn";
}

function joinWithOr(words: readonly string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}
