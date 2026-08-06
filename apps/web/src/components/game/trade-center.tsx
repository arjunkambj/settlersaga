"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  type GameCommand,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import { Button, Checkbox } from "@heroui/react";
import handshakeIcon from "@iconify-icons/game-icons/shaking-hands";
import storeIcon from "@iconify-icons/game-icons/shop";
import arrowDownIcon from "@iconify-icons/solar/arrow-down-outline";
import arrowUpIcon from "@iconify-icons/solar/arrow-up-outline";
import checkIcon from "@iconify-icons/solar/check-circle-outline";
import closeIcon from "@iconify-icons/solar/close-circle-outline";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { liquidGlassClassName } from "@/components/ui/liquid-glass";
import { ACTION_CARD_ASSET_PATHS, RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { getPlayerPortraitPathForSeat } from "@/constants/game/player-assets";

import { ActionTile } from "./action-tile";
import { HandDockPortal, useHandDock } from "./hand-dock";
import { RESOURCE_LABELS } from "./resource-icon";
import styles from "./trade-center.module.css";

export interface TradeCenterProps {
  disabled: boolean;
  game: PlayerGameView;
  me: PrivatePlayerState;
  onCommand(command: GameCommand, message: string): void;
}

type TradeDirection = "give" | "receive";

function tradeGlassClassName(className: string, kind: "card" | "control" = "control") {
  return liquidGlassClassName({
    className: `game-purple-glass ${className}`,
    kind,
    radius: kind === "card" ? "md" : "sm",
  });
}

function MinusGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 12h12" />
    </svg>
  );
}

export function TradeCenter({
  disabled,
  game,
  isPaused,
  me,
  onCommand,
  onPausedAction,
}: TradeCenterProps & {
  isPaused: boolean;
  onPausedAction(): void;
}) {
  const tradeCenterRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const tradeOfferOpen = game.tradeOffer !== null;
  const panelVisible = isOpen || tradeOfferOpen;
  const offerActionNumber = game.tradeOffer?.offerActionNumber;

  const closeDock = useCallback(() => {
    setIsOpen(false);
    globalThis.requestAnimationFrame(() => {
      tradeCenterRef.current
        ?.querySelector<HTMLButtonElement>('[data-action-kind="trade"]')
        ?.focus();
    });
  }, []);

  useEffect(() => {
    if (offerActionNumber !== undefined) {
      setIsOpen(false);
    }
  }, [offerActionNumber]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDock();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeDock, isOpen]);

  const launchCaption = game.legalActions.canRespondToTrade
    ? "Answer offer"
    : game.legalActions.canCancelTrade
      ? "Offer waiting"
      : game.tradeOffer
        ? "Offer open"
        : "Bank or players";

  return (
    <div className={styles.tradeCenter} ref={tradeCenterRef}>
      <ActionTile
        ariaControls={tradeOfferOpen ? "trade-offer-surface" : "trade-dock"}
        ariaExpanded={panelVisible}
        ariaLabel={
          tradeOfferOpen
            ? "Focus the trade offer beside the game log"
            : isOpen
              ? "Close trade panel"
              : "Trade with the bank or players"
        }
        art={
          <Image
            alt=""
            className="action-art action-card-art"
            draggable={false}
            height={768}
            loading="eager"
            sizes="4rem"
            src={ACTION_CARD_ASSET_PATHS.trade}
            width={512}
          />
        }
        caption={launchCaption}
        className={`trade-launch ${styles.tradeLaunch}`}
        disabled={disabled}
        kind="trade"
        onPress={() => {
          if (isPaused) {
            onPausedAction();
            return;
          }
          if (tradeOfferOpen) {
            document.getElementById("trade-offer-surface")?.focus();
            return;
          }
          if (isOpen) {
            closeDock();
          } else {
            setIsOpen(true);
          }
        }}
        pressed={panelVisible}
        title="Trade"
      />

      {isOpen && !tradeOfferOpen ? (
        <HandDockPortal>
          <div className={styles.tradeDockAnchor}>
            <section
              aria-labelledby="trade-dock-title"
              autoFocus
              className={tradeGlassClassName(styles.tradeDock, "card")}
              id="trade-dock"
              tabIndex={-1}
            >
              <TradeDockHeader onClose={closeDock} title="Make a trade" />
              <TradeComposer
                disabled={disabled}
                game={game}
                me={me}
                onClose={closeDock}
                onCommand={onCommand}
              />
            </section>
          </div>
        </HandDockPortal>
      ) : null}
    </div>
  );
}

