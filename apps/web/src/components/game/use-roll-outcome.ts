"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
} from "@settersaga/game";
import { useEffect, useRef, useState } from "react";

import type { RollOutcome } from "@/lib/game/dock-actions";

/** How long the phase line reports a roll before it goes back to what the viewer can do. */
const ROLL_OUTCOME_MS = 6_000;

interface Snapshot {
  phaseKind: PlayerGameView["phase"]["kind"];
  resources: ResourceInventory;
  turnNumber: number;
}

/**
 * What the latest roll paid the viewer, measured from their hand just before and just after it.
 * It stands for a few seconds, or until the next move, whichever comes first.
 */
export function useRollOutcome(game: PlayerGameView, me: PrivatePlayerState): RollOutcome | null {
  const previousRef = useRef<Snapshot | null>(null);
  const [outcome, setOutcome] = useState<RollOutcome | null>(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = {
      phaseKind: game.phase.kind,
      resources: { ...me.resources },
      turnNumber: game.turnNumber,
    };
    const roll = game.lastDiceRoll;
    if (
      !previous ||
      !roll ||
      previous.phaseKind !== "roll" ||
      previous.turnNumber !== game.turnNumber ||
      game.phase.kind !== "build_and_trade"
    ) {
      return;
    }
    const gains = emptyInventory();
    for (const resource of RESOURCE_ORDER) {
      gains[resource] = Math.max(0, me.resources[resource] - previous.resources[resource]);
    }
    setOutcome({ actionNumber: game.actionNumber, gains, sum: roll.sum });
    // Only a new move can be a roll, so the hand is read once per move.
  }, [game.actionNumber]);

  useEffect(() => {
    if (!outcome) {
      return;
    }
    const timeoutId = window.setTimeout(() => setOutcome(null), ROLL_OUTCOME_MS);
    return () => window.clearTimeout(timeoutId);
  }, [outcome]);

  return outcome && outcome.actionNumber === game.actionNumber ? outcome : null;
}
