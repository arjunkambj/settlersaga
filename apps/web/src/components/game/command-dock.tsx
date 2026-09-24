import type { PlayerGameView, PrivatePlayerState } from "@settersaga/game";
import cupIcon from "@iconify-icons/solar/cup-star-bold";
import { Icon } from "@iconify/react/offline";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import type { BoardBuildMode } from "@/lib/game/board-canvas-model";
import type { SendCommand } from "@/lib/game/command-errors";
import { getActionDockLockReason } from "@/lib/game/dock-actions";
import { phaseTitleText, type PhaseCopy } from "@/lib/game/dock-phase-copy";
import { getPlayerColor } from "@/lib/game/view";

import { BuildActions } from "./build-actions";
import { DiceRoll } from "./die-face";
import { DockPortrait } from "./dock-portrait";
import { StealChooser } from "./steal-chooser";
import { TurnClock, TurnControl } from "./turn-control";

/**
 * The turn controls beside the hand. Each part sits in a named grid area
 * (styles/game-layout.css) so a missing clock never shifts the others. Once the game is over
 * only the phase line stays, with "Show results" in the turn slot while the results are hidden.
 */
export function CommandDock({
  botThinking,
  buildMode,
  game,
  isPaused,
  me,
  nextActionAt,
  onBuildMode,
  onCommand,
  onPausedAction,
  onShowResults,
  pausedRemainingMs,
  pending,
  phaseCopy,
  phaseHeadingRef,
}: {
  botThinking: boolean;
  buildMode: BoardBuildMode;
  game: PlayerGameView;
  isPaused: boolean;
  me: PrivatePlayerState;
  nextActionAt?: number;
  onBuildMode(mode: BoardBuildMode): void;
  onCommand: SendCommand;
  onPausedAction(): void;
  onShowResults?: () => void;
  pausedRemainingMs?: number;
  pending: boolean;
  phaseCopy: PhaseCopy;
  phaseHeadingRef: Ref<HTMLHeadingElement>;
}) {
  const legal = game.legalActions;
  const phase = game.phase;
  const isFinished = phase.kind === "finished";
  const choosingVictim =
    legal.isRequiredActor && legal.discardCount === null && phase.kind === "steal";
  const spotlightPlayer =
    game.players.find(
      (player) => player.id === (isFinished ? game.winnerPlayerId : game.activePlayerId),
    ) ?? me;
  // The dice show once this turn's roll is in (a knight played before rolling keeps them hidden).
  const rolledThisTurn =
    phase.kind === "build_and_trade" ||
    phase.kind === "discard" ||
    ("resumePhase" in phase && phase.resumePhase === "build_and_trade");

  return (
    <div className="game-command-dock" data-finished={isFinished || undefined}>
      <section
        aria-labelledby="phase-title"
        className={`game-phase-panel player-${getPlayerColor(spotlightPlayer)}`}
      >
        <DockPortrait player={spotlightPlayer} />
        <div className="game-phase-copy">
          <h1
            aria-label={phaseTitleText(phaseCopy.title)}
            className="game-phase-title"
            id="phase-title"
            ref={phaseHeadingRef}
            tabIndex={-1}
          >
            {phaseCopy.title.name ? (
              <span className="game-phase-name">{phaseCopy.title.name}</span>
            ) : null}
            {phaseCopy.title.rest}
          </h1>
          <p className="game-phase-detail">{phaseCopy.detail}</p>
        </div>
        {rolledThisTurn && game.lastDiceRoll ? (
          <DiceRoll
            className="game-phase-dice"
            key={game.turnNumber}
            roll={game.lastDiceRoll}
            showTotal
          />
        ) : null}
      </section>
      {isFinished ? (
        onShowResults ? (
          <Button
            autoFocus
            className="game-show-results"
            onClick={onShowResults}
            size="game-lg"
            variant="game-gold"
          >
            <Icon aria-hidden="true" icon={cupIcon} />
            Show results
          </Button>
        ) : null
      ) : (
        <>
          {legal.discardCount === null ? (
            <TurnClock
              botThinking={botThinking}
              durationMs={game.settings.turnTimerSeconds * 1_000}
              isPaused={isPaused}
              nextActionAt={nextActionAt}
              pausedRemainingMs={pausedRemainingMs}
            />
          ) : null}
          {choosingVictim ? (
            <StealChooser game={game} onCommand={onCommand} pending={pending} />
          ) : (
            <BuildActions
              buildMode={buildMode}
              game={game}
              isPaused={isPaused}
              lockReason={getActionDockLockReason(game)}
              me={me}
              onBuildMode={onBuildMode}
              onCommand={onCommand}
              onPausedAction={onPausedAction}
              pending={pending}
            />
          )}
          <TurnControl game={game} onCommand={onCommand} pending={pending} />
        </>
      )}
    </div>
  );
}
