import {
  DEVELOPMENT_CARD_TYPES,
  RESOURCE_ORDER,
  getBoardTopology,
  getDiceProduction,
  type DevelopmentCardType,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
  type ResourceType,
} from "@settersaga/game";

import { DEVELOPMENT_CARD_ASSETS } from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import type { RoomEventView } from "@/lib/game/types";

/**
 * Where a card leaves from or lands. The viewer's own cards use their hand: a resource's card, the
 * playable development cards, or the victory point card.
 */
export type FlightEndpoint =
  | { kind: "bank"; resource: ResourceType | null }
  | { kind: "bank-development" }
  | { kind: "hand"; resource: ResourceType }
  | { kind: "hand-development" }
  | { kind: "hand-victory-point" }
  | { kind: "player"; pile: "development" | "resources"; playerId: string }
  | { kind: "tile"; tileId: string };

/**
 * What the flying card shows: a resource's face, the unknown resource's back, or a development
 * card: its face (`card`) for the viewer who bought it, its back for everyone else.
 */
export type FlightCard =
  | { card?: DevelopmentCardType; kind: "development" }
  | { kind: "hidden-resource" }
  | { kind: "resource"; resource: ResourceType };

export interface CardFlight {
  card: FlightCard;
  /** The cards this flight carries; its label counts them all. */
  count: number;
  /** When the flight's first card pops at the source, from the start of the burst. */
  delayMs: number;
  from: FlightEndpoint;
  /** Cards drawn: at most a few per flight, each `staggerMs` after the one before. */
  spriteCount: number;
  to: FlightEndpoint;
}

/** "+2" by a destination as its cards land, or "−1" by a player's cards as they leave. */
export interface FlightLabel {
  at: FlightEndpoint;
  delayMs: number;
  /** The fuller words shown instead of any flight when motion is reduced: "+1 Wood". */
  detail: string;
  text: string;
  tone: "gain" | "loss";
}

export interface CardFlightPlan {
  /** When the last card has landed, from the first card's pop. */
  durationMs: number;
  flights: CardFlight[];
  labels: FlightLabel[];
  /** A wait before the first card pops: a roll's cards leave as its dice settle. */
  leadMs: number;
  staggerMs: number;
}

export const CARD_FLIGHT_TIMING = {
  /** A whole burst lands within this. */
  burstMs: 1_400,
  flightMs: 580,
  labelMs: 700,
  popMs: 140,
  /** Reduced motion: only the label, held a little longer. */
  reducedLabelMs: 1_000,
  /** The turn card's dice land over 650ms (styles/game-layout.css); the cards leave near the end. */
  rollLeadMs: 400,
  staggerMs: 70,
} as const;

/** Beyond these the counts still read right in the labels; only fewer cards are drawn. */
const MAX_SPRITES = 24;
const MAX_SPRITES_PER_FLIGHT = 4;

const SYSTEM_EVENT_KINDS: ReadonlySet<RoomEventView["kind"]> = new Set([
  "bot_control_started",
  "game_paused",
  "game_resumed",
  "game_started",
]);

/** A hidden bank covers every claim as far as the client can tell; the counts then confirm it. */
const UNLIMITED_BANK: ResourceInventory = {
  brick: Number.POSITIVE_INFINITY,
  sheep: Number.POSITIVE_INFINITY,
  stone: Number.POSITIVE_INFINITY,
  tree: Number.POSITIVE_INFINITY,
  wheat: Number.POSITIVE_INFINITY,
};

/** Any number the dice show; the opening payout "rolls" it on the new settlement's tiles. */
const OPENING_PAYOUT_NUMBER = 2;

/** Cards that moved: by resource where the viewer can know it, otherwise only how many. */
type MovedCards = readonly { count: number; resource: ResourceType | null }[];

interface CardMove {
  card: FlightCard;
  count: number;
  from: FlightEndpoint;
  to: FlightEndpoint;
}

/**
 * The cards one move sent between the players, the bank and the board, as the viewer may see
 * them. Only a single action with its event is planned; a first view, a jump of several actions
 * or anything the views cannot account for exactly plans nothing.
 *
 * Other players' hands are public only as a count, so their cards fly face down unless the move
 * itself makes the resource public: the dice and the opening payout (from the board), a player
 * trade (the offer), and the bank's own counts when the host shows them. A bought development card
 * flies face up only to its buyer.
 */