function TradeDockHeader({
  onClose,
  title,
  titleId = "trade-dock-title",
}: {
  onClose?: () => void;
  title: string;
  titleId?: string;
}) {
  return (
    <header className={styles.tradeHeader}>
      <div>
        <h2 id={titleId}>{title}</h2>
      </div>
      {onClose ? (
        <Button
          aria-label="Close trade panel"
          className={styles.closeButton}
          isIconOnly
          onPress={onClose}
          variant="ghost"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      ) : null}
    </header>
  );
}

function TradeComposer({
  disabled,
  game,
  me,
  onClose,
  onCommand,
}: TradeCenterProps & { onClose(): void }) {
  const { clearInteraction, setInteraction } = useHandDock();
  const [give, setGive] = useState<ResourceInventory>(() => emptyInventory());
  const [want, setWant] = useState<ResourceInventory>(() => emptyInventory());
  const opponents = game.players.filter((player) => player.id !== me.id);
  const [recipientPlayerIds, setRecipientPlayerIds] = useState<string[]>(() =>
    opponents.map((player) => player.id),
  );
  const hasGive = inventoryTotal(give) > 0;
  const hasWant = inventoryTotal(want) > 0;
  const hasNoOverlap = RESOURCE_ORDER.every(
    (resource) => give[resource] === 0 || want[resource] === 0,
  );
  const missingResources = getMissingInventory(give, me.resources);
  const canAfford = inventoryTotal(missingResources) === 0;
  const matchingBankTrade = game.legalActions.bankTrades.find(
    (option) =>
      isExactResourceSelection(give, option.give, option.ratio) &&
      isExactResourceSelection(want, option.receive, 1),
  );
  const canComposeTrade =
    game.legalActions.canProposeTrade || game.legalActions.bankTrades.length > 0;
  const canSendOffer =
    game.legalActions.canProposeTrade &&
    hasGive &&
    hasWant &&
    hasNoOverlap &&
    recipientPlayerIds.length > 0 &&
    canAfford;
  const validationMessage = getTradeValidationMessage({
    canAfford,
    canPropose: game.legalActions.canProposeTrade,
    give,
    hasGive,
    hasNoOverlap,
    hasRecipients: recipientPlayerIds.length > 0,
    hasWant,
    missingResources,
    want,
  });

  const selectFromHand = useCallback(
    (resource: ResourceType) => {
      if (disabled || want[resource] > 0) {
        return;
      }

      setGive((current) => {
        if (current[resource] >= me.resources[resource]) {
          return current;
        }
        return { ...current, [resource]: current[resource] + 1 };
      });
    },
    [disabled, me.resources, want],
  );

  const removeFromOffer = (resource: ResourceType) => {
    setGive((current) =>
      current[resource] === 0
        ? current
        : { ...current, [resource]: Math.max(0, current[resource] - 1) },
    );
  };

  useEffect(() => {
    if (!canComposeTrade) {
      clearInteraction("trade");
      return;
    }

    setInteraction("trade", {
      disabled,
      label: "your trade",
      onSelect: selectFromHand,
      selected: give,
      sourceResources: me.resources,
    });

    return () => clearInteraction("trade");
  }, [
    canComposeTrade,
    clearInteraction,
    disabled,
    give,
    me.resources,
    selectFromHand,
    setInteraction,
  ]);

  const toggleRecipient = (playerId: string, selected: boolean) => {
    setRecipientPlayerIds((current) =>
      selected
        ? current.includes(playerId)
          ? current
          : [...current, playerId]
        : current.filter((candidate) => candidate !== playerId),
    );
  };

  return (
    <div className={styles.tradeComposer}>
      <div className={styles.draftRows}>
        <RequestedResourceRow
          disabled={disabled || !canComposeTrade}
          excludedResources={give}
          inventory={want}
          onChange={setWant}
        />
        <OfferInventoryRow
          disabled={disabled}
          direction="give"
          emptyMessage="Tap cards in your hand to add them here."
          inventory={give}
          label="You give"
          onRemove={removeFromOffer}
        />
      </div>

      <fieldset className={styles.tradeRecipients}>
        <legend className="sr-only">Offer recipients</legend>
        <div className={styles.recipientList}>
          {opponents.map((player) => (
            <Checkbox
              className={styles.recipient}
              isDisabled={disabled}
              isSelected={recipientPlayerIds.includes(player.id)}
              key={player.id}
              name="tradeRecipient"
              onChange={(selected) => toggleRecipient(player.id, selected)}
              value={player.id}
              variant="secondary"
            >
              <Checkbox.Content className={styles.recipientContent}>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className={styles.recipientAvatar} aria-hidden="true">
                  <Image
                    alt=""
                    draggable={false}
                    height={256}
                    sizes="1.45rem"
                    src={getPlayerPortraitPathForSeat(player.seatIndex)}
                    width={256}
                  />
                </span>
                <span className={styles.recipientCopy}>
                  <strong>{player.displayName}</strong>
                </span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>
      </fieldset>

      <footer className={styles.composerFooter}>
        <p id="trade-composer-status" role="status">
          {validationMessage}
        </p>
        <div>
          <Button
            aria-describedby="bank-trade-match-status"
            className={styles.bankTradeButton}
            isDisabled={disabled || !matchingBankTrade}
            onPress={() => {
              if (!matchingBankTrade) {
                return;
              }
              onCommand(
                {
                  give: matchingBankTrade.give,
                  kind: "trade_bank",
                  receive: matchingBankTrade.receive,
                },
                "Bank trade completed.",
              );
              onClose();
            }}
            variant="secondary"
          >
            <Icon aria-hidden="true" icon={storeIcon} />
            Bank trade
          </Button>
          <Button
            aria-describedby="trade-composer-status"
            className={styles.sendOfferButton}
            isDisabled={disabled || !canSendOffer}
            isPending={disabled}
            onPress={() =>
              onCommand(
                { give, kind: "propose_trade", recipientPlayerIds, want },
                "Trade offer sent.",
              )
            }
          >
            <Icon aria-hidden="true" icon={handshakeIcon} />
            {disabled ? "Sending…" : "Send offer"}
          </Button>
          <span className="sr-only" id="bank-trade-match-status">
            {matchingBankTrade
              ? `Bank trade available: ${matchingBankTrade.ratio} ${RESOURCE_LABELS[matchingBankTrade.give]} for 1 ${RESOURCE_LABELS[matchingBankTrade.receive]}.`
              : "Select exactly one available bank or harbor trade ratio to enable this action."}
          </span>
        </div>
      </footer>
    </div>
  );
}

function RequestedResourceRow({
  disabled,
  excludedResources,
  inventory,
  onChange,
}: {
  disabled: boolean;
  excludedResources: Readonly<ResourceInventory>;
  inventory: ResourceInventory;
  onChange(inventory: ResourceInventory): void;
}) {
  const update = (resource: ResourceType, change: number) => {
    onChange({
      ...inventory,
      [resource]: Math.max(0, Math.min(19, inventory[resource] + change)),
    });
  };

  return (
    <fieldset className={styles.draftRow} data-direction="receive">
      <legend>
        <span className={styles.directionIcon}>
          <Icon aria-hidden="true" icon={arrowDownIcon} />
        </span>
        <span>
          <strong>Cards you want to receive</strong>
        </span>
      </legend>
      <div className={styles.quickResourceGrid}>
        {RESOURCE_ORDER.map((resource) => {
          const quantity = inventory[resource];
          const conflicts = excludedResources[resource] > 0;
          const canAdd = !disabled && !conflicts && quantity < 19;
          const quantityDescriptionId = `receive-${resource}-trade-quantity`;
          return (
            <div className={styles.resourceControl} key={resource}>
              <Button
                aria-describedby={quantityDescriptionId}
                aria-label={`Add one ${RESOURCE_LABELS[resource]} to what you receive`}
                aria-pressed={quantity > 0}
                className={`${styles.resourceAdd}${quantity > 0 ? ` ${styles.isSelected}` : ""}`}
                isDisabled={!canAdd}
                onPress={() => update(resource, 1)}
                variant="ghost"
              >
                <Image
                  alt=""
                  className={styles.resourceCardImage}
                  draggable={false}
                  height={768}
                  sizes="3.5rem"
                  src={RESOURCE_CARD_ASSET_PATHS[resource]}
                  width={512}
                />
                <span className={styles.quantityChip} aria-hidden="true">
                  {quantity}
                </span>
              </Button>
              {quantity > 0 ? (
                <Button
                  aria-label={`Remove one ${RESOURCE_LABELS[resource]} from what you receive`}
                  className={styles.resourceRemove}
                  isDisabled={disabled}
                  isIconOnly
                  onPress={() => update(resource, -1)}
                  variant="tertiary"
                >
                  <MinusGlyph />
                </Button>
              ) : null}
              <span className="sr-only" id={quantityDescriptionId}>
                {quantity} selected.
                {conflicts
                  ? ` Remove ${RESOURCE_LABELS[resource]} from your outgoing cards first.`
                  : ""}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ActiveTradeOffer({
  disabled,
  game,
  isPaused,
  me,
  onCommand,
  onPausedAction,
}: TradeCenterProps & {
  isPaused: boolean;
  onPausedAction(): void;
}) {
  const { clearInteraction, setInteraction } = useHandDock();
  const [pendingResponse, setPendingResponse] = useState<"accept" | "cancel" | "decline" | null>(
    null,
  );
  const offer = game.tradeOffer;
  const viewerIsProposer = offer?.proposerPlayerId === game.viewerPlayerId;

  useEffect(() => {
    if (!disabled) {
      setPendingResponse(null);
    }
  }, [disabled, offer?.offerActionNumber]);

  useEffect(() => {
    if (!offer || !viewerIsProposer) {
      clearInteraction("trade");
      return;
    }

    setInteraction("trade", {
      disabled: true,
      label: "your pending trade offer",
      onSelect: () => undefined,
      selected: offer.give,
      sourceResources: me.resources,
    });

    return () => clearInteraction("trade");
  }, [clearInteraction, me.resources, offer, setInteraction, viewerIsProposer]);

  if (!offer) {
    return null;
  }

  const proposer = game.players.find((player) => player.id === offer.proposerPlayerId);
  const receive = viewerIsProposer ? offer.want : offer.give;
  const give = viewerIsProposer ? offer.give : offer.want;
  const missingResources = getMissingInventory(give, me.resources);
  const viewerCanAfford = inventoryTotal(missingResources) === 0;
  const proposerName = proposer?.displayName ?? "A player";

  const respond = (accept: boolean) => {
    if (isPaused) {
      onPausedAction();
      return;
    }
    setPendingResponse(accept ? "accept" : "decline");
    onCommand(
      {
        accept,
        kind: "respond_trade",
        offerActionNumber: offer.offerActionNumber,
      },
      accept ? "Trade accepted." : "Trade declined.",
    );
  };

  return (
    <section
      aria-labelledby="trade-offer-title"
      className={tradeGlassClassName(`${styles.tradeDock} ${styles.sidebarOfferSurface}`, "card")}
      id="trade-offer-surface"
      tabIndex={-1}
    >
      <div className={styles.activeOffer}>
        <TradeDockHeader
          title={viewerIsProposer ? "Offer sent" : `Offer from ${proposerName}`}
          titleId="trade-offer-title"
        />

        <p className="sr-only" role="status">
          {viewerIsProposer ? "Your trade offer is open." : `New trade offer from ${proposerName}.`}
          You receive {formatInventory(receive)}. You give {formatInventory(give)}.
        </p>

        <div className={styles.offerRows}>
          <OfferInventoryRow direction="receive" inventory={receive} label="You receive" />
          <OfferInventoryRow
            availability={viewerIsProposer ? undefined : me.resources}
            direction="give"
            inventory={give}
            label="You give"
          />
        </div>

        {viewerIsProposer ? (
          <ul aria-label="Trade responses" className={styles.recipientStatuses}>
            {offer.recipientPlayerIds.map((playerId) => {
              const player = game.players.find((candidate) => candidate.id === playerId);
              const rejected = offer.rejectedPlayerIds.includes(playerId);
              return (
                <li data-state={rejected ? "rejected" : "waiting"} key={playerId}>
                  <span className={styles.statusAvatar} aria-hidden="true">
                    {getPlayerInitial(player?.displayName ?? "?")}
                  </span>
                  <span>{player?.displayName ?? "Invited player"}</span>
                  <strong>{rejected ? "Declined" : "Waiting"}</strong>
                </li>
              );
            })}
          </ul>
        ) : null}

        {game.legalActions.canRespondToTrade ? (
          <footer className={styles.offerFooter}>
            <p
              aria-live="polite"
              data-state={viewerCanAfford ? "ready" : "error"}
              id="trade-offer-affordability"
            >
              {viewerCanAfford
                ? `Affordable · you have ${formatInventory(give)} ready`
                : `Cannot accept · short ${formatInventory(missingResources)}`}
            </p>
            <div>
              <Button
                isDisabled={disabled}
                isPending={disabled && pendingResponse === "decline"}
                onPress={() => respond(false)}
                variant="danger"
              >
                <Icon aria-hidden="true" icon={closeIcon} />
                {pendingResponse === "decline" ? "Declining…" : "Decline"}
              </Button>
              <Button
                aria-describedby="trade-offer-affordability"
                isDisabled={disabled || !viewerCanAfford}
                isPending={disabled && pendingResponse === "accept"}
                onPress={() => respond(true)}
              >
                <Icon aria-hidden="true" icon={checkIcon} />
                {pendingResponse === "accept" ? "Accepting…" : "Accept"}
              </Button>
            </div>
          </footer>
        ) : game.legalActions.canCancelTrade ? (
          <footer className={`${styles.offerFooter} ${styles.cancelOfferFooter}`}>
            <Button
              isDisabled={disabled}
              isPending={disabled && pendingResponse === "cancel"}
              onPress={() => {
                if (isPaused) {
                  onPausedAction();
                  return;
                }
                setPendingResponse("cancel");
                onCommand(
                  { kind: "cancel_trade", offerActionNumber: offer.offerActionNumber },
                  "Trade offer cancelled.",
                );
              }}
              variant="danger"
            >
              {pendingResponse === "cancel" ? "Cancelling…" : "Cancel offer"}
            </Button>
          </footer>
        ) : (
          <p className={styles.observerStatus} role="status">
            {offer.rejectedPlayerIds.includes(game.viewerPlayerId)
              ? "You declined. Other invited players may still accept."
              : "Waiting for an invited player to answer."}
          </p>
        )}
      </div>
    </section>
  );
}

function OfferInventoryRow({
  availability,
  disabled = false,
  direction,
  emptyMessage,
  inventory,
  label,
  onRemove,
}: {
  availability?: Readonly<ResourceInventory>;
  disabled?: boolean;
  direction: TradeDirection;
  emptyMessage?: string;
  inventory: Readonly<ResourceInventory>;
  label: string;
  onRemove?(resource: ResourceType): void;
}) {
  const resources = RESOURCE_ORDER.filter((resource) => inventory[resource] > 0);
  const directionIcon = direction === "receive" ? arrowDownIcon : arrowUpIcon;

  return (
    <section
      className={styles.offerRow}
      data-direction={direction}
      data-removable={onRemove ? "true" : undefined}
    >
      <header>
        <span className={styles.directionIcon}>
          <Icon aria-hidden="true" icon={directionIcon} />
        </span>
        <strong>{label}</strong>
      </header>
      {resources.length > 0 ? (
        <ul>
          {resources.map((resource) => {
            const missing = Math.max(0, inventory[resource] - (availability?.[resource] ?? 19));
            return (
              <li data-missing={missing > 0 || undefined} key={resource}>
                <Image
                  alt=""
                  className={styles.offerCardImage}
                  draggable={false}
                  height={768}
                  sizes="2.8rem"
                  src={RESOURCE_CARD_ASSET_PATHS[resource]}
                  width={512}
                />
                <strong aria-label={`${inventory[resource]} ${RESOURCE_LABELS[resource]}`}>
                  {inventory[resource]}
                </strong>
                {missing > 0 ? <small>Need {missing}</small> : null}
                {onRemove ? (
                  <Button
                    aria-label={`Remove one ${RESOURCE_LABELS[resource]} from your offer`}
                    className={styles.offerCardRemove}
                    isDisabled={disabled}
                    isIconOnly
                    onPress={() => onRemove(resource)}
                    variant="tertiary"
                  >
                    <MinusGlyph />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyOutgoing}>{emptyMessage ?? "No cards selected."}</p>
      )}
    </section>
  );
}

function getTradeValidationMessage({
  canAfford,
  canPropose,
  give,
  hasGive,
  hasNoOverlap,
  hasRecipients,
  hasWant,
  missingResources,
  want,
}: {
  canAfford: boolean;
  canPropose: boolean;
  give: Readonly<ResourceInventory>;
  hasGive: boolean;
  hasNoOverlap: boolean;
  hasRecipients: boolean;
  hasWant: boolean;
  missingResources: Readonly<ResourceInventory>;
  want: Readonly<ResourceInventory>;
}): string {
  if (!canPropose) {
    return "Player trades are not available right now.";
  }
  if (!hasWant) {
    return "Choose at least one card to receive.";
  }
  if (!hasGive) {
    return "Choose at least one card to give.";
  }
  if (!hasNoOverlap) {
    return "The same resource cannot appear on both sides.";
  }
  if (!canAfford) {
    return `Remove ${formatInventory(missingResources)} from your offer.`;
  }
  if (!hasRecipients) {
    return "Choose at least one player.";
  }
  return `Ready to offer ${formatInventory(give)} for ${formatInventory(want)}.`;
}

function getMissingInventory(
  required: Readonly<ResourceInventory>,
  available: Readonly<ResourceInventory>,
): ResourceInventory {
  return Object.fromEntries(
    RESOURCE_ORDER.map((resource) => [
      resource,
      Math.max(0, required[resource] - available[resource]),
    ]),
  ) as ResourceInventory;
}

function formatInventory(inventory: Readonly<ResourceInventory>): string {
  const resources = RESOURCE_ORDER.flatMap((resource) =>
    inventory[resource] > 0 ? [`${inventory[resource]} ${RESOURCE_LABELS[resource]}`] : [],
  );
  return resources.length > 0 ? resources.join(", ") : "no cards";
}

function getPlayerInitial(displayName: string): string {
  return displayName.trim().slice(0, 1).toUpperCase() || "?";
}

function isExactResourceSelection(
  inventory: Readonly<ResourceInventory>,
  selectedResource: ResourceType,
  selectedQuantity: number,
): boolean {
  return RESOURCE_ORDER.every(
    (resource) => inventory[resource] === (resource === selectedResource ? selectedQuantity : 0),
  );
}

function inventoryTotal(inventory: Readonly<ResourceInventory>): number {
  return RESOURCE_ORDER.reduce((total, resource) => total + inventory[resource], 0);
}
