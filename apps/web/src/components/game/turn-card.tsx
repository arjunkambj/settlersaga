import type { PlayerGameView, PrivatePlayerState } from "@settersaga/game";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import pauseIcon from "@iconify-icons/solar/pause-bold";
import { Icon } from "@iconify/react/offline";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import { nameFit } from "@/lib/app/name-fit";
import { phaseTitleText, type PhaseCopy } from "@/lib/game/dock-phase-copy";
import { getPlayerColor } from "@/lib/game/view";

import { DiceRoll } from "./die-face";
import { DockPortrait } from "./dock-portrait";

/**
 * The turn card: whose turn it is and the one thing to do now, with this turn's dice once they
 * are rolled. It sits beside the action it drives: at the foot of the rail above the clock and
 * the Roll or End turn button (xl), at the dock's right end with them (below xl), and above the
 * hand on phones, where it also says what just happened as a quiet last line
 * (styles/game-layout.css). It carries every prompt the turn has (setup steps, a picked build
 * with its Cancel, the robber, discards, trade replies) and says when the game is paused, a bot
 * is playing or the game is over.
 */
export function TurnCard({
  botThinking,
  game,
  isHost,
  isPaused,
  latestMove = null,
  me,
  onCancelPlacement,
  phaseCopy,
  phaseHeadingRef,
  placementLabel = null,
}: {
  botThinking: boolean;
  game: PlayerGameView;
  isHost: boolean;
  isPaused: boolean;
  /** What just happened, in a few words ("Peter Bot rolled 6"). Shown on phones only. */
  latestMove?: string | null;
  me: PrivatePlayerState;
  onCancelPlacement(): void;
  phaseCopy: PhaseCopy;
  phaseHeadingRef: Ref<HTMLHeadingElement>;
  /** The spot the viewer is picking for a piece they chose to build, beside its Cancel. */
  placementLabel?: string | null;
}) {
  const phase = game.phase;
  const isFinished = phase.kind === "finished";
  const spotlightPlayer =
    game.players.find(
      (player) => player.id === (isFinished ? game.winnerPlayerId : game.activePlayerId),
    ) ?? me;
  // A long title shrinks a step. The name is already short (a long one by its first word); if
  // it still can't fit, only the name shortens and "’s turn" stays whole.
  const titleName = phaseCopy.title.name ?? null;
  const titleText = phaseTitleText(phaseCopy.title);
  // The dice show once this turn's roll is in (a knight played before rolling keeps them hidden).
  const rolledThisTurn =
    phase.kind === "build_and_trade" ||
    phase.kind === "discard" ||
    ("resumePhase" in phase && phase.resumePhase === "build_and_trade");
  const paused = isPaused && !isFinished;
  const botPlaying = botThinking && !paused && !isFinished && spotlightPlayer.isBot;
  const detail = paused
    ? isHost
      ? "Game paused. Resume it any time"
      : "Game paused. The host can resume it"
    : (placementLabel ?? phaseCopy.detail);
  // While placing or paused, that line needs the room more than the dice do.
  const showDice =
    rolledThisTurn && game.lastDiceRoll !== null && placementLabel === null && !paused;

  return (
    <section
      aria-labelledby="phase-title"
      className={`game-turn-card player-${getPlayerColor(spotlightPlayer)}`}
      data-finished={isFinished || undefined}
      data-state={paused ? "paused" : placementLabel ? "placing" : botPlaying ? "bot" : undefined}
    >
      <DockPortrait player={spotlightPlayer} />
      <div className="game-turn-card-text">
        <h1
          aria-label={titleText}
          className="game-turn-card-title"
          data-name-fit={titleName ? nameFit(titleText) : undefined}
          id="phase-title"
          ref={phaseHeadingRef}
          tabIndex={-1}
        >
          {titleName ? <span className="game-turn-card-name">{titleName}</span> : null}
          <span className="game-turn-card-rest">{phaseCopy.title.rest}</span>
        </h1>
        <p className="game-turn-card-detail">
          {paused ? (
            <Icon aria-hidden="true" className="game-turn-card-icon" icon={pauseIcon} />
          ) : botPlaying ? (
            <Icon aria-hidden="true" className="game-turn-card-icon" icon={botIcon} />
          ) : null}
          <span className="game-turn-card-detail-text">{detail}</span>
        </p>
        {latestMove ? (
          <p className="game-turn-card-last" title={latestMove}>
            <span className="game-turn-card-last-label">Last move</span>
            <span className="game-turn-card-last-text">{latestMove}</span>
          </p>
        ) : null}
      </div>
      {showDice && game.lastDiceRoll ? (
        <DiceRoll className="game-turn-card-dice" key={game.turnNumber} roll={game.lastDiceRoll} />
      ) : null}
      {placementLabel ? (
        <Button
          className="game-turn-card-cancel"
          onClick={onCancelPlacement}
          size="game-sm"
          variant="game-secondary"
        >
          Cancel
        </Button>
      ) : null}
    </section>
  );
}