export function planCardFlights(
  previous: PlayerGameView,
  next: PlayerGameView,
  newEvents: readonly Pick<RoomEventView, "actorPlayerId" | "kind" | "targetPlayerId">[],
): CardFlightPlan | null {
  if (
    next.actionNumber !== previous.actionNumber + 1 ||
    next.viewerPlayerId !== previous.viewerPlayerId
  ) {
    return null;
  }
  const moves = newEvents.filter((event) => !SYSTEM_EVENT_KINDS.has(event.kind));
  const [event] = moves;
  if (!event || moves.length !== 1) {
    return null;
  }

  const cardMoves = getCardMoves(describeViewChange(previous, next), event);
  return cardMoves.length > 0
    ? scheduleCardMoves(cardMoves, event.kind === "roll" ? CARD_FLIGHT_TIMING.rollLeadMs : 0)
    : null;
}

/** What one action changed, as the viewer can see it. */
interface ViewChange {
  /** Null while the host hides the bank's counts. */
  bankChange: ResourceInventory | null;
  countChange(playerId: string): number;
  handChange: ResourceInventory;
  isViewer(playerId: string): boolean;
  next: PlayerGameView;
  previous: PlayerGameView;
  /** A player's resource cards: the matching hand card for the viewer, a player row otherwise. */
  resourcesOf(playerId: string, resource: ResourceType | null): FlightEndpoint;
  viewerPlayerId: string;
}

function describeViewChange(previous: PlayerGameView, next: PlayerGameView): ViewChange {
  const viewerPlayerId = next.viewerPlayerId;
  const isViewer = (playerId: string) => playerId === viewerPlayerId;
  return {
    bankChange: previous.bank && next.bank ? inventoryChange(previous.bank, next.bank) : null,
    countChange(playerId) {
      const before = previous.players.find((player) => player.id === playerId);
      const after = next.players.find((player) => player.id === playerId);
      return before && after ? after.resourceCount - before.resourceCount : 0;
    },
    handChange: inventoryChange(getViewer(previous).resources, getViewer(next).resources),
    isViewer,
    next,
    previous,
    resourcesOf(playerId, resource) {
      return isViewer(playerId) && resource
        ? { kind: "hand", resource }
        : { kind: "player", pile: "resources", playerId };
    },
    viewerPlayerId,
  };
}

function getCardMoves(
  change: ViewChange,
  event: Pick<RoomEventView, "actorPlayerId" | "kind" | "targetPlayerId">,
): CardMove[] {
  const actor = event.actorPlayerId;
  switch (event.kind) {
    case "roll":
      return getRollMoves(change);
    case "place_settlement":
      return getOpeningPayoutMoves(change, actor);
    case "trade_bank":
      return getBankTradeMoves(change, actor);
    case "confirm_trade":
      return getPlayerTradeMoves(change, actor, event.targetPlayerId);
    case "steal":
    case "move_robber_and_steal":
      return getStealMoves(change, actor);
    case "buy_development_card":
      return getDevelopmentPurchaseMoves(change, actor);
    case "discard":
      return getDiscardMoves(change, actor);
    case "play_monopoly":
      return getMonopolyMoves(change, actor);
    case "play_year_of_plenty":
      return getYearOfPlentyMoves(change, actor);
    default:
      return [];
  }
}

/** Each producing tile's cards to their player; a seven pays nothing. */
function getRollMoves(change: ViewChange): CardMove[] {
  const roll = change.next.lastDiceRoll;
  if (!roll || roll.sum === 7 || change.previous.phase.kind !== "roll") {
    return [];
  }

  return getPayoutMoves(
    change,
    getDiceProduction(change.next.board, roll.sum, change.previous.bank ?? UNLIMITED_BANK),
  );
}

/**
 * The second opening settlement's cards, one per neighbouring tile while the bank has them: the
 * dice rule for a lone claimant, so it runs through the same helper with the new settlement's
 * tiles all showing one number.
 */
