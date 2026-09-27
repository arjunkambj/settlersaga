import {
  applyCommand,
  chooseAutomatedCommand,
  createDefaultGame,
  emptyInventory,
  getDiceProduction,
  RESOURCE_TYPES,
  toPlayerView,
  type BaseGameSettings,
  type DevelopmentCardType,
  type GameCommand,
  type GamePlayerInput,
  type GameState,
  type ResourceInventory,
} from "@settersaga/game";
import { describe, expect, test } from "bun:test";

import { createCardFlightStore } from "../src/lib/game/card-flight-store";
import {
  CARD_FLIGHT_TIMING,
  getFlightCountChanges,
  getFlightEndpointKey,
  getFlightEndpointKeys,
  planCardFlights,
  trackCardFlights,
  type CardFlight,
  type CardFlightPlan,
  type CardFlightTracker,
  type FlightCountChange,
} from "../src/lib/game/card-flights";
import type { RoomEventView } from "../src/lib/game/types";

const PLAYERS: GamePlayerInput[] = ["p1", "p2", "p3", "p4"].map((id, index) => ({
  displayName: `Player ${index + 1}`,
  id,
  isBot: false,
}));

type EventKind = RoomEventView["kind"];

function hand(cards: Partial<ResourceInventory>): ResourceInventory {
  return { ...emptyInventory(), ...cards };
}

/** The opening placements, keeping every state so a test can pick any step. */
function playSetup(seed: string, settings: Partial<BaseGameSettings> = {}) {
  let state = createDefaultGame(PLAYERS, seed, { friendlyRobber: false, ...settings });
  const steps: { after: GameState; before: GameState; command: GameCommand }[] = [];
  while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
    const command = chooseAutomatedCommand(state, state.activePlayerId);
    const after = applyCommand(state, state.activePlayerId, command);
    steps.push({ after, before: state, command });
    state = after;
  }
  return { state, steps };
}

/** Swaps cards with the bank so each named player holds exactly their hand. */
function withHands(state: GameState, hands: Record<string, Partial<ResourceInventory>>): GameState {
  const bank = { ...state.bank };
  const players = state.players.map((player) => {
    const cards = hands[player.id];
    if (!cards) return player;
    const resources = hand(cards);
    for (const resource of RESOURCE_TYPES) {
      bank[resource] += player.resources[resource] - resources[resource];
    }
    return { ...player, resources };
  });
  return { ...state, bank, players };
}

/** Stacks the balanced dice so the next roll totals `sum`. */
function withNextRoll(state: GameState, sum: number): GameState {
  const first = Math.max(1, sum - 6);
  return {
    ...state,
    balancedDiceBag: Array.from({ length: 10 }, () => ({ first, second: sum - first, sum })),
    phase: { kind: "roll" },
    settings: { ...state.settings, balancedDice: true },
  };
}

function withDevelopmentCard(
  state: GameState,
  playerId: string,
  card: "monopoly" | "year-of-plenty",
) {
  return {
    ...state,
    developmentDeck: state.developmentDeck.toSpliced(state.developmentDeck.indexOf(card), 1),
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, developmentCards: [...player.developmentCards, card] }
        : player,
    ),
  };
}

/** Moves a `card` to the top of the development deck, so the next purchase draws it. */
function withDeckTop(state: GameState, card: DevelopmentCardType): GameState {
  const deck = state.developmentDeck;
  return { ...state, developmentDeck: [card, ...deck.toSpliced(deck.indexOf(card), 1)] };
}

function act(state: GameState, actorPlayerId: string, command: GameCommand) {
  return applyCommand(state, actorPlayerId, command);
}

function plan(
  before: GameState,
  after: GameState,
  viewerPlayerId: string,
  kind: EventKind,
  actorPlayerId: string,
  targetPlayerId?: string,
): CardFlightPlan | null {
  return planCardFlights(
    toPlayerView(before, viewerPlayerId),
    toPlayerView(after, viewerPlayerId),
    [{ actorPlayerId, kind, targetPlayerId }],
  );
}

type Route = Pick<CardFlight, "card" | "count" | "from" | "to">;

