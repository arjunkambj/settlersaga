"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  getGameMapDefinition,
  totalResources,
  type GameCommand,
  type PlayerGameView,
  type PlayerViewState,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
  type TradeOffer,
} from "@settersaga/game";
import arrowRightIcon from "@iconify-icons/solar/arrow-right-bold";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import closeIcon from "@iconify-icons/solar/close-circle-bold";
import handshakeIcon from "@iconify-icons/solar/hand-shake-bold";
import hourglassIcon from "@iconify-icons/solar/hourglass-bold";
import storeIcon from "@iconify-icons/solar/shop-bold";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ACTION_CARD_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import { isShownBesideControl, type SendCommand } from "@/lib/game/command-errors";
import { formatInventory, getMissingInventory } from "@/lib/game/resources";
import { getPlayerHudOrder } from "@/lib/game/view";

import { ActionTile } from "./action-tile";
import { DockPortrait } from "./dock-portrait";
import { ResourceCardRow, ResourcePicker } from "./dock-resource";
import { DockSheet, DockStatus } from "./dock-sheet";
import { useHandDock } from "./hand-dock";

const TRADE_COMPOSER_ID = "trade-dock";
const TRADE_OFFER_ID = "trade-offer-surface";

/** The Trade tile and the composer sheet it opens (bank trades and offers to the crew). */
export function TradeCenter({
  game,
  isPaused,
  lockReason,
  me,
  onCommand,
  onLockedPress,
  onPausedAction,
  pending,
}: {
  game: PlayerGameView;
  isPaused: boolean;
  lockReason: string | undefined;
  me: PrivatePlayerState;
  onCommand: SendCommand;
  onLockedPress(reason: string): void;
  onPausedAction(): void;
  pending: boolean;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  // The composer belongs to the turn it was opened in and closes itself when that turn ends.
  const [openTurn, setOpenTurn] = useState<number | null>(null);
  const tradeOfferOpen = game.tradeOffer !== null;
  const isOpen = openTurn === game.turnNumber && !tradeOfferOpen && lockReason === undefined;

  const closeComposer = useCallback(() => {
    setOpenTurn(null);
    globalThis.requestAnimationFrame(() => {
      tileRef.current?.querySelector<HTMLButtonElement>('[data-action-kind="trade"]')?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComposer();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeComposer, isOpen]);

  return (
    <div className="contents" ref={tileRef}>
      <ActionTile
        ariaControls={tradeOfferOpen ? TRADE_OFFER_ID : TRADE_COMPOSER_ID}
        ariaExpanded={isOpen || tradeOfferOpen}
        ariaLabel={
          tradeOfferOpen
            ? "Go to the open trade offer"
            : `${isOpen ? "Close trading" : "Trade with the bank or the crew"}${
                lockReason ? `. ${lockReason}` : ""
              }`
        }
        art={
          <Image
            alt=""
            className="size-full object-contain"
            draggable={false}
            height={768}
            loading="eager"
            sizes="4.5rem"
            src={ACTION_CARD_ASSET_PATHS.trade}
            width={512}
          />
        }
        kind="trade"
        lockReason={tradeOfferOpen ? null : lockReason}
        onClick={() => {
          if (tradeOfferOpen) {
            document.getElementById(TRADE_OFFER_ID)?.focus();
          } else if (lockReason) {
            onLockedPress(lockReason);
          } else if (isPaused) {
            onPausedAction();
          } else if (isOpen) {
            closeComposer();
          } else {
            setOpenTurn(game.turnNumber);
          }
        }}
        pressed={isOpen || tradeOfferOpen}
        title="Trade"
        tooltip="Trade with the bank or the crew"
      />
      {isOpen ? (
        <TradeComposer
          game={game}
          me={me}
          onClose={closeComposer}
          onCommand={onCommand}
          onSent={() => setOpenTurn(null)}
          pending={pending}
        />
      ) : null}
    </div>
  );
}

// `autoFocus` only applies to form controls, so sheets take focus when their node attaches.
function focusOnAttach(node: HTMLElement | null) {
  node?.focus();
}

function TradeComposer({
  game,
  me,
  onClose,
  onCommand,
  onSent,
  pending,
}: {
  game: PlayerGameView;
  me: PrivatePlayerState;
  onClose(): void;
  onCommand: SendCommand;
  /** The offer went out; its sheet takes over (and takes focus). */
  onSent(): void;
  pending: boolean;
}) {
  const { clearInteraction, setInteraction } = useHandDock();
  const legal = game.legalActions;
  const opponents = getPlayerHudOrder(game.players, game.turnOrder).filter(
    (player) => player.id !== me.id,
  );
  const [give, setGive] = useState<ResourceInventory>(emptyInventory);
  const [want, setWant] = useState<ResourceInventory>(emptyInventory);
  const [recipientPlayerIds, setRecipientPlayerIds] = useState(() =>
    opponents.map((player) => player.id),
  );
  const [sending, setSending] = useState<"bank" | "offer" | null>(null);
  const [bankRejection, setBankRejection] = useState<string | null>(null);
  const bankResourceCount = getGameMapDefinition(game.settings.map).bankResourceCount;
  const missing = getMissingInventory(give, me.resources);
  const canAfford = totalResources(missing) === 0;
  const hasGive = totalResources(give) > 0;
  const hasWant = totalResources(want) > 0;
  const matchingBankTrade = legal.bankTrades.find(
    (option) => isOnly(give, option.give, option.ratio) && isOnly(want, option.receive, 1),
  );
  const canSendOffer =
    legal.canProposeTrade && hasGive && hasWant && canAfford && recipientPlayerIds.length > 0;
  const busy = pending || sending !== null;

  const addGive = useCallback(
    (resource: ResourceType) => {
      setBankRejection(null);
      setGive((current) =>
        current[resource] >= me.resources[resource]
          ? current
          : { ...current, [resource]: current[resource] + 1 },
      );
    },
    [me.resources],
  );

  const change = (
    setSide: (update: (current: ResourceInventory) => ResourceInventory) => void,
    resource: ResourceType,
    delta: -1 | 1,
  ) => {
    setBankRejection(null);
    setSide((current) => ({ ...current, [resource]: Math.max(0, current[resource] + delta) }));
  };

  useEffect(() => {
    setInteraction("trade", {
      disabled: busy,
      label: "your offer",
      onSelect: (resource) => {
        if (want[resource] === 0) {
          addGive(resource);
        }
      },
      selected: give,
      sourceResources: me.resources,
    });
    return () => clearInteraction("trade");
  }, [addGive, busy, clearInteraction, give, me.resources, setInteraction, want]);

  const tradeWithBank = async () => {
    if (!matchingBankTrade) {
      return;
    }
    setSending("bank");
    const rejection = await onCommand(
      {
        give: matchingBankTrade.give,
        kind: "trade_bank",
        receive: matchingBankTrade.receive,
      },
      `Traded ${matchingBankTrade.ratio} ${RESOURCE_LABELS[matchingBankTrade.give]} for 1 ${
        RESOURCE_LABELS[matchingBankTrade.receive]
      }.`,
    );
    setSending(null);
    if (!rejection) {
      setGive(emptyInventory());
      setWant(emptyInventory());
    } else if (isShownBesideControl(rejection)) {
      setBankRejection(rejection.message);
    }
  };

  const sendOffer = async () => {
    setSending("offer");
    const rejection = await onCommand(
      { give, kind: "propose_trade", recipientPlayerIds, want },
      "Trade offer sent.",
    );
    setSending(null);
    if (!rejection) {
      onSent();
    }
  };

  const status = getComposerStatus({
    bank: game.bank,
    bankRejection,
    canAfford,
    give,
    hasGive,
    hasRecipients: recipientPlayerIds.length > 0,
    hasWant,
    legal,
    matchingBankTrade,
    missing,
    want,
  });

  return (
    <DockSheet
      footer={
        <>
          <Button
            aria-describedby="trade-composer-status"
            disabled={busy || !matchingBankTrade}
            onClick={() => void tradeWithBank()}
            size="game-md"
            variant="game-secondary"
          >
            {sending === "bank" ? <Spinner /> : <Icon aria-hidden="true" icon={storeIcon} />}
            {matchingBankTrade ? `Bank ${matchingBankTrade.ratio}:1` : "Bank"}
          </Button>
          <Button
            aria-describedby="trade-composer-status"
            disabled={busy || !canSendOffer}
            onClick={() => void sendOffer()}
            size="game-md"
            variant="game-gold"
          >
            {sending === "offer" ? <Spinner /> : <Icon aria-hidden="true" icon={handshakeIcon} />}
            Send offer
          </Button>
        </>
      }
      id={TRADE_COMPOSER_ID}
      onClose={onClose}
      sheetRef={focusOnAttach}
      title="Trade"
      titleId="trade-composer-title"
    >
      <div className="game-trade-grid">
        <span aria-hidden="true" className="game-trade-row-label">
          You give
        </span>
        <ResourcePicker
          canAdd={(resource) => want[resource] === 0 && give[resource] < me.resources[resource]}
          disabled={busy}
          label="Cards you give"
          onAdd={addGive}
          onRemove={(resource) => change(setGive, resource, -1)}
          quantities={give}
        />
        <span aria-hidden="true" className="game-trade-row-label">
          You want
        </span>
        <ResourcePicker
          canAdd={(resource) => give[resource] === 0 && want[resource] < bankResourceCount}
          disabled={busy}
          label="Cards you want"
          onAdd={(resource) => change(setWant, resource, 1)}
          onRemove={(resource) => change(setWant, resource, -1)}
          quantities={want}
        />
        {legal.canProposeTrade ? (
          <>
            <span className="game-trade-row-label" id="trade-recipients-label">
              Offer to
            </span>
            <div
              aria-labelledby="trade-recipients-label"
              className="game-trade-recipients"
              role="group"
            >
              {opponents.map((player) => {
                const selected = recipientPlayerIds.includes(player.id);
                return (
                  <button
                    aria-label={player.displayName}
                    aria-pressed={selected}
                    className="game-trade-recipient"
                    disabled={busy}
                    key={player.id}
                    onClick={() =>
                      setRecipientPlayerIds((current) =>
                        selected
                          ? current.filter((playerId) => playerId !== player.id)
                          : [...current, player.id],
                      )
                    }
                    type="button"
                  >
                    <DockPortrait player={player} />
                    <span aria-hidden="true" className="game-trade-recipient-name">
                      {player.displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      <DockStatus id="trade-composer-status" tone={status.tone}>
        {status.text}
      </DockStatus>
    </DockSheet>
  );
}

function getComposerStatus({
  bank,
  bankRejection,
  canAfford,
  give,
  hasGive,
  hasRecipients,
  hasWant,
  legal,
  matchingBankTrade,
  missing,
  want,
}: {
  /** Null when the table hides the bank's stock. */
  bank: Readonly<ResourceInventory> | null;
  bankRejection: string | null;
  canAfford: boolean;
  give: Readonly<ResourceInventory>;
  hasGive: boolean;
  hasRecipients: boolean;
  hasWant: boolean;
  legal: PlayerGameView["legalActions"];
  matchingBankTrade: PlayerGameView["legalActions"]["bankTrades"][number] | undefined;
  missing: Readonly<ResourceInventory>;
  want: Readonly<ResourceInventory>;
}): { text: string; tone: "error" | "neutral" | "ready" } {
  if (bankRejection) {
    return { text: bankRejection, tone: "error" };
  }
  if (!canAfford) {
    return { text: `You no longer have ${formatInventory(missing)}`, tone: "error" };
  }
  if (matchingBankTrade) {
    return {
      text: `The bank takes ${matchingBankTrade.ratio} ${RESOURCE_LABELS[matchingBankTrade.give]} for 1 ${RESOURCE_LABELS[matchingBankTrade.receive]}`,
      tone: "ready",
    };
  }
  const [onlyGive, ...otherGives] = RESOURCE_ORDER.filter((resource) => give[resource] > 0);
  const [onlyWant, ...otherWants] = RESOURCE_ORDER.filter((resource) => want[resource] > 0);
  const bankRatio = legal.bankTrades.find((option) => option.give === onlyGive)?.ratio;
  // A visible bank leaves trades for a resource it has run out of off the list.
  if (
    bank &&
    onlyGive &&
    otherGives.length === 0 &&
    give[onlyGive] === bankRatio &&
    onlyWant &&
    otherWants.length === 0 &&
    want[onlyWant] === 1 &&
    bank[onlyWant] === 0
  ) {
    return { text: `The bank has no ${RESOURCE_LABELS[onlyWant]} left`, tone: "error" };
  }
  if (onlyGive && otherGives.length === 0 && bankRatio && give[onlyGive] < bankRatio) {
    const bankHint = `the bank takes ${bankRatio} ${RESOURCE_LABELS[onlyGive]} for 1 card`;
    if (!legal.canProposeTrade) {
      return { text: `Add more: ${bankHint}`, tone: "neutral" };
    }
    if (!hasWant) {
      return { text: `Pick what you want. Tip: ${bankHint}`, tone: "neutral" };
    }
  }
  if (!legal.canProposeTrade) {
    return { text: "Offers to the crew are closed right now", tone: "neutral" };
  }
  if (!hasGive && !hasWant) {
    return { text: "Pick what you give and what you want", tone: "neutral" };
  }
  if (!hasGive) {
    return { text: "Pick what you give", tone: "neutral" };
  }
  if (!hasWant) {
    return { text: "Pick what you want", tone: "neutral" };
  }
  if (!hasRecipients) {
    return { text: "Pick who gets the offer", tone: "neutral" };
  }
  return {
    text: `Ready: ${formatInventory(give)} for ${formatInventory(want)}`,
    tone: "ready",
  };
}

type TradeRole = "observer" | "proposer" | "recipient";
type ReplyState = "accepted" | "declined" | "pending";

const REPLY_LABELS: Readonly<Record<ReplyState, string>> = {
  accepted: "Accepted",
  declined: "Declined",
  pending: "Pending",
};

const REPLY_ICONS: Readonly<Record<ReplyState, IconifyIcon>> = {
  accepted: checkIcon,
  declined: closeIcon,
  pending: hourglassIcon,
};

function getReplyState(offer: TradeOffer, playerId: string): ReplyState {
  if (offer.acceptedPlayerIds.includes(playerId)) {
    return "accepted";
  }
  return offer.rejectedPlayerIds.includes(playerId) ? "declined" : "pending";
}

/**
 * The open trade offer, as each player sees it: the proposer follows the answers and picks a
 * partner, a recipient accepts or declines (then sees their answer), and everyone else watches.
 */
export function ActiveTradeOffer({
  disabled,
  game,
  isPaused,
  me,
  onCommand,
  onPausedAction,
}: {
  disabled: boolean;
  game: PlayerGameView;
  isPaused: boolean;
  me: PrivatePlayerState;
  onCommand(command: GameCommand, message: string): void;
  onPausedAction(): void;
}) {
  const { clearInteraction, setInteraction } = useHandDock();
  const [sent, setSent] = useState<{ actionNumber: number; key: string } | null>(null);
  const offer = game.tradeOffer;
  const role: TradeRole =
    offer?.proposerPlayerId === me.id
      ? "proposer"
      : offer?.recipientPlayerIds.includes(me.id)
        ? "recipient"
        : "observer";

  // Keyed by offer below, so this runs once per new offer; later updates keep focus where it is.
  // Everyone involved gets focus (the proposer just sent it); onlookers keep theirs.
  const focusIfInvolved = useCallback(
    (node: HTMLElement | null) => {
      if (node && role !== "observer") {
        node.focus();
      }
    },
    [role],
  );

  useEffect(() => {
    if (!offer || role !== "proposer") {
      return;
    }
    setInteraction("trade", {
      disabled: true,
      label: "your open offer",
      onSelect: () => undefined,
      selected: offer.give,
      sourceResources: me.resources,
    });
    return () => clearInteraction("trade");
  }, [clearInteraction, me.resources, offer, role, setInteraction]);

  if (!offer) {
    return null;
  }

  const legal = game.legalActions;
  // Onlookers and players who already answered only follow along, so the board stays in view.
  const compact = role === "observer" || (role === "recipient" && !legal.canRespondToTrade);
  const playerById = (playerId: string) => game.players.find((player) => player.id === playerId);
  const proposer = playerById(offer.proposerPlayerId);
  const proposerName = proposer?.displayName ?? "A player";
  // A recipient pays what the proposer wants and gets what the proposer gives.
  const youGive = role === "recipient" ? offer.want : offer.give;
  const youGet = role === "recipient" ? offer.give : offer.want;
  const shortOf = role === "recipient" ? getMissingInventory(offer.want, me.resources) : undefined;
  const canAfford = !shortOf || totalResources(shortOf) === 0;
  const isSending = (key: string) =>
    disabled && sent?.key === key && sent.actionNumber === game.actionNumber;

  const send = (key: string, command: GameCommand, message: string) => {
    if (isPaused) {
      onPausedAction();
      return;
    }
    setSent({ actionNumber: game.actionNumber, key });
    onCommand(command, message);
  };

  const status = getOfferStatus({
    canAfford,
    legal,
    me,
    nameOf: (playerId) => playerById(playerId)?.displayName ?? "a player",
    offer,
    proposerName,
    role,
    shortOf,
  });

  return (
    <DockSheet
      footer={
        legal.canRespondToTrade ? (
          <>
            <Button
              disabled={disabled}
              onClick={() =>
                send(
                  "decline",
                  {
                    accept: false,
                    kind: "respond_trade",
                    offerActionNumber: offer.offerActionNumber,
                  },
                  "Trade declined.",
                )
              }
              size="game-md"
              variant="game-secondary"
            >
              {isSending("decline") ? <Spinner /> : <Icon aria-hidden="true" icon={closeIcon} />}
              Decline
            </Button>
            <Button
              aria-describedby="trade-offer-status"
              disabled={disabled || !canAfford}
              onClick={() =>
                send(
                  "accept",
                  {
                    accept: true,
                    kind: "respond_trade",
                    offerActionNumber: offer.offerActionNumber,
                  },
                  "Trade accepted.",
                )
              }
              size="game-md"
              variant="game-gold"
            >
              {isSending("accept") ? <Spinner /> : <Icon aria-hidden="true" icon={checkIcon} />}
              Accept
            </Button>
          </>
        ) : legal.canCancelTrade ? (
          <Button
            disabled={disabled}
            onClick={() =>
              send(
                "cancel",
                { kind: "cancel_trade", offerActionNumber: offer.offerActionNumber },
                "Trade offer cancelled.",
              )
            }
            size="game-md"
            variant="game-secondary"
          >
            {isSending("cancel") ? <Spinner /> : null}
            Cancel offer
          </Button>
        ) : undefined
      }
      id={TRADE_OFFER_ID}
      key={offer.offerActionNumber}
      sheetRef={focusIfInvolved}
      title={
        role === "proposer" ? "Your offer" : role === "recipient" ? "Trade offer" : "Crew trade"
      }
      titleId="trade-offer-title"
    >
      {role === "proposer" ? null : (
        <p className="game-trade-lead">
          {proposer ? <DockPortrait player={proposer} /> : null}
          <span>{getOfferLead({ compact, offer, proposerName, role })}</span>
        </p>
      )}
      {compact ? null : (
        <div className="game-trade-sides">
          <TradeSide inventory={youGive} label="You give" shortOf={shortOf} />
          <Icon aria-hidden="true" className="game-trade-arrow" icon={arrowRightIcon} />
          <TradeSide inventory={youGet} label="You get" />
        </div>
      )}
      {role === "recipient" && offer.recipientPlayerIds.length === 1 ? null : (
        <ul aria-label="Answers" className="game-trade-replies" data-compact={compact || undefined}>
          {offer.recipientPlayerIds.map((playerId) => {
            const player = playerById(playerId);
            if (!player) {
              return null;
            }
            const name = player.isViewer ? "You" : player.displayName;
            const state = getReplyState(offer, playerId);
            if (compact) {
              return (
                <li
                  aria-label={`${name}: ${REPLY_LABELS[state]}`}
                  className="game-trade-reply-chip"
                  data-state={state}
                  key={playerId}
                >
                  <DockPortrait player={player} />
                  <span aria-hidden="true" className="game-trade-reply-badge">
                    <Icon icon={REPLY_ICONS[state]} />
                  </span>
                </li>
              );
            }
            return legal.tradePartnerPlayerIds.includes(playerId) ? (
              <li key={playerId}>
                <button
                  aria-label={`Trade with ${player.displayName}`}
                  className="game-trade-reply"
                  data-state="partner"
                  disabled={disabled}
                  onClick={() =>
                    send(
                      playerId,
                      {
                        kind: "confirm_trade",
                        offerActionNumber: offer.offerActionNumber,
                        partnerPlayerId: playerId,
                      },
                      `Traded with ${player.displayName}.`,
                    )
                  }
                  type="button"
                >
                  <TradeReplyFace
                    icon={isSending(playerId) ? null : handshakeIcon}
                    label="Trade"
                    name={name}
                    player={player}
                  />
                </button>
              </li>
            ) : (
              <li
                aria-label={`${name}: ${REPLY_LABELS[state]}`}
                className="game-trade-reply"
                data-state={state}
                key={playerId}
              >
                <TradeReplyFace
                  icon={REPLY_ICONS[state]}
                  label={REPLY_LABELS[state]}
                  name={name}
                  player={player}
                />
              </li>
            );
          })}
        </ul>
      )}
      <DockStatus id="trade-offer-status" tone={status.tone}>
        {status.text}
      </DockStatus>
    </DockSheet>
  );
}

function TradeSide({
  inventory,
  label,
  shortOf,
}: {
  inventory: Readonly<ResourceInventory>;
  label: string;
  shortOf?: Readonly<ResourceInventory>;
}) {
  return (
    <section className="game-trade-well">
      <h3 className="game-trade-well-label">{label}</h3>
      <ResourceCardRow inventory={inventory} label={label} shortOf={shortOf} />
    </section>
  );
}

/** Portrait, name and a state pill; `icon` null shows a spinner (the trade is on its way). */
function TradeReplyFace({
  icon,
  label,
  name,
  player,
}: {
  icon: IconifyIcon | null;
  label: string;
  name: string;
  player: PlayerViewState;
}) {
  return (
    <>
      <DockPortrait player={player} />
      <span aria-hidden="true" className="game-trade-reply-name">
        {name}
      </span>
      <span aria-hidden="true" className="game-trade-reply-state">
        {icon ? <Icon icon={icon} /> : <Spinner />}
        {label}
      </span>
    </>
  );
}

function getOfferLead({
  compact,
  offer,
  proposerName,
  role,
}: {
  compact: boolean;
  offer: TradeOffer;
  proposerName: string;
  role: TradeRole;
}): string {
  if (!compact) {
    return `${proposerName} wants to trade`;
  }
  const deal = `${formatInventory(offer.give)} for ${role === "recipient" ? "your " : ""}${formatInventory(offer.want)}`;
  return `${proposerName} offers ${deal}`;
}

function getOfferStatus({
  canAfford,
  legal,
  me,
  nameOf,
  offer,
  proposerName,
  role,
  shortOf,
}: {
  canAfford: boolean;
  legal: PlayerGameView["legalActions"];
  me: PrivatePlayerState;
  nameOf(playerId: string): string;
  offer: TradeOffer;
  proposerName: string;
  role: TradeRole;
  shortOf: Readonly<ResourceInventory> | undefined;
}): { text: string; tone: "error" | "neutral" | "ready" } {
  const waitingCount = offer.recipientPlayerIds.filter(
    (playerId) => getReplyState(offer, playerId) === "pending",
  ).length;

  switch (role) {
    case "recipient":
      if (legal.canRespondToTrade) {
        return canAfford
          ? { text: "You have the cards for this trade", tone: "ready" }
          : {
              text: `You need ${formatInventory(shortOf ?? emptyInventory())} more`,
              tone: "error",
            };
      }
      return offer.acceptedPlayerIds.includes(me.id)
        ? { text: `Accepted — waiting for ${proposerName}`, tone: "ready" }
        : { text: "You passed on this offer", tone: "neutral" };
    case "proposer": {
      const [onlyPartnerId, ...otherPartnerIds] = legal.tradePartnerPlayerIds;
      if (onlyPartnerId) {
        return {
          text:
            otherPartnerIds.length === 0
              ? `Trade with ${nameOf(onlyPartnerId)} to swap cards`
              : "Pick who gets the cards",
          tone: "ready",
        };
      }
      return waitingCount > 0
        ? { text: "Waiting for answers…", tone: "neutral" }
        : { text: "No one who accepted can pay right now", tone: "error" };
    }
    case "observer":
      return waitingCount > 0
        ? { text: "Waiting for answers…", tone: "neutral" }
        : { text: `${proposerName} is picking a partner…`, tone: "neutral" };
  }
}

/** True when the inventory holds exactly `quantity` of `resource` and nothing else. */
function isOnly(
  inventory: Readonly<ResourceInventory>,
  resource: ResourceType,
  quantity: number,
): boolean {
  return RESOURCE_ORDER.every(
    (candidate) => inventory[candidate] === (candidate === resource ? quantity : 0),
  );
}