function getOpeningPayoutMoves(change: ViewChange, playerId: string): CardMove[] {
  const { next, previous } = change;
  if (
    previous.phase.kind !== "setup_settlement" ||
    previous.phase.setupIndex < previous.players.length
  ) {
    return [];
  }
  const placed = next.board.buildings.find(
    (building) =>
      building.playerId === playerId &&
      !previous.board.buildings.some((earlier) => earlier.vertexKey === building.vertexKey),
  );
  if (!placed) {
    return [];
  }

  const neighbours = new Set(getBoardTopology(next.board.tiles).vertexTileIds[placed.vertexKey]);
  const board: Parameters<typeof getDiceProduction>[0] = {
    buildings: [placed],
    robberTileId: "",
    tiles: next.board.tiles.map((tile) => ({
      ...tile,
      numberToken: neighbours.has(tile.id) ? OPENING_PAYOUT_NUMBER : null,
    })),
  };
  return getPayoutMoves(
    change,
    getDiceProduction(board, OPENING_PAYOUT_NUMBER, previous.bank ?? UNLIMITED_BANK),
  );
}

/**
 * Tile payouts, face up (the board makes them public), for the players whose cards match them
 * exactly. A hidden bank may have come up short; a player whose count shows it gets no flights.
 */
function getPayoutMoves(
  change: ViewChange,
  production: ReturnType<typeof getDiceProduction>,
): CardMove[] {
  const matchesCounts = (playerId: string) => {
    const claims = production.filter((claim) => claim.playerId === playerId);
    if (claims.reduce((total, claim) => total + claim.amount, 0) !== change.countChange(playerId)) {
      return false;
    }
    return (
      !change.isViewer(playerId) ||
      RESOURCE_ORDER.every(
        (resource) =>
          claims
            .filter((claim) => claim.resource === resource)
            .reduce((total, claim) => total + claim.amount, 0) === change.handChange[resource],
      )
    );
  };

  return production
    .filter((claim) => matchesCounts(claim.playerId))
    .map((claim) => ({
      card: { kind: "resource", resource: claim.resource },
      count: claim.amount,
      from: { kind: "tile", tileId: claim.tileId },
      to: change.resourcesOf(claim.playerId, claim.resource),
    }));
}

/** The traded cards to the bank, then the bought card back. */
function getBankTradeMoves(change: ViewChange, playerId: string): CardMove[] {
  const ratio = 1 - change.countChange(playerId);
  if (ratio < 2) {
    return [];
  }

  const known = change.isViewer(playerId)
    ? change.handChange
    : change.bankChange && scaleInventory(change.bankChange, -1);
  const given = known ? losses(known) : [{ count: ratio, resource: null }];
  const received = known ? gains(known) : [{ count: 1, resource: null }];
  if (countOf(given) !== ratio || countOf(received) !== 1) {
    return [];
  }

  return [
    ...given.map(({ count, resource }) => ({
      card: cardFor(resource),
      count,
      from: change.resourcesOf(playerId, resource),
      to: { kind: "bank", resource } as const,
    })),
    ...received.map(({ count, resource }) => ({
      card: cardFor(resource),
      count,
      from: { kind: "bank", resource } as const,
      to: change.resourcesOf(playerId, resource),
    })),
  ];
}

/**
 * Both sides of a confirmed offer, face up: the offer was public, and so is the partner the event
 * names (its log line says who traded with whom).
 */
function getPlayerTradeMoves(
  change: ViewChange,
  proposerPlayerId: string,
  namedPartnerPlayerId: string | undefined,
): CardMove[] {
  const offer = change.previous.tradeOffer;
  if (!offer || offer.proposerPlayerId !== proposerPlayerId) {
    return [];
  }
  const partnerPlayerId = namedPartnerPlayerId
    ? offer.acceptedPlayerIds.includes(namedPartnerPlayerId)
      ? namedPartnerPlayerId
      : null
    : findTradePartner(change, offer);
  const givenCount = countOf(gains(offer.give));
  const wantedCount = countOf(gains(offer.want));
  if (
    !partnerPlayerId ||
    change.countChange(proposerPlayerId) !== wantedCount - givenCount ||
    change.countChange(partnerPlayerId) !== givenCount - wantedCount
  ) {
    return [];
  }

  const between = (from: string, to: string, cards: ResourceInventory) =>
    gains(cards).map(({ count, resource }) => ({
      card: cardFor(resource),
      count,
      from: change.resourcesOf(from, resource),
      to: change.resourcesOf(to, resource),
    }));
  return [
    ...between(proposerPlayerId, partnerPlayerId, offer.give),
    ...between(partnerPlayerId, proposerPlayerId, offer.want),
  ];
}

