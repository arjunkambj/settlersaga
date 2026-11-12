"use client";

import {
  RESOURCE_ORDER,
  emptyInventory,
  getGameMapDefinition,
  getTradeTermsWith,
  totalResources,
  type GameCommand,
  type PlayerGameView,
  type PlayerViewState,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
  type TradeCounterOffer,
  type TradeOffer,
} from "@settersaga/game";
import arrowRightIcon from "@iconify-icons/solar/arrow-right-bold";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import closeIcon from "@iconify-icons/solar/close-circle-bold";
import handshakeIcon from "@iconify-icons/solar/hand-shake-bold";
import hourglassIcon from "@iconify-icons/solar/hourglass-bold";
import storeIcon from "@iconify-icons/solar/shop-bold";
import counterIcon from "@iconify-icons/solar/transfer-horizontal-bold";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { ACTION_ICON_ASSET_PATHS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import { isShownBesideControl, type SendCommand } from "@/lib/game/command-errors";
import { formatInventory, getBankRates, getMissingInventory } from "@/lib/game/resources";
import { getPlayerHudOrder } from "@/lib/game/view";

import { ActionTile, TileArt } from "./action-tile";
import { DockPortrait } from "./dock-portrait";
import { ResourceCardRow, ResourcePalette, ResourceTray } from "./dock-resource";
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
            ? "Trade: go to the open trade offer"
            : isOpen
              ? "Trade: close trading"
              : `Trade with the bank or the crew${lockReason ? `. ${lockReason}` : ""}`
        }
        art={<TileArt src={ACTION_ICON_ASSET_PATHS.trade} />}
        caption="Bank or crew"
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
        state={{ kind: lockReason || isPaused ? "quiet" : "ready" }}
        title="Trade"
        tooltip={`Trade with the bank or the crew${lockReason ? `. ${lockReason}` : ""}`}
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
          {legal.canProposeTrade ? (
            <div aria-labelledby="trade-recipients-label" className="game-trade-ask" role="group">
              <span className="game-trade-side-label" id="trade-recipients-label">
                Ask
              </span>
              {opponents.map((player) => {
                const selected = recipientPlayerIds.includes(player.id);
                return (
                  <Tooltip
                    key={player.id}
                    label={`${player.displayName}: ${selected ? "will get this offer" : "left out"}`}
                    side="top"
                  >
                    <button
                      aria-label={player.displayName}
                      aria-pressed={selected}
                      className="game-trade-recipient"
                      disabled={busy}
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
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ) : null}
          {/* One gold button at a time: the bank's when these cards are a bank trade as they
              stand, otherwise the offer to the crew. */}
          <Button
            aria-describedby="trade-composer-status"
            disabled={busy || !matchingBankTrade}
            onClick={() => void tradeWithBank()}
            size="game-md"
            variant={matchingBankTrade ? "game-gold" : "game-secondary"}
          >
            {sending === "bank" ? <Spinner /> : <Icon aria-hidden="true" icon={storeIcon} />}
            {matchingBankTrade ? `Bank ${matchingBankTrade.ratio}:1` : "Bank"}
          </Button>
          <Button
            aria-describedby="trade-composer-status"
            disabled={busy || !canSendOffer}
            onClick={() => void sendOffer()}
            size="game-md"
            variant={matchingBankTrade ? "game-secondary" : "game-gold"}
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
      {/* Give by tapping cards in the hand just below: they move up into the tray, and a tap on a
          tray card sends one back. Ask by tapping the small cards under "You get". */}
      <div className="game-trade-composer">
        <section aria-labelledby="trade-give-label" className="game-trade-side">
          <h3 className="game-trade-side-label" id="trade-give-label">
            You give
          </h3>
          <ResourceTray
            cards={give}
            disabled={busy}
            emptyText="Tap cards in your hand"
            label="Cards you give"
            onRemove={(resource) => change(setGive, resource, -1)}
          />
          <p className="game-trade-rate">{formatBankRates(getBankRates(game.board, me.id))}</p>
        </section>
        <Icon aria-hidden="true" className="game-trade-arrow" icon={arrowRightIcon} />
        <section aria-labelledby="trade-get-label" className="game-trade-side">
          <h3 className="game-trade-side-label" id="trade-get-label">
            You get
          </h3>
          <ResourceTray
            cards={want}
            disabled={busy}
            emptyText="Tap a card below"
            label="Cards you get"
            onRemove={(resource) => change(setWant, resource, -1)}
          />
          <ResourcePalette
            canAdd={(resource) => give[resource] === 0 && want[resource] < bankResourceCount}
            disabled={busy}
            label="Add a card you get"
            onAdd={(resource) => change(setWant, resource, 1)}
          />
        </section>
      </div>
      <DockStatus id="trade-composer-status" tone={status.tone}>
        {status.text}
      </DockStatus>
    </DockSheet>
  );
}

/** "Bank: 4 for 1" plus any better rate a port gives ("Sheep 2 for 1"). */
function formatBankRates(rates: Readonly<Record<ResourceType, number>>): string {
  const base = Math.max(...RESOURCE_ORDER.map((resource) => rates[resource]));
  const better = RESOURCE_ORDER.filter((resource) => rates[resource] < base).map(
    (resource) => `${RESOURCE_LABELS[resource]} ${rates[resource]} for 1`,
  );
  return [`Bank: ${base} for 1`, ...better].join(" · ");
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
      return { text: `Now tap what you want to get. Tip: ${bankHint}`, tone: "neutral" };
    }
  }
  if (!legal.canProposeTrade) {
    return { text: "You can't offer trades right now", tone: "neutral" };
  }
  if (!hasGive && !hasWant) {
    return { text: "Tap cards in your hand to give them", tone: "neutral" };
  }
  if (!hasGive) {
    return { text: "Tap cards in your hand to give them", tone: "neutral" };
  }
  if (!hasWant) {
    return { text: "Now tap what you want to get", tone: "neutral" };
  }
  if (!hasRecipients) {
    return { text: "Pick who to ask", tone: "neutral" };
  }
  return {
    text: `Ready: ${formatInventory(give)} for ${formatInventory(want)}`,
    tone: "ready",
  };
}

