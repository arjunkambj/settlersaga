"use client";

import {
  PLAYER_COLORS,
  RESOURCE_ORDER,
  emptyInventory,
  type GameCommand,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import arrowDownIcon from "@iconify-icons/solar/arrow-down-bold";
import arrowRightIcon from "@iconify-icons/solar/arrow-right-bold";
import arrowUpIcon from "@iconify-icons/solar/arrow-up-bold";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import closeIcon from "@iconify-icons/solar/close-circle-bold";
import handshakeIcon from "@iconify-icons/solar/hand-shake-bold";
import minusIcon from "@iconify-icons/solar/minus-circle-bold";
import storeIcon from "@iconify-icons/solar/shop-bold";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ACTION_CARD_ASSET_PATHS, RESOURCE_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";

import { ActionTile } from "./action-tile";
import { HandDockPortal, useHandDock } from "./hand-dock";
import { RESOURCE_LABELS } from "./resource-icon";

export interface TradeCenterProps {
  disabled: boolean;
  game: PlayerGameView;
  me: PrivatePlayerState;
  onCommand(command: GameCommand, message: string): void;
}

type TradeDirection = "give" | "receive";

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

  return (
    <div className="contents" ref={tradeCenterRef}>
      <ActionTile
        ariaControls={tradeOfferOpen ? "trade-offer-surface" : "trade-dock"}
        ariaExpanded={panelVisible}
        ariaLabel={
          tradeOfferOpen
            ? "Focus the open trade offer"
            : isOpen
              ? "Close trade panel"
              : "Trade with the bank or players"
        }
        art={
          <Image
            alt=""
            className="size-full rounded object-contain"
            draggable={false}
            height={768}
            loading="eager"
            sizes="4rem"
            src={ACTION_CARD_ASSET_PATHS.trade}
            width={512}
          />
        }
        className="trade-launch"
        disabled={disabled}
        kind="trade"
        onClick={() => {
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
          <section
            aria-labelledby="trade-dock-title"
            autoFocus
            className="grid gap-3 p-4 rounded-2xl bg-card/95 border border-primary/20 shadow-2xl backdrop-blur-xl max-w-lg w-full text-card-foreground animate-in zoom-in-95 duration-200 focus:outline-none"
            id="trade-dock"
            tabIndex={-1}
          >
            <TradePanelHeader
              eyebrow="Trade"
              onClose={closeDock}
              title="Make a trade"
              titleId="trade-dock-title"
            />
            <TradeComposer
              disabled={disabled}
              game={game}
              me={me}
              onClose={closeDock}
              onCommand={onCommand}
            />
          </section>
        </HandDockPortal>
      ) : null}
    </div>
  );
}