/**
 * Who the proposer traded with, when the event does not name them: the viewer knows from their
 * own hand, and an uneven trade shows in the counts. An even trade otherwise stays unknown.
 */
function findTradePartner(
  change: ViewChange,
  offer: NonNullable<PlayerGameView["tradeOffer"]>,
): string | null {
  const viewerTraded = RESOURCE_ORDER.some((resource) => change.handChange[resource] !== 0);
  if (offer.acceptedPlayerIds.includes(change.viewerPlayerId) && viewerTraded) {
    return change.viewerPlayerId;
  }

  const partnerChange = countOf(gains(offer.give)) - countOf(gains(offer.want));
  const candidates = offer.acceptedPlayerIds.filter(
    (playerId) => !change.isViewer(playerId) && change.countChange(playerId) === partnerChange,
  );
  return candidates.length === 1 ? candidates[0]! : null;
}

/** One card from the victim to the thief: face up only for those two. */
function getStealMoves(change: ViewChange, thiefPlayerId: string): CardMove[] {
  const victims = change.next.players.filter((player) => change.countChange(player.id) === -1);
  const [victim] = victims;
  if (!victim || victims.length !== 1 || change.countChange(thiefPlayerId) !== 1) {
    return [];
  }

  const resource = change.isViewer(thiefPlayerId)
    ? gains(change.handChange)[0]?.resource
    : change.isViewer(victim.id)
      ? losses(change.handChange)[0]?.resource
      : null;
  return [
    {
      card: cardFor(resource ?? null),
      count: 1,
      from: change.resourcesOf(victim.id, resource ?? null),
      to: change.resourcesOf(thiefPlayerId, resource ?? null),
    },
  ];
}

/**
 * The bought card from the bank's pile: face down to the buyer's row for everyone else, and face
 * up to the buyer, whose own view shows which card it is. A victory point card lands on the hand's
 * victory point card, any other on the development cards.
 */
function getDevelopmentPurchaseMoves(change: ViewChange, playerId: string): CardMove[] {
  if (change.next.developmentCardSupply !== change.previous.developmentCardSupply - 1) {
    return [];
  }
  const from: FlightEndpoint = { kind: "bank-development" };
  if (!change.isViewer(playerId)) {
    return [
      {
        card: { kind: "development" },
        count: 1,
        from,
        to: { kind: "player", pile: "development", playerId },
      },
    ];
  }

  const bought = getBoughtDevelopmentCard(change);
  return [
    {
      card: bought ? { card: bought, kind: "development" } : { kind: "development" },
      count: 1,
      from,
      to:
        bought === "victory-point" ? { kind: "hand-victory-point" } : { kind: "hand-development" },
    },
  ];
}

/** The one card the viewer's development cards gained, or null if the views show otherwise. */
function getBoughtDevelopmentCard(change: ViewChange): DevelopmentCardType | null {
  const before = getViewer(change.previous).developmentCards;
  const after = getViewer(change.next).developmentCards;
  if (after.length !== before.length + 1) {
    return null;
  }
  const countIn = (cards: readonly DevelopmentCardType[], type: DevelopmentCardType) =>
    cards.filter((card) => card === type).length;
  const gained = DEVELOPMENT_CARD_TYPES.filter(
    (type) => countIn(after, type) === countIn(before, type) + 1,
  );
  return gained.length === 1 ? gained[0]! : null;
}

/** The discarded cards to the bank. */
function getDiscardMoves(change: ViewChange, playerId: string): CardMove[] {
  const discarded = -change.countChange(playerId);
  if (discarded <= 0) {
    return [];
  }

  const cards = knownOrCount(
    change.isViewer(playerId) ? losses(change.handChange) : gains(change.bankChange),
    discarded,
  );
  return cards.map(({ count, resource }) => ({
    card: cardFor(resource),
    count,
    from: change.resourcesOf(playerId, resource),
    to: { kind: "bank", resource },
  }));
}