type TradeRole = "observer" | "proposer" | "recipient";
type ReplyState = "accepted" | "countered" | "declined" | "pending";

const REPLY_LABELS: Readonly<Record<ReplyState, string>> = {
  accepted: "Accepted",
  countered: "Countered",
  declined: "Declined",
  pending: "Pending",
};

const REPLY_ICONS: Readonly<Record<ReplyState, IconifyIcon>> = {
  accepted: checkIcon,
  countered: counterIcon,
  declined: closeIcon,
  pending: hourglassIcon,
};

function getReplyState(offer: TradeOffer, playerId: string): ReplyState {
  if (offer.acceptedPlayerIds.includes(playerId)) {
    return "accepted";
  }
  if (offer.counterOffers.some((counter) => counter.playerId === playerId)) {
    return "countered";
  }
  return offer.rejectedPlayerIds.includes(playerId) ? "declined" : "pending";
}

/**
 * The open trade offer, as each player sees it: the proposer follows the answers and picks a
 * partner, a recipient accepts, declines or counters (then sees their answer), and everyone else
 * watches.
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
  // The counter editor belongs to the offer it was opened on, so a new offer starts closed.
  const [counteringOffer, setCounteringOffer] = useState<number | null>(null);
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

  if (legal.canCounterTrade && counteringOffer === offer.offerActionNumber) {
    return (
      <CounterComposer
        disabled={disabled}
        game={game}
        key={offer.offerActionNumber}
        me={me}
        offer={offer}
        onBack={() => setCounteringOffer(null)}
        onSend={(give, want) =>
          send(
            "counter",
            { give, kind: "counter_trade", offerActionNumber: offer.offerActionNumber, want },
            "Counter-offer sent.",
          )
        }
        proposerName={proposerName}
        sending={isSending("counter")}
      />
    );
  }

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
            {legal.canCounterTrade ? (
              <Button
                disabled={disabled}
                onClick={() =>
                  isPaused ? onPausedAction() : setCounteringOffer(offer.offerActionNumber)
                }
                size="game-md"
                variant="game-secondary"
              >
                <Icon aria-hidden="true" icon={counterIcon} />
                Counter
              </Button>
            ) : null}
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
            // A counter-offer gets its own line below, with its cards and its Trade button.
            if (state === "countered" && !compact) {
              return null;
            }
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
      {compact || offer.counterOffers.length === 0 ? null : (
        <ul aria-label="Counter-offers" className="game-trade-counters">
          {offer.counterOffers.map((counter) => {
            const player = playerById(counter.playerId);
            return player ? (
              <TradeCounterRow
                canTrade={legal.tradePartnerPlayerIds.includes(counter.playerId)}
                counter={counter}
                disabled={disabled}
                key={counter.playerId}
                onTrade={() =>
                  send(
                    counter.playerId,
                    {
                      kind: "confirm_trade",
                      offerActionNumber: offer.offerActionNumber,
                      partnerPlayerId: counter.playerId,
                    },
                    `Traded with ${player.displayName}.`,
                  )
                }
                player={player}
                proposerHand={role === "proposer" ? me.resources : null}
                proposerName={proposerName}
                sending={isSending(counter.playerId)}
              />
            ) : null;
          })}
        </ul>
      )}
      <DockStatus id="trade-offer-status" tone={status.tone}>
        {status.text}
      </DockStatus>
    </DockSheet>
  );
}

/**
 * One counter-offer as a line: who asks, the cards they want from the proposer, and the cards
 * they would hand over. The proposer gets a Trade button on it; everyone else just reads it.
 */