function TradePanelHeader({
  eyebrow,
  onClose,
  title,
  titleId = "trade-dock-title",
  trailing,
}: {
  eyebrow?: string;
  onClose?: () => void;
  title: string;
  titleId?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-2">
      <div>
        {eyebrow ? (
          <p className="m-0 text-[0.65rem] font-black tracking-wider uppercase text-foreground/60">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="m-0 text-lg font-extrabold text-foreground leading-tight" id={titleId}>
          {title}
        </h2>
      </div>
      {trailing}
      {onClose ? (
        <Button
          aria-label="Close trade panel"
          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          size="icon-sm"
          onClick={onClose}
          variant="ghost"
        >
          <Icon aria-hidden="true" className="size-4" icon={closeIcon} />
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
  const statusState = canSendOffer
    ? "ready"
    : !canAfford || !hasNoOverlap
      ? "error"
      : matchingBankTrade
        ? "ready"
        : "pending";

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
    <div className="grid gap-3">
      <div className="grid gap-2">
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

      <fieldset className="grid gap-1.5 border border-white/10 rounded-xl p-2.5 bg-background/30">
        <legend className="text-xs font-bold text-muted-foreground px-1">Offer to</legend>
        <div className="flex flex-wrap gap-1.5">
          {opponents.map((player) => {
            const selected = recipientPlayerIds.includes(player.id);
            const theme = playerTheme(player.seatIndex);
            return (
              <Button
                aria-pressed={selected}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all player-${theme} ${
                  selected
                    ? "bg-primary/15 border-primary text-foreground ring-2 ring-primary/20"
                    : "bg-card/50 border-white/10 text-muted-foreground hover:text-foreground"
                }`}
                data-selected={selected || undefined}
                disabled={disabled}
                key={player.id}
                onClick={() => toggleRecipient(player.id, !selected)}
                variant="ghost"
              >
                <span
                  className="size-4 rounded-full border border-[var(--player-color,var(--primary))] overflow-hidden"
                  aria-hidden="true"
                >
                  <Image
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                    height={256}
                    sizes="1.6rem"
                    src={getPlayerPortraitPath(theme)}
                    width={256}
                  />
                </span>
                <span className="truncate max-w-[7rem]">{player.displayName}</span>
              </Button>
            );
          })}
        </div>
      </fieldset>

      <footer className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <p
          className={`m-0 text-xs font-bold leading-normal ${
            statusState === "ready"
              ? "text-accent"
              : statusState === "error"
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
          data-state={statusState}
          id="trade-composer-status"
          role="status"
        >
          {matchingBankTrade
            ? `Bank ${matchingBankTrade.ratio}:1 ${RESOURCE_LABELS[matchingBankTrade.give]} for ${RESOURCE_LABELS[matchingBankTrade.receive]} is ready.`
            : validationMessage}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            aria-describedby="bank-trade-match-status"
            disabled={disabled || !matchingBankTrade}
            onClick={() => {
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
            <Icon aria-hidden="true" className="size-4" icon={storeIcon} />
            {matchingBankTrade ? `Bank ${matchingBankTrade.ratio}:1` : "Bank trade"}
          </Button>
          <Button
            aria-describedby="trade-composer-status"
            disabled={disabled || !canSendOffer}
            onClick={() =>
              onCommand(
                { give, kind: "propose_trade", recipientPlayerIds, want },
                "Trade offer sent.",
              )
            }
          >
            <Icon aria-hidden="true" className="size-4" icon={handshakeIcon} />
            {disabled ? (
              <>
                <Spinner data-icon="inline-start" /> Sending…
              </>
            ) : (
              "Send offer"
            )}
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
    <fieldset className="grid gap-1.5 border border-white/10 rounded-xl p-2.5 bg-background/40">
      <legend className="inline-flex items-center gap-1 text-xs font-bold text-foreground px-1">
        <Icon aria-hidden="true" className="size-3.5 text-accent" icon={arrowDownIcon} />
        <span>You want</span>
      </legend>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCE_ORDER.map((resource) => {
          const quantity = inventory[resource];
          const conflicts = excludedResources[resource] > 0;
          const canAdd = !disabled && !conflicts && quantity < 19;
          const quantityDescriptionId = `receive-${resource}-trade-quantity`;
          return (
            <div
              className={`relative grid justify-items-center rounded-xl border p-1 text-center transition-all ${
                quantity > 0
                  ? "bg-accent/15 border-accent/40 ring-2 ring-accent/20"
                  : "bg-background/40 border-white/10 hover:bg-background/60"
              }`}
              data-selected={quantity > 0 || undefined}
              key={resource}
            >
              <Button
                aria-describedby={quantityDescriptionId}
                aria-label={`Add one ${RESOURCE_LABELS[resource]} to what you receive`}
                aria-pressed={quantity > 0}
                className="grid size-full justify-items-center p-0 bg-transparent hover:bg-transparent shadow-none"
                disabled={!canAdd}
                onClick={() => update(resource, 1)}
                variant="ghost"
              >
                <Image
                  alt=""
                  className="w-9 h-13 object-contain rounded"
                  draggable={false}
                  height={768}
                  sizes="3.5rem"
                  src={RESOURCE_CARD_ASSET_PATHS[resource]}
                  width={512}
                />
                {quantity > 0 ? (
                  <span
                    className="absolute -top-1.5 -right-1.5 z-10 grid min-w-4 h-4 place-items-center px-1 rounded-full bg-accent text-accent-foreground text-[0.58rem] font-black tabular-nums shadow-sm"
                    aria-hidden="true"
                  >
                    {quantity}
                  </span>
                ) : null}
              </Button>
              {quantity > 0 ? (
                <Button
                  aria-label={`Remove one ${RESOURCE_LABELS[resource]} from what you receive`}
                  className="size-5 p-0 rounded-full text-xs mt-1"
                  disabled={disabled}
                  size="icon-xs"
                  onClick={() => update(resource, -1)}
                  variant="secondary"
                >
                  <Icon aria-hidden="true" className="size-3" icon={minusIcon} />
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
  const surfaceRef = useRef<HTMLElement>(null);
  const [pendingResponse, setPendingResponse] = useState<"accept" | "cancel" | "reject" | null>(
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

  useEffect(() => {
    if (!offer || viewerIsProposer) {
      return;
    }
    surfaceRef.current?.focus();
  }, [offer, viewerIsProposer]);

  if (!offer) {
    return null;
  }

  const proposer = game.players.find((player) => player.id === offer.proposerPlayerId);
  const receive = viewerIsProposer ? offer.want : offer.give;
  const give = viewerIsProposer ? offer.give : offer.want;
  const missingResources = getMissingInventory(give, me.resources);
  const viewerCanAfford = inventoryTotal(missingResources) === 0;
  const proposerName = proposer?.displayName ?? "A player";
  const proposerTheme = proposer ? playerTheme(proposer.seatIndex) : "red";

  const respond = (accept: boolean) => {
    if (isPaused) {
      onPausedAction();
      return;
    }
    setPendingResponse(accept ? "accept" : "reject");
    onCommand(
      {
        accept,
        kind: "respond_trade",
        offerActionNumber: offer.offerActionNumber,
      },
      accept ? "Trade accepted." : "Trade rejected.",
    );
  };

  return (
    <HandDockPortal>
      <section
        aria-labelledby="trade-offer-title"
        className="grid gap-3 p-4 rounded-2xl bg-card/95 border border-primary/20 shadow-2xl backdrop-blur-xl max-w-lg w-full text-card-foreground animate-in zoom-in-95 duration-200 focus:outline-none"
        data-role={viewerIsProposer ? "outgoing" : "incoming"}
        id="trade-offer-surface"
        ref={surfaceRef}
        tabIndex={-1}
      >
        <TradePanelHeader
          eyebrow={viewerIsProposer ? "Your offer" : "Incoming trade"}
          title={viewerIsProposer ? "Waiting for a reply" : `${proposerName} wants to trade`}
          titleId="trade-offer-title"
          trailing={
            proposer && !viewerIsProposer ? (
              <span
                aria-hidden="true"
                className={`size-8 rounded-full border-2 border-[var(--player-color,var(--primary))] overflow-hidden player-${proposerTheme}`}
              >
                <Image
                  alt=""
                  className="size-full object-cover"
                  draggable={false}
                  height={256}
                  sizes="2.4rem"
                  src={getPlayerPortraitPath(proposerTheme)}
                  width={256}
                />
              </span>
            ) : null
          }
        />

        <p className="sr-only" role="status">
          {viewerIsProposer ? "Your trade offer is open." : `New trade offer from ${proposerName}.`}
          You receive {formatInventory(receive)}. You give {formatInventory(give)}.
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
          <OfferInventoryRow
            availability={viewerIsProposer ? undefined : me.resources}
            direction="give"
            inventory={give}
            label="You give"
          />
          <span
            aria-hidden="true"
            className="flex items-center justify-center text-muted-foreground"
          >
            <Icon className="size-5" icon={arrowRightIcon} />
          </span>
          <OfferInventoryRow direction="receive" inventory={receive} label="You receive" />
        </div>

        {viewerIsProposer ? (
          <ul aria-label="Trade responses" className="grid gap-1.5 m-0 p-0 list-none">
            {offer.recipientPlayerIds.map((playerId) => {
              const player = game.players.find((candidate) => candidate.id === playerId);
              const rejected = offer.rejectedPlayerIds.includes(playerId);
              const theme = player ? playerTheme(player.seatIndex) : "red";
              return (
                <li
                  className={`flex items-center gap-2 p-2 rounded-lg border border-white/10 ${
                    rejected ? "bg-destructive/15 text-destructive" : "bg-card/50 text-foreground"
                  }`}
                  data-state={rejected ? "rejected" : "waiting"}
                  key={playerId}
                >
                  <span
                    aria-hidden="true"
                    className={`size-5 rounded-full border border-[var(--player-color,var(--primary))] overflow-hidden player-${theme}`}
                  >
                    <Image
                      alt=""
                      className="size-full object-cover"
                      draggable={false}
                      height={256}
                      sizes="1.6rem"
                      src={getPlayerPortraitPath(theme)}
                      width={256}
                    />
                  </span>
                  <span className="text-xs font-bold">
                    {player?.displayName ?? "Invited player"}
                  </span>
                  <strong className="ml-auto text-[0.65rem] font-black uppercase tracking-wider">
                    {rejected ? "Rejected" : "Waiting"}
                  </strong>
                </li>
              );
            })}
          </ul>
        ) : null}

        {game.legalActions.canRespondToTrade ? (
          <footer className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <p
              aria-live="polite"
              className={`m-0 text-xs font-bold leading-normal ${
                viewerCanAfford ? "text-accent" : "text-destructive"
              }`}
              data-state={viewerCanAfford ? "ready" : "error"}
              id="trade-offer-affordability"
            >
              {viewerCanAfford
                ? `You can afford this · ${formatInventory(give)} ready`
                : `Cannot accept · short ${formatInventory(missingResources)}`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                data-action="reject"
                disabled={disabled}
                onClick={() => respond(false)}
                variant="outline"
              >
                <Icon aria-hidden="true" className="size-4" icon={closeIcon} />
                {pendingResponse === "reject" ? (
                  <>
                    <Spinner data-icon="inline-start" /> Rejecting…
                  </>
                ) : (
                  "Reject"
                )}
              </Button>
              <Button
                aria-describedby="trade-offer-affordability"
                disabled={disabled || !viewerCanAfford}
                onClick={() => respond(true)}
              >
                <Icon aria-hidden="true" className="size-4" icon={checkIcon} />
                {pendingResponse === "accept" ? (
                  <>
                    <Spinner data-icon="inline-start" /> Accepting…
                  </>
                ) : (
                  "Accept"
                )}
              </Button>
            </div>
          </footer>
        ) : game.legalActions.canCancelTrade ? (
          <footer className="flex justify-end pt-2 border-t border-white/10">
            <Button
              disabled={disabled}
              onClick={() => {
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
              variant="destructive"
            >
              {pendingResponse === "cancel" ? (
                <>
                  <Spinner data-icon="inline-start" /> Cancelling…
                </>
              ) : (
                "Cancel offer"
              )}
            </Button>
          </footer>
        ) : (
          <p className="m-0 text-xs text-muted-foreground" role="status">
            {offer.rejectedPlayerIds.includes(game.viewerPlayerId)
              ? "You rejected this offer. Other invited players may still accept."
              : "Waiting for an invited player to answer."}
          </p>
        )}
      </section>
    </HandDockPortal>
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
      className="grid gap-1.5 border border-white/10 rounded-xl p-2.5 bg-background/40"
      data-direction={direction}
      data-removable={onRemove ? "true" : undefined}
    >
      <header className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-accent" icon={directionIcon} />
        <strong>{label}</strong>
      </header>
      {resources.length > 0 ? (
        <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
          {resources.map((resource) => {
            const missing = Math.max(0, inventory[resource] - (availability?.[resource] ?? 19));
            return (
              <li
                className="relative inline-flex items-center gap-1.5 p-1 rounded-lg bg-card/60 border border-white/10"
                data-missing={missing > 0 || undefined}
                key={resource}
              >
                <Image
                  alt=""
                  className="w-7 h-10 object-contain rounded"
                  draggable={false}
                  height={768}
                  sizes="2.8rem"
                  src={RESOURCE_CARD_ASSET_PATHS[resource]}
                  width={512}
                />
                <strong
                  aria-label={`${inventory[resource]} ${RESOURCE_LABELS[resource]}`}
                  className="text-xs font-black tabular-nums text-foreground"
                >
                  {inventory[resource]}
                </strong>
                {missing > 0 ? (
                  <small className="text-[0.62rem] font-bold text-destructive">
                    Need {missing}
                  </small>
                ) : null}
                {onRemove ? (
                  <Button
                    aria-label={`Remove one ${RESOURCE_LABELS[resource]} from your offer`}
                    className="size-5 p-0 rounded-full text-xs text-muted-foreground hover:text-foreground"
                    disabled={disabled}
                    size="icon-xs"
                    onClick={() => onRemove(resource)}
                    variant="ghost"
                  >
                    <Icon aria-hidden="true" className="size-3" icon={minusIcon} />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-xs italic text-muted-foreground/70 py-1">
          {emptyMessage ?? "No cards selected."}
        </p>
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

function playerTheme(seatIndex: number) {
  return PLAYER_COLORS[seatIndex % PLAYER_COLORS.length] ?? "red";
}
