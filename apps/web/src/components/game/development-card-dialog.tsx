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
      <div className={""}>
        <section
          aria-label={isMonopoly ? "Choose a Monopoly resource" : "Choose two resources"}
          className={"rounded-md border bg-card"}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className={""}>
            <div>
              <p className={""}>Development card</p>
              <h2>{isMonopoly ? "Play Monopoly" : "Year of Plenty"}</h2>
            </div>
            <Button disabled={pending} onClick={onClose} size="icon-sm" variant="ghost">
              <span className="sr-only">Close</span>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </Button>
          </header>

          <p className={""}>
            {isMonopoly
              ? "Choose one resource. Every opponent gives you all cards of that type."
              : "Choose exactly two available bank cards. You can choose the same type twice."}
          </p>

          <div className={""}>
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
                <article className={""} data-selected={selected > 0} key={resource}>
                  {isMonopoly ? (
                    <Button
                      aria-label={`Choose ${RESOURCE_LABELS[resource]}`}
                      aria-pressed={selected > 0}
                      className={""}
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
                    <div className={""}>
                      <Button
                        aria-label={`Remove one ${RESOURCE_LABELS[resource]}`}
                        disabled={pending || selected === 0}
                        onClick={() => changePlentyResource(resource, -1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        −
                      </Button>
                      <span aria-label={`${selected} selected`}>{selected}</span>
                      <Button
                        aria-label={`Add one ${RESOURCE_LABELS[resource]}`}
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

          <footer className={""}>
            <span aria-live="polite">
              {isMonopoly
                ? monopolyResource
                  ? `${RESOURCE_LABELS[monopolyResource]} selected`
                  : "Choose a resource"
                : `${selectedCount} of 2 cards selected`}
            </span>
            <div>
              <Button className={""} disabled={pending} onClick={onClose} variant="secondary">
                Cancel
              </Button>
              <Button
                className={""}
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
      <span className={""}>
        <Image
          alt=""
          draggable={false}
          height={192}
          sizes="4rem"
          src={RESOURCE_CARD_ASSET_PATHS[resource]}
          width={128}
        />
        {selected > 0 ? (
          <span aria-hidden="true" className={""}>
            {selected}
          </span>
        ) : null}
      </span>
      <strong>{RESOURCE_LABELS[resource]}</strong>
    </>
  );
}
