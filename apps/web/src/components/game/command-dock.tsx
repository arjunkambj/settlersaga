import type { PlayerGameView, PrivatePlayerState } from "@settersaga/game";
import cupIcon from "@iconify-icons/solar/cup-star-bold";
import { Icon } from "@iconify/react/offline";

import { Button } from "@/components/ui/button";
import type { BoardBuildMode } from "@/lib/game/board-canvas-model";
import type { SendCommand } from "@/lib/game/command-errors";
import { getActionDockLockReason } from "@/lib/game/dock-actions";

import { BuildActions } from "./build-actions";
import { StealChooser } from "./steal-chooser";
import { TurnClock, TurnControl } from "./turn-control";

/**
 * The dock's command half, beside the hand: Build & Trade (or the steal chooser while the viewer
 * picks a victim), then the turn slot with the clock and the Roll or End turn button. Whose turn
 * it is and what to do now are in the turn card just above the turn slot (turn-card.tsx). The
 * parts are separate grid items of the footer (styles/game-layout.css): at xl the turn card and
 * the turn slot are the foot of the rail, below xl they end the dock row. Once the game is over
 * the turn slot holds "Show results" while the results are hidden.
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
}) {
  const legal = game.legalActions;
  const phase = game.phase;

  if (phase.kind === "finished") {
    return onShowResults ? (
      <div className="game-turn-slot" data-finished>
        <Button autoFocus onClick={onShowResults} size="game-lg" variant="game-gold">
          <Icon aria-hidden="true" icon={cupIcon} />
          Show results
        </Button>
      </div>
    ) : null;
  }

  const choosingVictim =
    legal.isRequiredActor && legal.discardCount === null && phase.kind === "steal";
  const showsClock = legal.discardCount === null;

  return (
    <>
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
      <div className="game-turn-slot">
        {showsClock ? (
          <TurnClock
            botThinking={botThinking}
            durationMs={game.settings.turnTimerSeconds * 1_000}
            isPaused={isPaused}
            nextActionAt={nextActionAt}
            pausedRemainingMs={pausedRemainingMs}
          />
        ) : null}
        <TurnControl
          game={game}
          isPaused={isPaused}
          onCommand={onCommand}
          onPausedAction={onPausedAction}
          pending={pending}
        />
      </div>
    </>
  );
}