function TradeCounterRow({
  canTrade,
  counter,
  disabled,
  onTrade,
  player,
  proposerHand,
  proposerName,
  sending,
}: {
  canTrade: boolean;
  counter: TradeCounterOffer;
  disabled: boolean;
  onTrade(): void;
  player: PlayerViewState;
  /** The viewer's hand when the counter is theirs to accept; null for everyone else. */
  proposerHand: Readonly<ResourceInventory> | null;
  proposerName: string;
  sending: boolean;
}) {
  const name = player.isViewer ? "You" : player.displayName;
  const from = proposerHand ? "your" : `${proposerName}'s`;
  const shortOf = proposerHand ? getMissingInventory(counter.give, proposerHand) : undefined;

  return (
    <li
      aria-label={`${name} countered: ${from} ${formatInventory(counter.give)} for ${formatInventory(counter.want)}`}
      className="game-trade-counter"
    >
      <DockPortrait player={player} />
      <span aria-hidden="true" className="game-trade-counter-word">
        <span className="game-trade-counter-name">{name} </span>
        {player.isViewer ? "want" : "wants"}
      </span>
      <ResourceCardRow inventory={counter.give} label={`${name} would get`} shortOf={shortOf} />
      <span aria-hidden="true" className="game-trade-counter-word">
        for
      </span>
      <ResourceCardRow inventory={counter.want} label={`${name} would give`} />
      {proposerHand ? (
        <Button
          aria-label={`Trade with ${player.displayName} on their counter-offer`}
          className="game-trade-counter-action"
          disabled={disabled || !canTrade}
          onClick={onTrade}
          size="game-sm"
          variant="game-gold"
        >
          {sending ? <Spinner /> : <Icon aria-hidden="true" icon={handshakeIcon} />}
          Trade
        </Button>
      ) : null}
    </li>
  );
}

/**
 * A recipient changes the offer instead of accepting it. It opens on the offer as it stands, read
 * from the recipient's side, and works like the trade composer: cards tapped in the hand move
 * into "You give", and the small cards under "You get" add to the ask.
 */
