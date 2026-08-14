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
import { useCallback, useEffect, useState } from "react";

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
      <section
        aria-labelledby="discard-tray-title"
        className="grid gap-3 p-4 rounded-2xl bg-card/95 border border-primary/20 shadow-2xl backdrop-blur-xl max-w-lg w-full text-card-foreground animate-in zoom-in-95 duration-200"
        id="discard-tray"
      >
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="m-0 text-[0.65rem] font-black tracking-wider uppercase text-foreground/60">
              Robber
            </p>
            <h2
              className="m-0 text-lg font-extrabold text-foreground leading-tight"
              id="discard-tray-title"
            >
              Discard {count} cards
            </h2>
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono tabular-nums ${
                isExpired
                  ? "bg-destructive/20 border-destructive/40 text-destructive"
                  : "bg-background/50 border-white/10 text-muted-foreground"
              }`}
              data-expired={isExpired || undefined}
              role="timer"
            >
              <Icon aria-hidden="true" className="size-3.5" icon={clockIcon} />
              <span>{isPaused ? "Paused" : "Auto"}</span>
              <strong className={isExpired ? "text-destructive" : "text-foreground"}>
                {isPaused ? "—" : isExpired ? "…" : `${seconds ?? "—"}s`}
              </strong>
            </div>
          ) : null}
        </header>

        <p className="m-0 text-xs text-muted-foreground">Tap cards in your hand to add them.</p>

        <div
          aria-label="Cards selected to discard"
          className="flex flex-wrap items-center min-h-14 gap-2"
          role="list"
        >
          {selectedResources.length === 0 ? (
            <p className="m-0 text-xs italic text-muted-foreground/70 py-2">
              No cards selected yet.
            </p>
          ) : (
            selectedResources.map((resource) => (
              <div
                className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-background/50 border border-white/10 shadow-sm"
                key={resource}
                role="listitem"
              >
                <div className="relative inline-grid place-items-center">
                  <Image
                    alt=""
                    className="w-8 h-11 object-contain rounded"
                    draggable={false}
                    height={768}
                    sizes="2.8rem"
                    src={RESOURCE_CARD_ASSET_PATHS[resource]}
                    width={512}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 grid min-w-4 h-4 place-items-center px-1 rounded-full bg-primary text-primary-foreground text-[0.58rem] font-black tabular-nums"
                  >
                    {selection[resource]}
                  </span>
                </div>
                <Button
                  aria-label={`Remove one ${RESOURCE_LABELS[resource]} from the discard selection`}
                  className="size-6 p-0 rounded-full text-xs text-muted-foreground hover:text-foreground"
                  disabled={pending}
                  onClick={() => removeResource(resource)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Icon aria-hidden="true" className="size-3.5" icon={minusIcon} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-1.5">
          <div
            aria-hidden="true"
            className="overflow-hidden h-2 rounded-full bg-background/60 border border-white/5"
            data-ready={isReady || undefined}
          >
            <span
              className={`block h-full rounded-inherit transition-all duration-300 ${
                isReady ? "bg-accent" : "bg-primary"
              }`}
              style={{
                width: `${count === 0 ? 0 : (selectedCount / count) * 100}%`,
              }}
            />
          </div>
          <p
            aria-label={`${selectedCount} of ${count} resource cards selected`}
            aria-live="polite"
            className="m-0 flex items-baseline gap-1.5 text-xs text-muted-foreground"
            id="discard-tray-status"
          >
            <strong className="text-sm font-extrabold text-foreground tabular-nums">
              {selectedCount}/{count}
            </strong>
            <span>{isReady ? "Ready to discard" : `${remainingCount} more needed`}</span>
          </p>
        </div>

        <footer className="flex justify-end pt-2 border-t border-white/10">
          <Button
            aria-describedby="discard-tray-status"
            className="min-w-28"
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
