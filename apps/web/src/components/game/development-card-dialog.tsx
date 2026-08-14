"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  totalResources,
  type GameCommand,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";

import { HandDockPortal } from "./hand-dock";
import { RESOURCE_LABELS } from "./resource-icon";

type ChoiceCard = "monopoly" | "year-of-plenty";

export function DevelopmentCardDialog({
  bank,
  card,
  onClose,
  onPlay,
  pending,
}: {
  bank: ResourceInventory | null;
  card: ChoiceCard;
  onClose(): void;
  onPlay(command: GameCommand, message: string): void;
  pending: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [monopolyResource, setMonopolyResource] = useState<ResourceType | null>(null);
  const [plentyResources, setPlentyResources] = useState<ResourceInventory>(emptyInventory);
  const selectedCount = totalResources(plentyResources);
  const isMonopoly = card === "monopoly";

  useEffect(() => {
    dialogRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, pending]);

  const changePlentyResource = (resource: ResourceType, change: -1 | 1) => {
    setPlentyResources((current) => {
      const nextAmount = current[resource] + change;
      const bankCount = bank?.[resource];
      if (
        nextAmount < 0 ||
        (change > 0 && selectedCount >= 2) ||
        (bankCount !== undefined && nextAmount > bankCount)
      ) {
        return current;
      }
      return { ...current, [resource]: nextAmount };
    });
  };

  const play = () => {
    if (isMonopoly && monopolyResource) {
      onPlay(
        { kind: "play_monopoly", resource: monopolyResource },
        `Monopoly played on ${RESOURCE_LABELS[monopolyResource]}.`,
      );
      return;
    }
    if (!isMonopoly && selectedCount === 2) {
      onPlay({ kind: "play_year_of_plenty", resources: plentyResources }, "Year of Plenty played.");
    }
  };

  return (
    <HandDockPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
        <section
          aria-label={isMonopoly ? "Choose a Monopoly resource" : "Choose two resources"}
          className="grid gap-3 p-4 sm:p-5 rounded-2xl bg-card border border-primary/20 shadow-2xl backdrop-blur-xl max-w-lg w-full text-card-foreground animate-in zoom-in-95 duration-200 focus:outline-none"
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className="flex items-center justify-between gap-2">
            <div>
              <p className="m-0 text-[0.65rem] font-black tracking-wider uppercase text-foreground/60">
                Development card
              </p>
              <h2 className="m-0 text-lg font-extrabold text-foreground leading-tight">
                {isMonopoly ? "Play Monopoly" : "Year of Plenty"}
              </h2>
            </div>
            <Button
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              disabled={pending}
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <span className="sr-only">Close</span>
              <svg
                aria-hidden="true"
                className="size-4 stroke-current stroke-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </Button>
          </header>

          <p className="m-0 text-xs text-muted-foreground">
            {isMonopoly
              ? "Choose one resource. Every opponent gives you all cards of that type."
              : "Choose exactly two available bank cards. You can choose the same type twice."}
          </p>

          <div className="grid grid-cols-5 gap-2">
            {RESOURCE_ORDER.map((resource) => {
              const selected = isMonopoly
                ? monopolyResource === resource
                  ? 1
                  : 0
                : plentyResources[resource];
              const knownAvailable = bank?.[resource];
              const cannotAdd =
                pending ||
                (!isMonopoly &&
                  (selectedCount >= 2 ||
                    (knownAvailable !== undefined && selected >= knownAvailable)));

              return (
                <article
                  className={`grid justify-items-center gap-1 p-2 rounded-xl border text-center transition-all ${
                    selected > 0
                      ? "bg-primary/15 border-primary/40 ring-2 ring-primary/20"
                      : "bg-background/40 border-white/10 hover:bg-background/60"
                  }`}
                  data-selected={selected > 0}
                  key={resource}
                >
                  {isMonopoly ? (
                    <Button
                      aria-label={`Choose ${RESOURCE_LABELS[resource]}`}
                      aria-pressed={selected > 0}
                      className="grid h-auto w-full justify-items-center gap-1 p-0 bg-transparent hover:bg-transparent shadow-none"
                      disabled={pending}
                      onClick={() => setMonopolyResource(resource)}
                      variant="ghost"
                    >
                      <ResourceCard resource={resource} selected={selected} />
                    </Button>
                  ) : (
                    <ResourceCard resource={resource} selected={selected} />
                  )}

                  {!isMonopoly ? (
                    <div className="inline-flex items-center gap-1 tabular-nums mt-1">
                      <Button
                        aria-label={`Remove one ${RESOURCE_LABELS[resource]}`}
                        className="size-6 p-0 rounded-full text-xs font-bold"
                        disabled={pending || selected === 0}
                        onClick={() => changePlentyResource(resource, -1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        −
                      </Button>
                      <span
                        aria-label={`${selected} selected`}
                        className="text-xs font-extrabold px-1"
                      >
                        {selected}
                      </span>
                      <Button
                        aria-label={`Add one ${RESOURCE_LABELS[resource]}`}
                        className="size-6 p-0 rounded-full text-xs font-bold"
                        disabled={cannotAdd}
                        onClick={() => changePlentyResource(resource, 1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        +
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <span aria-live="polite" className="text-xs font-bold text-muted-foreground">
              {isMonopoly
                ? monopolyResource
                  ? `${RESOURCE_LABELS[monopolyResource]} selected`
                  : "Choose a resource"
                : `${selectedCount} of 2 cards selected`}
            </span>
            <div className="flex items-center gap-2">
              <Button disabled={pending} onClick={onClose} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={pending || (isMonopoly ? monopolyResource === null : selectedCount !== 2)}
                onClick={play}
                variant="default"
              >
                {pending ? (
                  <>
                    <Spinner data-icon="inline-start" /> Playing…
                  </>
                ) : (
                  "Play card"
                )}
              </Button>
            </div>
          </footer>
        </section>
      </div>
    </HandDockPortal>
  );
}

function ResourceCard({ resource, selected }: { resource: ResourceType; selected: number }) {
  return (
    <>
      <span className="relative inline-grid place-items-center">
        <Image
          alt=""
          className="w-10 h-14 object-contain rounded"
          draggable={false}
          height={192}
          sizes="4rem"
          src={RESOURCE_CARD_ASSET_PATHS[resource]}
          width={128}
        />
        {selected > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 grid min-w-5 h-5 place-items-center px-1 rounded-full bg-primary text-primary-foreground text-[0.62rem] font-black tabular-nums"
          >
            {selected}
          </span>
        ) : null}
      </span>
      <strong className="text-[0.68rem] font-bold truncate max-w-full text-foreground">
        {RESOURCE_LABELS[resource]}
      </strong>
    </>
  );
}