/** The flights without their timing, for comparing routes and faces. */
function routes(result: CardFlightPlan | null): Route[] {
  return result?.flights.map(({ card, count, from, to }) => ({ card, count, from, to })) ?? [];
}

const played = playSetup("card-flights");
const game: GameState = { ...played.state, phase: { kind: "build_and_trade" } };
const [first, second, third, fourth] = game.turnOrder as [string, string, string, string];

/** The first player buys a development card, drawing `card` off the top of the deck. */
function buyDevelopmentCard(card: DevelopmentCardType) {
  const before = withDeckTop(withHands(game, { [first]: { sheep: 1, stone: 1, wheat: 1 } }), card);
  return { after: act(before, first, { kind: "buy_development_card" }), before };
}

describe("card flight plans", () => {
  test("a roll flies each tile's cards to every player it pays, face up for everyone", () => {
    const sum = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].find(
      (candidate) =>
        new Set(getDiceProduction(game.board, candidate, game.bank).map((claim) => claim.playerId))
          .size > 1,
    )!;
    const before = withNextRoll(game, sum);
    const after = act(before, before.activePlayerId, { kind: "roll" });
    const production = getDiceProduction(before.board, sum, before.bank);
    const viewer = production[0]!.playerId;
    const result = plan(before, after, viewer, "roll", before.activePlayerId);

    expect(routes(result)).toEqual(
      production.map((claim) => ({
        card: { kind: "resource", resource: claim.resource },
        count: claim.amount,
        from: { kind: "tile", tileId: claim.tileId },
        to:
          claim.playerId === viewer
            ? { kind: "hand", resource: claim.resource }
            : { kind: "player", pile: "resources", playerId: claim.playerId },
      })),
    );
    // Cards leave one after another and every one lands within the burst.
    const departures = result!.flights.flatMap((flight) =>
      Array.from(
        { length: flight.spriteCount },
        (_, index) => flight.delayMs + index * result!.staggerMs,
      ),
    );
    expect(departures).toEqual(departures.toSorted((left, right) => left - right));
    expect(result!.durationMs).toBeLessThanOrEqual(CARD_FLIGHT_TIMING.burstMs);
    expect(result!.labels.filter((label) => label.tone === "gain").length).toBeGreaterThan(0);
  });

  test("a roll's cards wait for the dice to settle; other moves fly at once", () => {
    const sum = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].find(
      (candidate) => getDiceProduction(game.board, candidate, game.bank).length > 0,
    )!;
    const before = withNextRoll(game, sum);
    const after = act(before, before.activePlayerId, { kind: "roll" });
    expect(plan(before, after, first, "roll", before.activePlayerId)?.leadMs).toBe(
      CARD_FLIGHT_TIMING.rollLeadMs,
    );

    const holding = withHands(game, { [first]: { tree: 4 } });
    const traded = act(holding, first, { give: "tree", kind: "trade_bank", receive: "stone" });
    expect(plan(holding, traded, first, "trade_bank", first)?.leadMs).toBe(0);
  });

  test("a seven flies nothing", () => {
    const before = withNextRoll(game, 7);
    const after = act(before, before.activePlayerId, { kind: "roll" });
    expect(plan(before, after, first, "roll", before.activePlayerId)).toBeNull();
  });

  test("a bank trade sends the cards to the bank and the bought card back", () => {
    const before = withHands(game, { [first]: { tree: 4 } });
    const after = act(before, first, { give: "tree", kind: "trade_bank", receive: "stone" });

    expect(routes(plan(before, after, first, "trade_bank", first))).toEqual([
      {
        card: { kind: "resource", resource: "tree" },
        count: 4,
        from: { kind: "hand", resource: "tree" },
        to: { kind: "bank", resource: "tree" },
      },
      {
        card: { kind: "resource", resource: "stone" },
        count: 1,
        from: { kind: "bank", resource: "stone" },
        to: { kind: "hand", resource: "stone" },
      },
    ]);
    // An onlooker reads the resources off the bank's counts.
    expect(routes(plan(before, after, second, "trade_bank", first))[0]).toEqual({
      card: { kind: "resource", resource: "tree" },
      count: 4,
      from: { kind: "player", pile: "resources", playerId: first },
      to: { kind: "bank", resource: "tree" },
    });

    // With the bank's counts hidden, the onlooker only sees how many cards moved.
    const hidden = { ...before, settings: { ...before.settings, hideBankCards: true } };
    const hiddenAfter = act(hidden, first, { give: "tree", kind: "trade_bank", receive: "stone" });
    expect(routes(plan(hidden, hiddenAfter, second, "trade_bank", first))).toEqual([
      {
        card: { kind: "hidden-resource" },
        count: 4,
        from: { kind: "player", pile: "resources", playerId: first },
        to: { kind: "bank", resource: null },
      },
      {
        card: { kind: "hidden-resource" },
        count: 1,
        from: { kind: "bank", resource: null },
        to: { kind: "player", pile: "resources", playerId: first },
      },
    ]);
  });

  test("a player trade flies both ways, face up, between the partners the table can tell", () => {
    const give = hand({ sheep: 2 });
    const want = hand({ wheat: 1 });
    let offered = withHands(game, {
      [first]: { sheep: 2 },
      [second]: { wheat: 1 },
      [third]: { wheat: 1 },
    });
    offered = act(offered, first, {
      give,
      kind: "propose_trade",
      recipientPlayerIds: [second, third],
      want,
    });
    const offerActionNumber = offered.tradeOffer!.offerActionNumber;
    for (const playerId of [second, third]) {
      offered = act(offered, playerId, { accept: true, kind: "respond_trade", offerActionNumber });
    }
    const traded = act(offered, first, {
      kind: "confirm_trade",
      offerActionNumber,
      partnerPlayerId: second,
    });

    const sheepToSecond: Route = {
      card: { kind: "resource", resource: "sheep" },
      count: 2,
      from: { kind: "player", pile: "resources", playerId: first },
      to: { kind: "player", pile: "resources", playerId: second },
    };
    const wheatToFirst: Route = {
      card: { kind: "resource", resource: "wheat" },
      count: 1,
      from: { kind: "player", pile: "resources", playerId: second },
      to: { kind: "player", pile: "resources", playerId: first },
    };
    expect(routes(plan(offered, traded, fourth, "confirm_trade", first))).toEqual([
      sheepToSecond,
      wheatToFirst,
    ]);
    // The accepter who was not picked tells the partner apart by the counts as well.
    expect(routes(plan(offered, traded, third, "confirm_trade", first))).toEqual([
      sheepToSecond,
      wheatToFirst,
    ]);
    expect(routes(plan(offered, traded, second, "confirm_trade", first))).toEqual([
      { ...sheepToSecond, to: { kind: "hand", resource: "sheep" } },
      { ...wheatToFirst, from: { kind: "hand", resource: "wheat" } },
    ]);
  });

  test("an even trade flies for the proposer and the table, from the partner the event names", () => {
    const give = hand({ sheep: 1 });
    const want = hand({ wheat: 1 });
    let offered = withHands(game, {
      [first]: { sheep: 1 },
      [second]: { wheat: 1 },
      [third]: { wheat: 1 },
    });
    offered = act(offered, first, {
      give,
      kind: "propose_trade",
      recipientPlayerIds: [second, third],
      want,
    });
    const offerActionNumber = offered.tradeOffer!.offerActionNumber;
    for (const playerId of [second, third]) {
      offered = act(offered, playerId, { accept: true, kind: "respond_trade", offerActionNumber });
    }
    const traded = act(offered, first, {
      kind: "confirm_trade",
      offerActionNumber,
      partnerPlayerId: third,
    });

    const sheepToThird: Route = {
      card: { kind: "resource", resource: "sheep" },
      count: 1,
      from: { kind: "player", pile: "resources", playerId: first },
      to: { kind: "player", pile: "resources", playerId: third },
    };
    const wheatToFirst: Route = {
      card: { kind: "resource", resource: "wheat" },
      count: 1,
      from: { kind: "player", pile: "resources", playerId: third },
      to: { kind: "player", pile: "resources", playerId: first },
    };
    expect(routes(plan(offered, traded, first, "confirm_trade", first, third))).toEqual([
      { ...sheepToThird, from: { kind: "hand", resource: "sheep" } },
      { ...wheatToFirst, to: { kind: "hand", resource: "wheat" } },
    ]);
    expect(routes(plan(offered, traded, fourth, "confirm_trade", first, third))).toEqual([
      sheepToThird,
      wheatToFirst,
    ]);
    // Without the name, the counts cannot tell the two accepters apart.
    expect(plan(offered, traded, first, "confirm_trade", first)).toBeNull();
    // A name that never accepted is not believed.
    expect(plan(offered, traded, fourth, "confirm_trade", first, fourth)).toBeNull();
  });

  test("a steal is face up for the thief and the victim, and face down for everyone else", () => {
    const before: GameState = {
      ...withHands(game, { [first]: {}, [second]: { brick: 1 } }),
      phase: { eligibleVictimIds: [second], kind: "steal", resumePhase: "build_and_trade" },
    };
    const after = act(before, first, { kind: "steal", victimPlayerId: second });
    const brick = { kind: "resource", resource: "brick" } as const;

    expect(routes(plan(before, after, first, "steal", first))).toEqual([
      {
        card: brick,
        count: 1,
        from: { kind: "player", pile: "resources", playerId: second },
        to: { kind: "hand", resource: "brick" },
      },
    ]);
    expect(routes(plan(before, after, second, "steal", first))).toEqual([
      {
        card: brick,
        count: 1,
        from: { kind: "hand", resource: "brick" },
        to: { kind: "player", pile: "resources", playerId: first },
      },
    ]);
    const onlooker = plan(before, after, third, "move_robber_and_steal", first);
    expect(routes(onlooker)).toEqual([
      {
        card: { kind: "hidden-resource" },
        count: 1,
        from: { kind: "player", pile: "resources", playerId: second },
        to: { kind: "player", pile: "resources", playerId: first },
      },
    ]);
    expect(onlooker!.labels.map((label) => label.detail)).toEqual(["−1 card", "+1 card"]);
  });

  test("a bought development card flies face up to its buyer's hand, a victory point to its own card", () => {
    const knight = buyDevelopmentCard("knight");
    const victoryPoint = buyDevelopmentCard("victory-point");
    const buyerPlan = (bought: typeof knight) =>
      plan(bought.before, bought.after, first, "buy_development_card", first);

    // The buyer's own view shows which card it is: a Knight joins the playable cards...
    expect(routes(buyerPlan(knight))).toEqual([
      {
        card: { card: "knight", kind: "development" },
        count: 1,
        from: { kind: "bank-development" },
        to: { kind: "hand-development" },
      },
    ]);
    // ...and a victory point lands on the victory point card, not on the development cards.
    expect(routes(buyerPlan(victoryPoint))).toEqual([
      {
        card: { card: "victory-point", kind: "development" },
        count: 1,
        from: { kind: "bank-development" },
        to: { kind: "hand-victory-point" },
      },
    ]);
    expect(
      buyerPlan(victoryPoint)!.labels.map(({ at, detail, text, tone }) => ({
        at,
        detail,
        text,
        tone,
      })),
    ).toEqual([
      { at: { kind: "hand-victory-point" }, detail: "+1 Victory Point", text: "+1", tone: "gain" },
    ]);
  });

  test("everyone else sees a card back land on the buyer's row, whichever card it was", () => {
    for (const bought of [buyDevelopmentCard("knight"), buyDevelopmentCard("victory-point")]) {
      const onlooker = plan(bought.before, bought.after, second, "buy_development_card", first);
      expect(routes(onlooker)).toEqual([
        {
          card: { kind: "development" },
          count: 1,
          from: { kind: "bank-development" },
          to: { kind: "player", pile: "development", playerId: first },
        },
      ]);
      expect(onlooker!.labels.map((label) => label.detail)).toEqual(["+1 development card"]);
    }
  });

  test("a discard flies to the bank, face down when the bank's counts are hidden", () => {
    const discardGame = (settings: Partial<BaseGameSettings>) => {
      const setup = { ...game, settings: { ...game.settings, ...settings } };
      const rolled = act(
        withNextRoll(withHands(setup, { [second]: { brick: 4, tree: 4 } }), 7),
        setup.activePlayerId,
        { kind: "roll" },
      );
      return {
        after: act(rolled, second, { kind: "discard", resources: hand({ brick: 2, tree: 2 }) }),
        before: rolled,
      };
    };
    const shown = discardGame({});
    const hidden = discardGame({ hideBankCards: true });
    const toBank = (from: "hand" | "player", resource: "brick" | "tree"): Route => ({
      card: { kind: "resource", resource },
      count: 2,
      from:
        from === "hand"
          ? { kind: "hand", resource }
          : { kind: "player", pile: "resources", playerId: second },
      to: { kind: "bank", resource },
    });

    expect(routes(plan(shown.before, shown.after, second, "discard", second))).toEqual([
      toBank("hand", "tree"),
      toBank("hand", "brick"),
    ]);
    expect(routes(plan(shown.before, shown.after, third, "discard", second))).toEqual([
      toBank("player", "tree"),
      toBank("player", "brick"),
    ]);
    expect(routes(plan(hidden.before, hidden.after, third, "discard", second))).toEqual([
      {
        card: { kind: "hidden-resource" },
        count: 4,
        from: { kind: "player", pile: "resources", playerId: second },
        to: { kind: "bank", resource: null },
      },
    ]);
  });

  test("Monopoly flies every victim's cards to the player, named only to those who can tell", () => {
    const before = withDevelopmentCard(
      withHands(game, { [first]: {}, [second]: { wheat: 2 }, [third]: { wheat: 1 }, [fourth]: {} }),
      first,
      "monopoly",
    );
    const after = act(before, first, { kind: "play_monopoly", resource: "wheat" });
    const face = (viewer: string) =>
      plan(before, after, viewer, "play_monopoly", first)!.flights.map((flight) => flight.card);

    const fromVictim = (playerId: string, count: number): Route => ({
      card: { kind: "resource", resource: "wheat" },
      count,
      from: { kind: "player", pile: "resources", playerId },
      to: { kind: "hand", resource: "wheat" },
    });
    // Victims go in seat order.
    expect(routes(plan(before, after, first, "play_monopoly", first))).toEqual(
      before.players
        .filter(({ id }) => id === second || id === third)
        .map(({ id }) => fromVictim(id, id === second ? 2 : 1)),
    );
    expect(face(second)).toEqual([
      { kind: "resource", resource: "wheat" },
      { kind: "resource", resource: "wheat" },
    ]);
    // The fourth player had no wheat, so nothing on their screen names the resource.
    expect(face(fourth)).toEqual([{ kind: "hidden-resource" }, { kind: "hidden-resource" }]);
  });

  test("Year of Plenty flies the two cards from the bank", () => {
    const before = withDevelopmentCard(withHands(game, { [first]: {} }), first, "year-of-plenty");
    const after = act(before, first, {
      kind: "play_year_of_plenty",
      resources: hand({ brick: 1, stone: 1 }),
    });
    const fromBank = (resource: "brick" | "stone"): Route => ({
      card: { kind: "resource", resource },
      count: 1,
      from: { kind: "bank", resource },
      to: { kind: "hand", resource },
    });

    expect(routes(plan(before, after, first, "play_year_of_plenty", first))).toEqual([
      fromBank("brick"),
      fromBank("stone"),
    ]);
    const hidden = { ...before, settings: { ...before.settings, hideBankCards: true } };
    const hiddenAfter = act(hidden, first, {
      kind: "play_year_of_plenty",
      resources: hand({ brick: 1, stone: 1 }),
    });
    expect(routes(plan(hidden, hiddenAfter, second, "play_year_of_plenty", first))).toEqual([
      {
        card: { kind: "hidden-resource" },
        count: 2,
        from: { kind: "bank", resource: null },
        to: { kind: "player", pile: "resources", playerId: first },
      },
    ]);
  });

  test("the second opening settlement's cards fly from each neighbouring tile", () => {
    const secondRound = played.steps.filter(
      ({ before, command }) =>
        command.kind === "place_settlement" &&
        before.phase.kind === "setup_settlement" &&
        before.phase.setupIndex >= before.players.length,
    );
    const firstRound = played.steps.find(({ command }) => command.kind === "place_settlement")!;
    expect(secondRound).toHaveLength(PLAYERS.length);

    for (const { after, before } of secondRound) {
      const player = before.activePlayerId;
      const onlooker = PLAYERS.find(({ id }) => id !== player)!.id;
      const flights: CardFlight[] = plan(
        before,
        after,
        onlooker,
        "place_settlement",
        player,
      )!.flights;
      const gained = after.players.find(({ id }) => id === player)!.resources;
      const total = RESOURCE_TYPES.reduce((sum, resource) => sum + gained[resource], 0);

      expect(flights.every((flight) => flight.from.kind === "tile")).toBe(true);
      expect(flights.every((flight) => flight.card.kind === "resource")).toBe(true);
      expect(flights.reduce((sum, flight) => sum + flight.count, 0)).toBe(total);
      expect(flights.map((flight) => flight.to)).toEqual(
        flights.map(() => ({ kind: "player", pile: "resources", playerId: player })),
      );
    }
    expect(plan(firstRound.before, firstRound.after, first, "place_settlement", first)).toBeNull();
  });

  test("a jump of several actions, or a view without its event, flies nothing", () => {
    const before = withHands(game, { [first]: { tree: 8 } });
    const once = act(before, first, { give: "tree", kind: "trade_bank", receive: "stone" });
    const twice = act(once, first, { give: "tree", kind: "trade_bank", receive: "brick" });

    expect(plan(before, twice, first, "trade_bank", first)).toBeNull();
    expect(
      planCardFlights(toPlayerView(before, first), toPlayerView(once, first), [
        { actorPlayerId: first, kind: "game_paused" },
      ]),
    ).toBeNull();
  });
});

