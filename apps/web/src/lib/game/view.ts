import type { GamePhase } from "@settersaga/game";

export interface PhaseCopy {
  detail: string;
  title: string;
}

export function getPlayerHudOrder<T extends { isViewer: boolean }>(players: readonly T[]): T[] {
  const opponents: T[] = [];
  const viewers: T[] = [];

  for (const player of players) {
    (player.isViewer ? viewers : opponents).push(player);
  }

  return [...opponents, ...viewers];
}

export function getPhaseCopy(
  phase: GamePhase,
  isViewerTurn: boolean,
  activePlayerName: string,
): PhaseCopy {
  const owner = isViewerTurn ? "Your" : `${activePlayerName}’s`;

  switch (phase.kind) {
    case "setup_settlement":
      return {
        detail: isViewerTurn
          ? "Choose a glowing corner for your settlement."
          : `${activePlayerName} is choosing a settlement.`,
        title: `${owner} Opening Settlement`,
      };
    case "setup_road":
      return {
        detail: isViewerTurn
          ? "Choose a glowing edge connected to your new settlement."
          : `${activePlayerName} is placing a road.`,
        title: `${owner} Opening Road`,
      };
    case "roll":
      return {
        detail: isViewerTurn ? "Roll the dice to begin your turn." : "Waiting for the dice roll.",
        title: `${owner} Roll`,
      };
    case "discard":
      return {
        detail: "Players holding too many cards must return half to the bank.",
        title: "Robber Discard",
      };
    case "move_robber":
      return {
        detail: isViewerTurn ? "Choose a highlighted terrain tile." : "The robber is on the move.",
        title: "Move the Robber",
      };
    case "steal":
      return {
        detail: isViewerTurn ? "Choose a neighboring player." : "A resource is being stolen.",
        title: "Choose a Player",
      };
    case "road_building":
      return {
        detail: isViewerTurn
          ? `Choose ${phase.remainingRoads === 1 ? "one more free road" : "two free roads"}.`
          : `${activePlayerName} is placing free roads.`,
        title: "Road Building",
      };
    case "build_and_trade":
      return {
        detail: isViewerTurn
          ? "Build, trade with the bank, or finish your turn."
          : `${activePlayerName} is building and trading.`,
        title: `${owner} Build Phase`,
      };
    case "finished":
      return { detail: "The island has a new champion.", title: "Game Complete" };
  }
}