/** Every other player's cards of the named resource to the player. */
function getMonopolyMoves(change: ViewChange, playerId: string): CardMove[] {
  const victims = change.next.players.flatMap((player) => {
    const lost = -change.countChange(player.id);
    return player.id !== playerId && lost > 0 ? [{ lost, playerId: player.id }] : [];
  });
  const collected = victims.reduce((total, victim) => total + victim.lost, 0);
  if (collected === 0 || change.countChange(playerId) !== collected) {
    return [];
  }

  // The viewer knows the resource if they played the card or lost cards to it.
  const resource = change.isViewer(playerId)
    ? gains(change.handChange)[0]?.resource
    : losses(change.handChange)[0]?.resource;
  return victims.map((victim) => ({
    card: cardFor(resource ?? null),
    count: victim.lost,
    from: change.resourcesOf(victim.playerId, resource ?? null),
    to: change.resourcesOf(playerId, resource ?? null),
  }));
}

/** The two chosen cards from the bank. */
function getYearOfPlentyMoves(change: ViewChange, playerId: string): CardMove[] {
  const taken = change.countChange(playerId);
  if (taken <= 0) {
    return [];
  }

  const cards = knownOrCount(
    change.isViewer(playerId) ? gains(change.handChange) : losses(change.bankChange),
    taken,
  );
  return cards.map(({ count, resource }) => ({
    card: cardFor(resource),
    count,
    from: { kind: "bank", resource },
    to: change.resourcesOf(playerId, resource),
  }));
}

/** Cards in flight order, each popping `staggerMs` after the last, the burst kept short. */
function scheduleCardMoves(moves: readonly CardMove[], leadMs: number): CardFlightPlan {
  const spriteCounts = moves.map((move) => Math.min(move.count, MAX_SPRITES_PER_FLIGHT));
  // A crowded burst draws one card less for its largest flights first, then drops the last ones.
  while (spriteCounts.reduce((total, count) => total + count, 0) > MAX_SPRITES) {
    const largest = Math.max(...spriteCounts);
    const index = spriteCounts.lastIndexOf(largest > 1 ? largest : 1);
    spriteCounts[index]! -= 1;
  }

  const { burstMs, flightMs, popMs } = CARD_FLIGHT_TIMING;
  const spriteTotal = spriteCounts.reduce((total, count) => total + count, 0);
  const departureRoom = burstMs - popMs - flightMs;
  const staggerMs =
    spriteTotal > 1
      ? Math.min(CARD_FLIGHT_TIMING.staggerMs, Math.floor(departureRoom / (spriteTotal - 1)))
      : 0;

  let departed = 0;
  const flights = moves.flatMap((move, index): CardFlight[] => {
    const spriteCount = spriteCounts[index]!;
    const delayMs = departed * staggerMs;
    departed += spriteCount;
    return spriteCount > 0 ? [{ ...move, delayMs, spriteCount }] : [];
  });
  const lastDeparture = Math.max(0, spriteTotal - 1) * staggerMs;

  return {
    durationMs: lastDeparture + popMs + flightMs,
    flights,
    labels: [
      ...groupLabels(flights, "loss", (flight) => flight.from, 0),
      ...groupLabels(flights, "gain", (flight) => flight.to, popMs + flightMs),
    ],
    leadMs,
    staggerMs,
  };
}

/**
 * One label per player's cards or hand card: the flights' counts added up, shown as the first of
 * them leaves or lands. Tiles and the bank are not labelled.
 */
function groupLabels(
  flights: readonly CardFlight[],
  tone: FlightLabel["tone"],
  endpointOf: (flight: CardFlight) => FlightEndpoint,
  offsetMs: number,
): FlightLabel[] {
  const groups = new Map<string, CardFlight[]>();
  for (const flight of flights) {
    const endpoint = endpointOf(flight);
    if (
      endpoint.kind === "tile" ||
      endpoint.kind === "bank" ||
      endpoint.kind === "bank-development"
    ) {
      continue;
    }
    const key = getFlightEndpointKey(endpoint);
    groups.set(key, [...(groups.get(key) ?? []), flight]);
  }

  const sign = tone === "gain" ? "+" : "−";
  return [...groups.values()].map((group) => {
    const count = group.reduce((total, flight) => total + flight.count, 0);
    return {
      at: endpointOf(group[0]!),
      delayMs: Math.min(...group.map((flight) => flight.delayMs)) + offsetMs,
      detail: describeCards(group, sign),
      text: `${sign}${count}`,
      tone,
    };
  });
}

