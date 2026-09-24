import { totalResources } from "./resources";
import { getLegalActions, requirePlayer } from "./rules";
import type { GameState, PlayerGameView, PlayerId, PlayerViewState } from "./types";

export function toPlayerView(state: GameState, viewerPlayerId: PlayerId): PlayerGameView {
  requirePlayer(state, viewerPlayerId);

  const {
    balancedDiceBag: _balancedDiceBag,
    bank,
    developmentDeck,
    randomIndex: _randomIndex,
    seed: _seed,
    players,
    ...publicState
  } = state;
  const isFinished = state.phase.kind === "finished";
  const playerViews: PlayerViewState[] = players.map((player) => {
    const resourceCount = totalResources(player.resources);

    return player.id === viewerPlayerId
      ? { ...player, isViewer: true, resourceCount }
      : {
          developmentCardCount: player.developmentCards.length,
          displayName: player.displayName,
          id: player.id,
          isBot: player.isBot,
          isViewer: false,
          piecesRemaining: { ...player.piecesRemaining },
          playedDevelopmentCards: [...player.playedDevelopmentCards],
          revealedVictoryPointCards: isFinished
            ? player.developmentCards.filter((card) => card === "victory-point").length
            : null,
          resourceCount,
          seatIndex: player.seatIndex,
          victoryPoints: player.victoryPoints,
        };
  });

  return {
    ...publicState,
    bank: state.settings.hideBankCards ? null : { ...bank },
    developmentCardSupply: developmentDeck.length,
    legalActions: getLegalActions(state, viewerPlayerId, {
      hideBankStock: state.settings.hideBankCards,
    }),
    players: playerViews,
    viewerPlayerId,
  };
}