/** The changes by count and direction, for comparing without their order. */
function byTarget(changes: readonly FlightCountChange[]) {
  return Object.fromEntries(
    changes.map((change) => [
      `${change.target} ${change.delta < 0 ? "leaves" : "lands"}`,
      [change.delta, change.atMs],
    ]),
  );
}

describe("card flight count changes", () => {
  const { flightMs, popMs } = CARD_FLIGHT_TIMING;

  test("a bank trade's counts drop as the cards leave and rise as the bought card lands", () => {
    const before = withHands(game, { [first]: { tree: 4 } });
    const after = act(before, first, { give: "tree", kind: "trade_bank", receive: "stone" });
    const viewerPlan = plan(before, after, first, "trade_bank", first)!;
    const bought = viewerPlan.flights[1]!.delayMs;

    // The viewer's hand, and their own row, which follows it.
    expect(byTarget(getFlightCountChanges(viewerPlan, first))).toEqual({
      "bank:stone leaves": [-1, bought],
      "bank:tree lands": [4, popMs + flightMs],
      "hand:stone lands": [1, bought + popMs + flightMs],
      "hand:tree leaves": [-4, 0],
      [`player:${first}:resources lands`]: [1, bought + popMs + flightMs],
      [`player:${first}:resources leaves`]: [-4, 0],
    });
    // An onlooker's view of the trader's row: down four as they leave, up one as it lands.
    const onlooker = getFlightCountChanges(
      plan(before, after, second, "trade_bank", first)!,
      second,
    );
    expect(byTarget(onlooker)[`player:${first}:resources leaves`]).toEqual([-4, 0]);
    expect(byTarget(onlooker)[`player:${first}:resources lands`]).toEqual([
      1,
      bought + popMs + flightMs,
    ]);
  });

  test("a roll's counts change with their '+N' labels, and the bank pays as the cards pop", () => {
    const sum = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].find(
      (candidate) =>
        new Set(getDiceProduction(game.board, candidate, game.bank).map((claim) => claim.playerId))
          .size > 1,
    )!;
    const before = withNextRoll(game, sum);
    const after = act(before, before.activePlayerId, { kind: "roll" });
    const production = getDiceProduction(before.board, sum, before.bank);
    const viewer = production[0]!.playerId;
    const result = plan(before, after, viewer, "roll", before.activePlayerId)!;
    const changes = getFlightCountChanges(result, viewer);

    // Every destination changes when its label shows, by the label's count.
    for (const label of result.labels) {
      const target = getFlightEndpointKey(label.at);
      const change = changes.find(
        (candidate) => candidate.target === target && candidate.delta > 0,
      );
      expect(change).toEqual({
        atMs: result.leadMs + label.delayMs,
        delta: Number(label.text.slice(1)),
        target,
      });
    }
    // Each player's cards add up to what their count gained; the viewer's row follows the hand.
    for (const player of after.players) {
      const gained =
        player.resources.brick +
        player.resources.sheep +
        player.resources.stone +
        player.resources.tree +
        player.resources.wheat -
        RESOURCE_TYPES.reduce(
          (total, resource) =>
            total + before.players.find(({ id }) => id === player.id)!.resources[resource],
          0,
        );
      const target = getFlightEndpointKey({
        kind: "player",
        pile: "resources",
        playerId: player.id,
      });
      expect(changes.find((change) => change.target === target)?.delta ?? 0).toBe(gained);
    }
    // The bank's piles drop as their first card pops on a tile.
    for (const resource of RESOURCE_TYPES) {
      const paid = before.bank[resource] - after.bank[resource];
      const leaving = result.flights.filter(
        (flight) => flight.card.kind === "resource" && flight.card.resource === resource,
      );
      const change = changes.find((candidate) => candidate.target === `bank:${resource}`);
      expect((change?.delta ?? 0) + paid).toBe(0);
      if (change) {
        expect(change.atMs).toBe(
          result.leadMs + Math.min(...leaving.map((flight) => flight.delayMs)),
        );
      }
    }
  });

  test("a steal moves one card for everyone: the victim's count as it leaves, the thief's as it lands", () => {
    const before: GameState = {
      ...withHands(game, { [first]: {}, [second]: { brick: 1 } }),
      phase: { eligibleVictimIds: [second], kind: "steal", resumePhase: "build_and_trade" },
    };
    const after = act(before, first, { kind: "steal", victimPlayerId: second });

    expect(
      byTarget(getFlightCountChanges(plan(before, after, third, "steal", first)!, third)),
    ).toEqual({
      [`player:${first}:resources lands`]: [1, popMs + flightMs],
      [`player:${second}:resources leaves`]: [-1, 0],
    });
    expect(
      byTarget(getFlightCountChanges(plan(before, after, second, "steal", first)!, second)),
    ).toEqual({
      "hand:brick leaves": [-1, 0],
      [`player:${first}:resources lands`]: [1, popMs + flightMs],
      [`player:${second}:resources leaves`]: [-1, 0],
    });
  });

  test("a bought development card counts on the buyer's row as it lands, not in the viewer's hand", () => {
    const { after, before } = buyDevelopmentCard("knight");

    expect(
      byTarget(
        getFlightCountChanges(plan(before, after, second, "buy_development_card", first)!, second),
      ),
    ).toEqual({
      "bank:development leaves": [-1, 0],
      [`player:${first}:development lands`]: [1, popMs + flightMs],
    });
    // A playable card joins the buyer's hand, and their row with it, at once.
    expect(
      byTarget(
        getFlightCountChanges(plan(before, after, first, "buy_development_card", first)!, first),
      ),
    ).toEqual({ "bank:development leaves": [-1, 0] });
  });

  test("a bought victory point counts on the buyer's victory point card, and their row, as it lands", () => {
    const { after, before } = buyDevelopmentCard("victory-point");

    expect(
      byTarget(
        getFlightCountChanges(plan(before, after, first, "buy_development_card", first)!, first),
      ),
    ).toEqual({
      "bank:development leaves": [-1, 0],
      "hand:victory-point lands": [1, popMs + flightMs],
      [`player:${first}:development lands`]: [1, popMs + flightMs],
    });
    // The table cannot tell it apart from any other development card.
    expect(
      byTarget(
        getFlightCountChanges(plan(before, after, second, "buy_development_card", first)!, second),
      ),
    ).toEqual({
      "bank:development leaves": [-1, 0],
      [`player:${first}:development lands`]: [1, popMs + flightMs],
    });
  });

  test("the store holds the victory point card's count until its card lands", () => {
    const { after, before } = buyDevelopmentCard("victory-point");
    const result = plan(before, after, first, "buy_development_card", first)!;
    let now = 0;
    let timers: { at: number; callback: () => void }[] = [];
    const store = createCardFlightStore({
      now: () => now,
      schedule(callback, delayMs) {
        const timer = { at: now + delayMs, callback };
        timers.push(timer);
        return () => {
          timers = timers.filter((candidate) => candidate !== timer);
        };
      },
    });
    /** Moves the clock on, firing the store's timers in order as it passes them. */
    const advanceTo = (time: number) => {
      for (;;) {
        const [due] = timers
          .filter((timer) => timer.at <= time)
          .sort((left, right) => left.at - right.at);
        if (!due) break;
        timers = timers.filter((timer) => timer !== due);
        now = due.at;
        due.callback();
      }
      now = time;
    };
    const victoryCard = getFlightEndpointKey({ kind: "hand-victory-point" });
    const viewerRow = getFlightEndpointKey({
      kind: "player",
      pile: "development",
      playerId: first,
    });

    store.hold(result, {
      actionNumber: after.actionNumber,
      carried: getFlightEndpointKeys(result.flights),
      changes: getFlightCountChanges(result, first).map(({ atMs, delta, target }) => ({
        at: atMs,
        delta,
        target,
      })),
    });
    // The hand leaves the card to its flight, and the card and the row show the old count.
    expect(store.isCarried(after.actionNumber, victoryCard)).toBe(true);
    expect(store.getPending(victoryCard)).toBe(1);
    expect(store.getPending(viewerRow)).toBe(1);

    advanceTo(popMs + flightMs - 1);
    expect(store.getPending(victoryCard)).toBe(1);
    advanceTo(popMs + flightMs);
    expect(store.getPending(victoryCard)).toBe(0);
    expect(store.getPending(viewerRow)).toBe(0);
  });
});