/** "+1 Wood", "+2 Wood +1 Brick", "−1 card", "+1 development card", "+1 Victory Point". */
function describeCards(flights: readonly CardFlight[], sign: string): string {
  const parts = new Map<string, number>();
  for (const { card, count } of flights) {
    const name =
      card.kind === "resource"
        ? RESOURCE_LABELS[card.resource]
        : card.kind === "development"
          ? (DEVELOPMENT_CARD_ASSETS.find((asset) => asset.id === card.card)?.label ??
            "development card")
          : "card";
    parts.set(name, (parts.get(name) ?? 0) + count);
  }
  return [...parts]
    .map(([name, count]) =>
      name.endsWith("card") && count !== 1 ? `${sign}${count} ${name}s` : `${sign}${count} ${name}`,
    )
    .join(" ");
}

/** A stable name for an endpoint, for grouping and for finding its element on screen. */
export function getFlightEndpointKey(endpoint: FlightEndpoint): string {
  switch (endpoint.kind) {
    case "bank":
      return `bank:${endpoint.resource ?? "any"}`;
    case "bank-development":
      return "bank:development";
    case "hand":
      return `hand:${endpoint.resource}`;
    case "hand-development":
      return "hand:development";
    case "hand-victory-point":
      return "hand:victory-point";
    case "player":
      return `player:${endpoint.playerId}:${endpoint.pile}`;
    case "tile":
      return `tile:${endpoint.tileId}`;
  }
}

function getViewer(view: PlayerGameView): PrivatePlayerState {
  const viewer = view.players.find((player): player is PrivatePlayerState => player.isViewer);
  if (!viewer) {
    throw new Error("Validated player view is missing the viewer.");
  }
  return viewer;
}

function cardFor(resource: ResourceType | null): FlightCard {
  return resource ? { kind: "resource", resource } : { kind: "hidden-resource" };
}

function inventoryChange(
  before: Readonly<ResourceInventory>,
  after: Readonly<ResourceInventory>,
): ResourceInventory {
  return {
    brick: after.brick - before.brick,
    sheep: after.sheep - before.sheep,
    stone: after.stone - before.stone,
    tree: after.tree - before.tree,
    wheat: after.wheat - before.wheat,
  };
}

function scaleInventory(inventory: Readonly<ResourceInventory>, factor: number): ResourceInventory {
  return {
    brick: inventory.brick * factor,
    sheep: inventory.sheep * factor,
    stone: inventory.stone * factor,
    tree: inventory.tree * factor,
    wheat: inventory.wheat * factor,
  };
}

/** The resources an inventory change added, in hand order. */
function gains(inventory: Readonly<ResourceInventory> | null): MovedCards {
  return inventory
    ? RESOURCE_ORDER.flatMap((resource) =>
        inventory[resource] > 0 ? [{ count: inventory[resource], resource }] : [],
      )
    : [];
}

function losses(inventory: Readonly<ResourceInventory> | null): MovedCards {
  return gains(inventory && scaleInventory(inventory, -1));
}

function countOf(cards: MovedCards): number {
  return cards.reduce((total, card) => total + card.count, 0);
}

/** The known cards when they account for all `count`, or `count` face-down cards. */
function knownOrCount(known: MovedCards, count: number): MovedCards {
  return countOf(known) === count ? known : [{ count, resource: null }];
}

/** A count on screen that a burst changes, and when: from the burst's start, its lead included. */
export interface FlightCountChange {
  atMs: number;
  /** +2 as cards land, −1 as one leaves. */
  delta: number;
  /** The count, by its endpoint's key ("player:p2:resources", "hand:tree", "bank:wheat"). */
  target: string;
}

/**
 * When each count a burst touches changes: a source's as its first card leaves, with its "−1", and
 * a destination's as its first card lands, with its pulse and "+2". The viewer's own row and pill
 * follow their hand; the bank's piles pay out as the board's cards pop.
 */
