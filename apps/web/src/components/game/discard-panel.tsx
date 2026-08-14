"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  totalResources,
  type GameCommand,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import clockIcon from "@iconify-icons/solar/clock-circle-bold";
import minusIcon from "@iconify-icons/solar/minus-circle-bold";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";

import { HandDockPortal, useHandDock } from "./hand-dock";
import { RESOURCE_LABELS } from "./resource-icon";
import { useActionCountdown } from "./use-action-countdown";

export function DiscardPanel({
  count,
  isPaused,
  me,
  nextActionAt,
  onCommand,
  pending,
}: {
  count: number;
  isPaused: boolean;
  me: PrivatePlayerState;
  nextActionAt?: number;
  onCommand(command: GameCommand, message: string): void;
  pending: boolean;
}) {
  const { clearInteraction, setInteraction } = useHandDock();
  const [selection, setSelection] = useState<ResourceInventory>(() => emptyInventory());
  const selectedCount = totalResources(selection);
  const remainingCount = Math.max(0, count - selectedCount);
  const selectedResources = RESOURCE_ORDER.filter((resource) => selection[resource] > 0);
  const isReady = selectedCount === count;
  const { isExpired, seconds } = useActionCountdown({ isPaused, nextActionAt });

  const addResource = useCallback(
    (resource: ResourceType) => {
      if (pending) {
        return;
      }

      setSelection((current) => {
        if (totalResources(current) >= count || current[resource] >= me.resources[resource]) {
          return current;
        }

        return {
          ...current,
          [resource]: current[resource] + 1,
        };
      });
    },
    [
      count,
      me.resources.brick,
      me.resources.sheep,
      me.resources.stone,
      me.resources.tree,
      me.resources.wheat,
      pending,
    ],
  );

  const removeResource = (resource: ResourceType) => {
    if (pending) {
      return;
    }

    setSelection((current) => {
      if (current[resource] === 0) {
        return current;
      }

      return {
        ...current,
        [resource]: current[resource] - 1,
      };
    });
  };

  useEffect(() => {
    setInteraction("discard", {
      disabled: pending || selectedCount >= count,
      label: "the discard tray",
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
    <HandDockPortal>
      <section aria-labelledby="discard-tray-title" className="hud-action-panel" id="discard-tray">
        <header className="hud-action-panel__header">
          <div>
            <p className="eyebrow">Robber</p>
            <h2 id="discard-tray-title">Discard {count} cards</h2>
          </div>
          {isPaused || nextActionAt ? (
            <div
              aria-label={
                isPaused
                  ? seconds === null
                    ? "Automatic discard paused"
                    : `Automatic discard paused with ${seconds} seconds remaining`
                  : isExpired
                    ? "Time expired, selecting cards automatically"
                    : seconds === null
                      ? "Automatic discard timer starting"
                      : `Cards will be selected and discarded automatically in ${seconds} seconds`
              }
              aria-live="off"
              className="discard-tray__timer"
              data-expired={isExpired || undefined}
              role="timer"
            >
              <Icon aria-hidden="true" icon={clockIcon} />
              <span>{isPaused ? "Paused" : "Auto"}</span>
              <strong>{isPaused ? "—" : isExpired ? "…" : `${seconds ?? "—"}s`}</strong>
            </div>
          ) : null}
        </header>

        <p className="hud-action-panel__hint">Tap cards in your hand to add them.</p>

        <div aria-label="Cards selected to discard" className="discard-tray__cards" role="list">
          {selectedResources.length === 0 ? (
            <p className="trade-row-empty">No cards selected yet.</p>
          ) : (
            selectedResources.map((resource) => (
              <div className="discard-chip" key={resource} role="listitem">
                <div className="discard-chip__art">
                  <Image
                    alt=""
                    className="discard-chip__image"
                    draggable={false}
                    height={768}
                    sizes="2.8rem"
                    src={RESOURCE_CARD_ASSET_PATHS[resource]}
                    width={512}
                  />
                  <span aria-hidden="true" className="discard-chip__count">
                    {selection[resource]}
                  </span>
                </div>
                <Button
                  aria-label={`Remove one ${RESOURCE_LABELS[resource]} from the discard selection`}
                  disabled={pending}
                  onClick={() => removeResource(resource)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Icon aria-hidden="true" icon={minusIcon} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="discard-tray__progress">
          <div
            aria-hidden="true"
            className="discard-tray__meter"
            data-ready={isReady || undefined}
            style={
              {
                "--progress": `${count === 0 ? 0 : (selectedCount / count) * 100}%`,
              } as CSSProperties
            }
          >
            <span />
          </div>
          <p
            aria-label={`${selectedCount} of ${count} resource cards selected`}
            aria-live="polite"
            id="discard-tray-status"
          >
            <strong>
              {selectedCount}/{count}
            </strong>
            <span>{isReady ? "Ready to discard" : `${remainingCount} more needed`}</span>
          </p>
        </div>

        <footer className="discard-tray__footer">
          <Button
            aria-describedby="discard-tray-status"
            disabled={pending || !isReady}
            onClick={() =>
              onCommand({ kind: "discard", resources: selection }, "Resources discarded.")
            }
          >
            {pending ? (
              <>
                <Spinner data-icon="inline-start" /> Discarding…
              </>
            ) : (
              "Discard"
            )}
          </Button>
        </footer>
      </section>
    </HandDockPortal>
  );
}
