import type { PlayerGameView } from "@settersaga/game";

export interface PhaseCopy {
  detail: string;
  /**
   * "Your turn", or another player's name and the rest ("’s turn"). On screen the name shortens
   * before the rest does, so the title keeps to one line whatever the name.
   */
  title: { name: string | null; rest: string };
}

export function phaseTitleText({ name, rest }: PhaseCopy["title"]): string {
  return `${name ?? ""}${rest}`;
}

/**
 * Whose turn it is, and what is happening or what the viewer should do next. The title names the
 * player on turn, so the detail line doesn't repeat it (long names would wrap it onto more lines).
 */
export function getPhaseCopy(game: PlayerGameView): PhaseCopy {
  const nameOf = (playerId: string | null) =>
    game.players.find((player) => player.id === playerId)?.displayName ?? "A player";
  const isViewerTurn = game.activePlayerId === game.viewerPlayerId;
  const name = nameOf(game.activePlayerId);
  const title = isViewerTurn ? { name: null, rest: "Your turn" } : { name, rest: "’s turn" };
  const phase = game.phase;

  switch (phase.kind) {
    case "setup_settlement":
      return {
        detail: isViewerTurn
          ? `Place your ${phase.setupIndex < game.players.length ? "first" : "second"} settlement`
          : "Placing a settlement…",
        title,
      };
    case "setup_road":
      return {
        detail: isViewerTurn ? "Add a road next to your new settlement" : "Placing a road…",
        title,
      };
    case "roll":
      return { detail: isViewerTurn ? "Roll the dice" : "About to roll…", title };
    case "discard": {
      const discardCount = game.legalActions.discardCount;
      if (discardCount !== null) {
        return {
          detail: `A 7 was rolled. Discard ${discardCount} ${discardCount === 1 ? "card" : "cards"}`,
          title,
        };
      }
      const [onlyDiscarder] = phase.pending;
      return {
        detail:
          phase.pending.length === 1 && onlyDiscarder
            ? `Waiting for ${nameOf(onlyDiscarder.playerId)} to discard…`
            : `Waiting for ${phase.pending.length} players to discard…`,
        title,
      };
    }
    case "move_robber":
      return {
        detail: isViewerTurn ? "Move the robber to a new tile" : "Moving the robber…",
        title,
      };
    case "steal":
      return {
        detail: isViewerTurn ? "Pick a player to steal from" : "Choosing a card to steal…",
        title,
      };
    case "road_building":
      return {
        detail: isViewerTurn
          ? `Place ${phase.remainingRoads === 1 ? "1 more free road" : `${phase.remainingRoads} free roads`}`
          : "Building free roads…",
        title,
      };
    case "build_and_trade":
      return {
        detail: isViewerTurn ? "Build, trade or end your turn" : "Building and trading…",
        title,
      };
    case "finished":
      return game.winnerPlayerId === game.viewerPlayerId
        ? { detail: "The island is yours", title: { name: null, rest: "You win!" } }
        : {
            detail: "Better luck next game",
            // A no-break space: a plain one would be trimmed from the start of the title's end.
            title: { name: nameOf(game.winnerPlayerId), rest: "\u00a0wins!" },
          };
  }
}
