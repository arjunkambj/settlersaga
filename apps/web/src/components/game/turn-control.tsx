"use client";

import type { GameCommand, PlayerGameView } from "@settersaga/game";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import pauseIcon from "@iconify-icons/solar/pause-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { END_TURN_ICON_ASSET_PATH, WAIT_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import { getTurnControlState } from "@/lib/game/dock-actions";

import { DieFace } from "./die-face";
import {
  formatClockTime,
  formatCountdown,
  useActionCountdown,
  type CountdownStatus,
} from "./use-action-countdown";

/**
 * Roll or End turn when those are the viewer's to press; otherwise what the table waits on. While
 * the game is paused the button stays in place, quiet, and pressing it says the game is paused.
 */
export function TurnControl({
  game,
  isPaused = false,
  onCommand,
  onPausedAction,
  pending,
}: {
  game: PlayerGameView;
  isPaused?: boolean;
  onCommand(command: GameCommand, message: string): void;
  /** Says the game is paused, when a press can't go through for that. */
  onPausedAction?: () => void;
  pending: boolean;
}) {
  // The press belongs to the action it was made in, so "Rolling…" never outlives that roll.
  const [pressedAt, setPressedAt] = useState<number | null>(null);
  const busy = pending && pressedAt === game.actionNumber;
  const state = getTurnControlState(game);
  const press = (command: GameCommand, message: string) => {
    if (isPaused) {
      onPausedAction?.();
      return;
    }
    setPressedAt(game.actionNumber);
    onCommand(command, message);
  };

  switch (state.kind) {
    case "roll":
      return (
        <section aria-label="Turn control" className="game-turn-control">
          <Button
            aria-busy={busy || undefined}
            aria-disabled={isPaused || undefined}
            className="game-turn-button"
            data-paused={isPaused || undefined}
            data-rolling={busy || undefined}
            disabled={pending}
            onClick={() => press({ kind: "roll" }, "Dice rolled.")}
            size="game-lg"
            variant="game-gold"
          >
            <span className="game-turn-face">
              <span aria-hidden="true" className="game-roll-dice">
                <DieFace tone="ivory" value={6} />
                <DieFace tone="ember" value={3} />
              </span>
              Roll
            </span>
          </Button>
        </section>
      );
    case "end_turn":
      return (
        <section aria-label="Turn control" className="game-turn-control">
          <Button
            aria-busy={busy || undefined}
            aria-disabled={isPaused || undefined}
            className="game-turn-button"
            data-paused={isPaused || undefined}
            disabled={pending || !game.legalActions.canEndTurn}
            onClick={() => press({ kind: "end_turn" }, "Turn ended.")}
            size="game-lg"
            variant="game-gold"
          >
            <span className="game-turn-face">
              {busy ? (
                <Spinner className="game-turn-button-icon" />
              ) : (
                <Image
                  alt=""
                  className="game-turn-button-icon"
                  draggable={false}
                  height={256}
                  loading="eager"
                  sizes="4.5rem"
                  src={END_TURN_ICON_ASSET_PATH}
                  width={256}
                />
              )}
              {busy ? "Ending…" : "End turn"}
            </span>
          </Button>
        </section>
      );
    case "task":
      return (
        <section aria-label="Your move" className="game-turn-control" data-kind="task">
          <span className="game-turn-face">
            <Image
              alt=""
              className="game-turn-art"
              draggable={false}
              height={256}
              loading="eager"
              sizes="4.5rem"
              src={state.art}
              width={256}
            />
            <strong className="game-turn-task">{state.label}</strong>
          </span>
        </section>
      );
    case "waiting":
      return (
        <section aria-label="Turn control" className="game-turn-control" data-kind="waiting">
          <span className="game-turn-face">
            <Image
              alt=""
              className="game-turn-art"
              draggable={false}
              height={256}
              loading="eager"
              sizes="4.5rem"
              src={WAIT_ICON_ASSET_PATH}
              width={256}
            />
            <span className="game-turn-task">Waiting…</span>
          </span>
        </section>
      );
  }
}

/**
 * How long the current move has left, as a ring that empties and the time beside it. While a bot
 * is acting that schedule is the bot's, not the viewer's deadline, so the ring spins instead.
 */
export function TurnClock({
  botThinking,
  durationMs,
  isPaused,
  nextActionAt,
  pausedRemainingMs,
}: {
  botThinking: boolean;
  /** A full turn on the table's timer; the ring shows what is left of it. */
  durationMs: number;
  isPaused: boolean;
  nextActionAt?: number;
  /** While paused: how long the next move will have once play resumes. */
  pausedRemainingMs?: number;
}) {
  const showsBot = botThinking && !isPaused;
  const { remainingMs, seconds, status, urgent } = useActionCountdown({
    isPaused,
    nextActionAt: showsBot ? undefined : nextActionAt,
  });
  const share = (milliseconds: number) =>
    durationMs > 0 ? Math.min(1, milliseconds / durationMs) : 1;

  if (isPaused) {
    return (
      <div
        aria-label={
          pausedRemainingMs === undefined
            ? "Game paused"
            : `Game paused, ${formatClockTime(pausedRemainingMs)} left for this move`
        }
        className="game-turn-clock"
        data-state="paused"
        role="timer"
      >
        <ClockRing share={pausedRemainingMs === undefined ? 1 : share(pausedRemainingMs)}>
          <Icon icon={pauseIcon} />
        </ClockRing>
        <strong className="game-turn-clock-time">
          {pausedRemainingMs === undefined ? "Paused" : formatClockTime(pausedRemainingMs)}
        </strong>
      </div>
    );
  }

  if (showsBot) {
    return (
      <div
        aria-label="A bot is taking its turn"
        className="game-turn-clock"
        data-state="bot"
        role="img"
      >
        <ClockRing share={null}>
          <Icon icon={botIcon} />
        </ClockRing>
        <strong className="game-turn-clock-time">Bot</strong>
      </div>
    );
  }

  if (!nextActionAt) {
    return null;
  }

  return (
    <div
      aria-label={getTurnClockLabel(status, seconds)}
      aria-live="off"
      className="game-turn-clock"
      data-state={urgent ? "urgent" : status}
      role="timer"
    >
      <ClockRing share={remainingMs === null ? 1 : share(remainingMs)} />
      <strong className="game-turn-clock-time">{formatCountdown(status, remainingMs)}</strong>
    </div>
  );
}

/** A ring that shows `share` of a full turn; null spins a short arc for "busy". */
function ClockRing({ children, share }: { children?: ReactNode; share: number | null }) {
  return (
    <span
      aria-hidden="true"
      className="game-clock-ring"
      data-spinning={share === null || undefined}
    >
      <svg viewBox="0 0 36 36">
        <circle className="game-clock-ring-track" cx="18" cy="18" r="14.5" />
        <circle
          className="game-clock-ring-fill"
          cx="18"
          cy="18"
          pathLength="100"
          r="14.5"
          strokeDasharray={`${share === null ? 28 : Math.round(share * 100)} 100`}
        />
      </svg>
      {children}
    </span>
  );
}

function getTurnClockLabel(status: CountdownStatus, seconds: number | null): string {
  switch (status) {
    case "paused":
      return seconds === null ? "Turn paused" : `Turn paused, ${seconds} seconds left`;
    case "expired":
      return "Time is up, moving on";
    case "starting":
      return "Turn timer starting";
    case "running":
      return `${seconds} seconds left in this turn`;
  }
}