export function getFlightCountChanges(
  plan: CardFlightPlan,
  viewerPlayerId: string,
): FlightCountChange[] {
  const { flightMs, popMs } = CARD_FLIGHT_TIMING;
  const changes = new Map<string, FlightCountChange>();
  const add = (targets: readonly string[], atMs: number, delta: number) => {
    for (const target of targets) {
      const key = `${target}:${delta < 0 ? "leaves" : "lands"}`;
      const earlier = changes.get(key);
      changes.set(
        key,
        earlier
          ? { atMs: Math.min(earlier.atMs, atMs), delta: earlier.delta + delta, target }
          : { atMs, delta, target },
      );
    }
  };
  for (const flight of plan.flights) {
    const departsMs = plan.leadMs + flight.delayMs;
    add(getCountTargets(flight.from, flight.card, viewerPlayerId), departsMs, -flight.count);
    add(
      getCountTargets(flight.to, flight.card, viewerPlayerId),
      departsMs + popMs + flightMs,
      flight.count,
    );
  }
  return [...changes.values()];
}

/** The counts on screen that hold an endpoint's cards. */
function getCountTargets(
  endpoint: FlightEndpoint,
  card: FlightCard,
  viewerPlayerId: string,
): string[] {
  switch (endpoint.kind) {
    case "hand":
      return [
        getFlightEndpointKey(endpoint),
        getFlightEndpointKey({ kind: "player", pile: "resources", playerId: viewerPlayerId }),
      ];
    case "bank":
      // A bank that hides its counts shows none to hold.
      return endpoint.resource ? [getFlightEndpointKey(endpoint)] : [];
    case "bank-development":
    case "player":
      return [getFlightEndpointKey(endpoint)];
    case "tile":
      // The bank pays for the board's cards.
      return card.kind === "resource"
        ? [getFlightEndpointKey({ kind: "bank", resource: card.resource })]
        : [];
    case "hand-development":
      // The viewer's playable development cards join the hand as they are bought.
      return [];
    case "hand-victory-point":
      // The victory point card counts it as it lands, and the viewer's own row follows the hand.
      return [
        getFlightEndpointKey(endpoint),
        getFlightEndpointKey({ kind: "player", pile: "development", playerId: viewerPlayerId }),
      ];
  }
}

/** Every endpoint the flights leave from or land on, by key. */
export function getFlightEndpointKeys(flights: readonly CardFlight[]): Set<string> {
  return new Set(
    flights.flatMap((flight) => [
      getFlightEndpointKey(flight.from),
      getFlightEndpointKey(flight.to),
    ]),
  );
}

/** After the connection comes back, what arrives is catch-up, not a live move. */
const RESYNC_MS = 1_500;

/** What the flights have seen of the game: the last view and event, and the connection. */
export interface CardFlightTracker {
  game: PlayerGameView;
  lastEventId: string | undefined;
  /** The cards the newest view's move sends, when they are to fly. */
  plan: CardFlightPlan | null;
  /** Until then (`now`'s clock), what arrives is a reconnect's catch-up. */
  resyncUntil: number;
  wasConnected: boolean;
}

export interface CardFlightTrackerInput {
  events: readonly Pick<RoomEventView, "actorPlayerId" | "id" | "kind" | "targetPlayerId">[];
  game: PlayerGameView;
  isConnected: boolean;
  now: number;
  /** False while the tab is in the background. */
  visible: boolean;
}

/**
 * The tracker after the next view, with the cards its move sends when it is one live move: never
 * a first view, a reconnect's catch-up (nor what lands just after the screen opens), a background
 * tab or a jump of several actions.
 */
export function trackCardFlights(
  previous: CardFlightTracker | null,
  { events, game, isConnected, now, visible }: CardFlightTrackerInput,
): CardFlightTracker {
  // Not connected before the first view, so what lands just after the screen opens is catch-up too.
  const reconnected = isConnected && !(previous?.wasConnected ?? false);
  const next: CardFlightTracker = {
    game,
    lastEventId: events.at(-1)?.id,
    plan: null,
    resyncUntil: reconnected ? now + RESYNC_MS : (previous?.resyncUntil ?? 0),
    wasConnected: isConnected,
  };
  if (
    !previous ||
    previous.game.actionNumber === game.actionNumber ||
    !isConnected ||
    now < next.resyncUntil ||
    !visible
  ) {
    return next;
  }

  const seenCount =
    previous.lastEventId === undefined
      ? 0
      : events.findIndex((event) => event.id === previous.lastEventId) + 1;
  if (previous.lastEventId !== undefined && seenCount === 0) {
    return next;
  }
  return { ...next, plan: planCardFlights(previous.game, game, events.slice(seenCount)) };
}
