import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  type PlayerGameView,
  type PrivatePlayerState,
} from "@settersaga/game";

import { PIECE_ASSET_PATHS, ROBBER_ASSET_PATH } from "@/constants/game/board-assets";
import {
  ACTION_CARD_ASSET_PATHS,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";

import { getMissingResourcesReason } from "./resources";

/** What the turn slot of the dock offers the viewer right now. */
export type TurnControlState =
  | { kind: "end_turn" }
  | { kind: "roll" }
  | { art: string; kind: "task"; label: string }
  | { kind: "waiting" };

export function getTurnControlState(game: PlayerGameView): TurnControlState {
  const legal = game.legalActions;
  if (legal.discardCount !== null) {
    return { art: UNKNOWN_RESOURCE_CARD_ASSET_PATH, kind: "task", label: "Discard cards" };
  }
  if (legal.canRespondToTrade) {
    return { art: ACTION_CARD_ASSET_PATHS.trade, kind: "task", label: "Answer the offer" };
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
      return { art: ROBBER_ASSET_PATH, kind: "task", label: "Move the robber" };
    case "steal":
      return { art: ROBBER_ASSET_PATH, kind: "task", label: "Steal a card" };
    case "road_building":
      return { art: PIECE_ASSET_PATHS.road, kind: "task", label: "Place free roads" };
    case "setup_settlement":
      return { art: PIECE_ASSET_PATHS.settlement, kind: "task", label: "Place a settlement" };
    case "setup_road":
      return { art: PIECE_ASSET_PATHS.road, kind: "task", label: "Place a road" };
    default:
      return { kind: "waiting" };
  }
}

/** Why every build and trade tile is locked right now, if they are. */
export function getActionDockLockReason(game: PlayerGameView): string | undefined {
  const legal = game.legalActions;
  if (legal.discardCount !== null) {
    return "Discard your cards first";
  }
  if (game.activePlayerId !== game.viewerPlayerId) {
    return "Wait for your turn";
  }
  if (!legal.isRequiredActor) {
    return "Wait for the crew to discard";
  }
  if (legal.canRoll) {
    return "Roll the dice first";
  }
  switch (game.phase.kind) {
    case "build_and_trade":
      return undefined;
    case "move_robber":
      return "Move the robber first";
    case "steal":
      return "Pick a player to steal from first";
    case "road_building":
      return "Place your free roads first";
    default:
      return "Finish your opening placements first";
  }
}

export interface BuildPieceRule {
  label: string;
  noTargetReason: string;
  outOfPiecesReason: string;
  piece: "city" | "road" | "settlement";
  remaining: keyof PrivatePlayerState["piecesRemaining"];
  targets: "cityVertexKeys" | "roadEdgeKeys" | "settlementVertexKeys";
}

export const BUILD_PIECE_RULES: readonly BuildPieceRule[] = [
  {
    label: "Road",
    noTargetReason: "No open spot for a road",
    outOfPiecesReason: "No roads left",
    piece: "road",
    remaining: "roads",
    targets: "roadEdgeKeys",
  },
  {
    label: "Settlement",
    noTargetReason: "No open spot for a settlement",
    outOfPiecesReason: "No settlements left",
    piece: "settlement",
    remaining: "settlements",
    targets: "settlementVertexKeys",
  },
  {
    label: "City",
    noTargetReason: "No settlement to upgrade",
    outOfPiecesReason: "No cities left",
    piece: "city",
    remaining: "cities",
    targets: "cityVertexKeys",
  },
];

export function getBuildLockReason(
  rule: BuildPieceRule,
  game: PlayerGameView,
  me: PrivatePlayerState,
): string | null {
  if (me.piecesRemaining[rule.remaining] <= 0) {
    return rule.outOfPiecesReason;
  }
  return (
    getMissingResourcesReason(BUILD_COSTS[rule.piece], me.resources) ??
    (game.legalActions[rule.targets].length === 0 ? rule.noTargetReason : null)
  );
}

export function getDevelopmentCardLockReason(
  game: PlayerGameView,
  me: PrivatePlayerState,
): string | null {
  if (game.developmentCardSupply <= 0) {
    return "The deck is empty";
  }
  return (
    getMissingResourcesReason(DEVELOPMENT_CARD_COST, me.resources) ??
    (game.legalActions.canBuyDevelopmentCard ? null : "Not available right now")
  );
}
