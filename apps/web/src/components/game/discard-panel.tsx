"use client";

import {
  emptyInventory,
  totalResources,
  type GameCommand,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import clockIcon from "@iconify-icons/solar/clock-circle-bold";
import { Icon } from "@iconify/react/offline";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { ResourcePicker } from "./dock-resource";
import { DockSheet, DockStatus } from "./dock-sheet";
import { useHandDock } from "./hand-dock";
import {
  formatClockTime,
  formatCountdown,
  useActionCountdown,
  type CountdownStatus,
} from "./use-action-countdown";

/** The robber's discard: pick the cards to give back, here or straight from the hand. */
export function DiscardPanel({
  autoDiscardAt,
  count,
  hasTurnTimer,
  isPaused,
  me,
  onCommand,
  pausedRemainingMs,
  pending,
}: {
  /** When the server will discard for the viewer; unset while a bot acts first. */
  autoDiscardAt?: number;
  count: number;
  /** Without a turn timer, human players are never discarded for automatically. */
  hasTurnTimer: boolean;
  isPaused: boolean;
  me: PrivatePlayerState;
  onCommand(command: GameCommand, message: string): void;
  /** While paused: how long the discard will have once play resumes. */
  pausedRemainingMs?: number;
  pending: boolean;
}) {
  const { clearInteraction, setInteraction } = useHandDock();
  const [selection, setSelection] = useState<ResourceInventory>(emptyInventory);
  const selectedCount = totalResources(selection);
  const isReady = selectedCount === count;
  const { remainingMs, seconds, status, urgent } = useActionCountdown({
    isPaused,
    nextActionAt: autoDiscardAt,
  });
  const showsTimer = hasTurnTimer && (isPaused || autoDiscardAt !== undefined);

  const addResource = useCallback(
    (resource: ResourceType) => {
      setSelection((current) =>
        totalResources(current) >= count || current[resource] >= me.resources[resource]
          ? current
          : { ...current, [resource]: current[resource] + 1 },
      );
    },
    [count, me.resources],
  );

  useEffect(() => {
    setInteraction("discard", {
      disabled: pending || selectedCount >= count,
      label: "the discard pile",
      onSelect: addResource,
      preserveHandAppearance: true,
      selected: selection,
      sourceResources: me.resources,
    });
    return () => clearInteraction("discard");
  }, [
    addResource,
    clearInteraction,
    count,
    me.resources,
    pending,
    selectedCount,
    selection,
    setInteraction,
  ]);

  return (
    <DockSheet
      footer={
        <Button
          aria-describedby="discard-tray-status"
          disabled={pending || !isReady}
          onClick={() => onCommand({ kind: "discard", resources: selection }, "Cards discarded.")}
          size="game-md"
          variant="game-gold"
        >
          {pending ? <Spinner /> : null}
          {pending ? "Discarding…" : `Discard ${count} ${count === 1 ? "card" : "cards"}`}
        </Button>
      }
      id="discard-tray"
      title="Too many cards"
      titleId="discard-tray-title"
    >
      <p className="game-trade-lead">
        <span>
          Pick {count} {count === 1 ? "card" : "cards"} to discard, here or in your hand
        </span>
      </p>
      <section aria-label="Cards to discard" className="game-trade-well game-discard-well">
        <ResourcePicker
          canAdd={(resource) =>
            selectedCount < count && selection[resource] < me.resources[resource]
          }
          disabled={pending}
          held={me.resources}
          label="Cards to discard"
          onAdd={addResource}
          onRemove={(resource) =>
            setSelection((current) => ({
              ...current,
              [resource]: Math.max(0, current[resource] - 1),
            }))
          }
          quantities={selection}
        />
      </section>
      <div className="game-discard-progress">
        <span aria-hidden="true" className="game-discard-meter">
          <span
            className="game-discard-meter-fill"
            style={{ inlineSize: `${count === 0 ? 0 : (selectedCount / count) * 100}%` }}
          />
        </span>
        <strong aria-hidden="true" className="game-discard-count">
          {selectedCount}/{count}
        </strong>
        {showsTimer ? (
          <span
            aria-label={
              isPaused && pausedRemainingMs !== undefined
                ? `Automatic discard paused with ${formatClockTime(pausedRemainingMs)} left`
                : getAutoDiscardLabel(status, seconds)
            }
            aria-live="off"
            className="game-discard-timer"
            data-urgent={urgent || undefined}
            role="timer"
          >
            <Icon aria-hidden="true" icon={clockIcon} />
            {isPaused && pausedRemainingMs !== undefined
              ? formatClockTime(pausedRemainingMs)
              : formatCountdown(status, remainingMs)}
          </span>
        ) : null}
      </div>
      <DockStatus id="discard-tray-status" tone={isReady ? "ready" : "neutral"}>
        {isReady
          ? "Ready to discard"
          : `Pick ${count - selectedCount} more ${count - selectedCount === 1 ? "card" : "cards"}`}
      </DockStatus>
    </DockSheet>
  );
}

function getAutoDiscardLabel(status: CountdownStatus, seconds: number | null): string {
  switch (status) {
    case "paused":
      return seconds === null
        ? "Automatic discard paused"
        : `Automatic discard paused with ${seconds} seconds left`;
    case "expired":
      return "Time's up. Picking cards for you";
    case "starting":
      return "Automatic discard timer starting";
    case "running":
      return `Cards get picked for you in ${seconds} seconds`;
  }
}