describe("card flight tracker", () => {
  const before = withHands(game, { [first]: { tree: 4 } });
  const after = act(before, first, { give: "tree", kind: "trade_bank", receive: "stone" });
  const event = (id: string) => ({
    actorPlayerId: first,
    id: id as RoomEventView["id"],
    kind: "trade_bank" as const,
  });
  const opened = (now: number, isConnected = true): CardFlightTracker =>
    trackCardFlights(null, {
      events: [event("e1")],
      game: toPlayerView(before, first),
      isConnected,
      now,
      visible: true,
    });
  const next = (
    tracker: CardFlightTracker,
    input: Partial<Parameters<typeof trackCardFlights>[1]>,
  ) =>
    trackCardFlights(tracker, {
      events: [event("e1"), event("e2")],
      game: toPlayerView(after, first),
      isConnected: true,
      now: 10_000,
      visible: true,
      ...input,
    });

  test("a live move flies; the first view does not", () => {
    const tracker = opened(0);
    expect(tracker.plan).toBeNull();
    expect(next(tracker, {}).plan?.flights).toHaveLength(2);
  });

  test("what lands just after the screen opens or the connection returns is catch-up", () => {
    expect(next(opened(9_000), {}).plan).toBeNull();
    // Offline, then back: the view that comes with the reconnect does not fly either.
    const offline = trackCardFlights(opened(0), {
      events: [event("e1")],
      game: toPlayerView(before, first),
      isConnected: false,
      now: 5_000,
      visible: true,
    });
    expect(next(offline, {}).plan).toBeNull();
    expect(next(offline, { isConnected: false }).plan).toBeNull();
  });

  test("a background tab, a view without its event, or the same action flies nothing", () => {
    expect(next(opened(0), { visible: false }).plan).toBeNull();
    expect(next(opened(0), { events: [event("e0"), event("e2")] }).plan).toBeNull();
    expect(next(opened(0), { game: toPlayerView(before, first) }).plan).toBeNull();
  });
});