function CounterComposer({
  disabled,
  game,
  me,
  offer,
  onBack,
  onSend,
  proposerName,
  sending,
}: {
  disabled: boolean;
  game: PlayerGameView;
  me: PrivatePlayerState;
  offer: TradeOffer;
  onBack(): void;
  /** In the offer's own terms: what the proposer hands over, then what they get. */
  onSend(give: ResourceInventory, want: ResourceInventory): void;
  proposerName: string;
  sending: boolean;
}) {
  const { clearInteraction, setInteraction } = useHandDock();
  // The recipient pays what the proposer wants, as far as their hand goes.
  const [youGive, setYouGive] = useState<ResourceInventory>(() => {
    const affordable = emptyInventory();
    for (const resource of RESOURCE_ORDER) {
      affordable[resource] = Math.min(offer.want[resource], me.resources[resource]);
    }
    return affordable;
  });
  const [youGet, setYouGet] = useState<ResourceInventory>(() => ({ ...offer.give }));
  const bankResourceCount = getGameMapDefinition(game.settings.map).bankResourceCount;
  const missing = getMissingInventory(youGive, me.resources);
  const unchanged = RESOURCE_ORDER.every(
    (resource) =>
      youGive[resource] === offer.want[resource] && youGet[resource] === offer.give[resource],
  );
  const status = getCounterStatus({ missing, proposerName, unchanged, youGet, youGive });

  const change = (
    setSide: (update: (current: ResourceInventory) => ResourceInventory) => void,
    resource: ResourceType,
    delta: -1 | 1,
  ) => setSide((current) => ({ ...current, [resource]: Math.max(0, current[resource] + delta) }));

  useEffect(() => {
    setInteraction("trade", {
      disabled,
      label: "your counter-offer",
      onSelect: (resource) => {
        if (youGet[resource] === 0) {
          setYouGive((current) =>
            current[resource] >= me.resources[resource]
              ? current
              : { ...current, [resource]: current[resource] + 1 },
          );
        }
      },
      selected: youGive,
      sourceResources: me.resources,
    });
    return () => clearInteraction("trade");
  }, [clearInteraction, disabled, me.resources, setInteraction, youGet, youGive]);

  return (
    <DockSheet
      footer={
        <>
          <Button disabled={disabled} onClick={onBack} size="game-md" variant="game-secondary">
            Back
          </Button>
          <Button
            aria-describedby="trade-counter-status"
            disabled={disabled || status.tone !== "ready"}
            onClick={() => onSend(youGet, youGive)}
            size="game-md"
            variant="game-gold"
          >
            {sending ? <Spinner /> : <Icon aria-hidden="true" icon={counterIcon} />}
            Send counter
          </Button>
        </>
      }
      id={TRADE_OFFER_ID}
      onClose={onBack}
      sheetRef={focusOnAttach}
      title="Counter-offer"
      titleId="trade-offer-title"
    >
      <div className="game-trade-composer">
        <section aria-labelledby="trade-counter-give-label" className="game-trade-side">
          <h3 className="game-trade-side-label" id="trade-counter-give-label">
            You give
          </h3>
          <ResourceTray
            cards={youGive}
            disabled={disabled}
            emptyText="Tap cards in your hand"
            label="Cards you give"
            onRemove={(resource) => change(setYouGive, resource, -1)}
          />
        </section>
        <Icon aria-hidden="true" className="game-trade-arrow" icon={arrowRightIcon} />
        <section aria-labelledby="trade-counter-get-label" className="game-trade-side">
          <h3 className="game-trade-side-label" id="trade-counter-get-label">
            You get
          </h3>
          <ResourceTray
            cards={youGet}
            disabled={disabled}
            emptyText="Tap a card below"
            label="Cards you get"
            onRemove={(resource) => change(setYouGet, resource, -1)}
          />
          <ResourcePalette
            canAdd={(resource) => youGive[resource] === 0 && youGet[resource] < bankResourceCount}
            disabled={disabled}
            label="Add a card you get"
            onAdd={(resource) => change(setYouGet, resource, 1)}
          />
        </section>
      </div>
      <DockStatus id="trade-counter-status" tone={status.tone}>
        {status.text}
      </DockStatus>
    </DockSheet>
  );
}

function getCounterStatus({
  missing,
  proposerName,
  unchanged,
  youGet,
  youGive,
}: {
  missing: Readonly<ResourceInventory>;
  proposerName: string;
  unchanged: boolean;
  youGet: Readonly<ResourceInventory>;
  youGive: Readonly<ResourceInventory>;
}): { text: string; tone: "error" | "neutral" | "ready" } {
  if (totalResources(missing) > 0) {
    return { text: `You no longer have ${formatInventory(missing)}`, tone: "error" };
  }
  if (unchanged) {
    return { text: `Change the cards, then send it back to ${proposerName}`, tone: "neutral" };
  }
  if (totalResources(youGive) === 0) {
    return { text: "Tap cards in your hand to give them", tone: "neutral" };
  }
  if (totalResources(youGet) === 0) {
    return { text: "Now tap what you want to get", tone: "neutral" };
  }
  return {
    text: `Ready: ${formatInventory(youGive)} for ${formatInventory(youGet)}`,
    tone: "ready",
  };
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
      if (getTradeTermsWith(offer, me.id)) {
        return {
          text: `${offer.acceptedPlayerIds.includes(me.id) ? "Accepted" : "Counter sent"}. Waiting for ${proposerName}`,
          tone: "ready",
        };
      }
      return { text: "You passed on this offer", tone: "neutral" };
    case "proposer": {
      const [onlyPartnerId, ...otherPartnerIds] = legal.tradePartnerPlayerIds;
      if (onlyPartnerId) {
        return {
          text:
            otherPartnerIds.length === 0
              ? `Trade with ${nameOf(onlyPartnerId)} to swap cards`
              : "Pick who to trade with",
          tone: "ready",
        };
      }
      if (waitingCount > 0) {
        return { text: "Waiting for answers…", tone: "neutral" };
      }
      return {
        text:
          offer.counterOffers.length > 0
            ? "You don't have the cards they ask for"
            : "No one who accepted can pay right now",
        tone: "error",
      };
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
