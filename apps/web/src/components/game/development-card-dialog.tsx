"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  totalResources,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DEVELOPMENT_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import type { CommandRejection, SendCommand } from "@/lib/game/command-errors";
import { formatInventory } from "@/lib/game/resources";

import { ResourcePicker } from "./dock-resource";
import { DockStatus } from "./dock-sheet";
import { GameDialog } from "./game-dialog";

export type DevelopmentCardChoice = "monopoly" | "year-of-plenty";

const YEAR_OF_PLENTY_CARDS = 2;
const RESOURCE_LIST_FORMAT = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * Monopoly (name one resource) or Year of Plenty (take two from the bank). It stays open until the
 * card is played; a move the game turns down shows here, above the table's own notices.
 */
export function DevelopmentCardDialog({
  bank,
  card,
  onClose,
  onPlay,
  pending,
}: {
  /** Null when the table hides the bank; the bank may then turn a pick down. */
  bank: ResourceInventory | null;
  card: DevelopmentCardChoice;
  onClose(): void;
  onPlay: SendCommand;
  pending: boolean;
}) {
  const [monopolyResource, setMonopolyResource] = useState<ResourceType | null>(null);
  const [plentyResources, setPlentyResources] = useState<ResourceInventory>(emptyInventory);
  const [rejection, setRejection] = useState<string | null>(null);
  const selectedCount = totalResources(plentyResources);
  const isMonopoly = card === "monopoly";
  const ready = isMonopoly ? monopolyResource !== null : selectedCount === YEAR_OF_PLENTY_CARDS;

  const changePlenty = (resource: ResourceType, delta: -1 | 1) => {
    setRejection(null);
    setPlentyResources((current) => ({
      ...current,
      [resource]: Math.max(0, current[resource] + delta),
    }));
  };

  const showRejection = (result: CommandRejection | null) => {
    if (result?.message) {
      setRejection(result.message);
    }
  };

  const play = async () => {
    if (!isMonopoly) {
      showRejection(
        await onPlay(
          { kind: "play_year_of_plenty", resources: plentyResources },
          `Year of Plenty: took ${formatInventory(plentyResources)}.`,
        ),
      );
    } else if (monopolyResource) {
      showRejection(
        await onPlay(
          { kind: "play_monopoly", resource: monopolyResource },
          `Monopoly played on ${RESOURCE_LABELS[monopolyResource]}.`,
        ),
      );
    }
  };

  const monopolyPick = emptyInventory();
  if (monopolyResource) {
    monopolyPick[monopolyResource] = 1;
  }
  const emptyBankResources = bank
    ? RESOURCE_ORDER.filter((resource) => bank[resource] === 0).map(
        (resource) => RESOURCE_LABELS[resource],
      )
    : [];
  const cardsLeft = YEAR_OF_PLENTY_CARDS - selectedCount;

  return (
    <GameDialog
      dialogClassName="sm:max-w-lg"
      footer={
        <>
          <Button onClick={onClose} size="game-md" variant="game-secondary">
            Cancel
          </Button>
          <Button
            disabled={pending || !ready}
            onClick={() => void play()}
            size="game-md"
            variant="game-gold"
          >
            {pending ? <Spinner /> : null}
            {pending ? "Playing…" : "Play card"}
          </Button>
        </>
      }
      footerClassName="game-dev-card-footer"
      kicker={
        isMonopoly
          ? "Name a resource. Everyone hands you all of theirs."
          : "Take any two cards from the bank. Doubles are fine."
      }
      onClose={onClose}
      title={isMonopoly ? "Monopoly" : "Year of Plenty"}
    >
      <div className="game-dev-card-body">
        <Image
          alt=""
          className="game-dev-card-art"
          draggable={false}
          height={768}
          loading="eager"
          sizes="6rem"
          src={DEVELOPMENT_CARD_ASSET_PATHS[card]}
          width={512}
        />
        <div className="game-trade-well">
          {isMonopoly ? (
            <ResourcePicker
              canAdd={() => true}
              disabled={pending}
              label="Resource to claim"
              mode="choose"
              onAdd={(resource) => {
                setRejection(null);
                setMonopolyResource(resource);
              }}
              quantities={monopolyPick}
            />
          ) : (
            <ResourcePicker
              canAdd={(resource) =>
                selectedCount < YEAR_OF_PLENTY_CARDS &&
                (bank === null || plentyResources[resource] < bank[resource])
              }
              disabled={pending}
              label="Cards to take"
              onAdd={(resource) => changePlenty(resource, 1)}
              onRemove={(resource) => changePlenty(resource, -1)}
              quantities={plentyResources}
            />
          )}
        </div>
        <DockStatus tone={rejection ? "error" : ready ? "ready" : "neutral"}>
          {rejection ??
            (isMonopoly
              ? monopolyResource
                ? `Claim every ${RESOURCE_LABELS[monopolyResource]} at the table`
                : "Pick one resource"
              : ready
                ? `Take ${formatInventory(plentyResources)}`
                : `Pick ${cardsLeft} more ${cardsLeft === 1 ? "card" : "cards"}${
                    emptyBankResources.length > 0
                      ? `. The bank is out of ${RESOURCE_LIST_FORMAT.format(emptyBankResources)}`
                      : ""
                  }`)}
        </DockStatus>
      </div>
    </GameDialog>
  );
}
