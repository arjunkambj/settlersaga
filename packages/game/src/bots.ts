import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  NUMBER_TOKEN_PIPS,
  RESOURCE_ORDER,
  TERRAIN_RESOURCE,
} from "./constants";
import { deterministicInteger } from "./random";
import {
  addResources,
  emptyInventory,
  hasResources,
  subtractResources,
  totalResources,
} from "./resources";
import {
  boardTopology,
  getCityVertexKeys,
  getLegalActions,
  getRoadEdgeKeys,
  getSettlementVertexKeys,
  requirePlayer,
} from "./rules";
import { RESOURCE_TYPES } from "./types";
import type {
  BankTradeOption,
  BotDifficulty,
  GameCommand,
  GameState,
  LegalActions,
  PlayerId,
  PlayerState,
  ResourceInventory,
  ResourceType,
  TradeOffer,
} from "./types";

type StrategicBotDifficulty = Exclude<BotDifficulty, "easy">;

/** Bots stop feeding a proposer this many public points short of the target. */
const TRADE_REFUSAL_VICTORY_POINT_MARGIN = 2;

function tileProduction(state: GameState, tileId: string) {
  const tile = state.board.tiles.find((candidate) => candidate.id === tileId)!;
  const resource = TERRAIN_RESOURCE[tile.terrain];

  return resource && tile.numberToken !== null
    ? { pips: NUMBER_TOKEN_PIPS[tile.numberToken], resource }
    : null;
}

function vertexProductionScore(
  state: GameState,
  vertexKey: string,
  difficulty: StrategicBotDifficulty,
) {
  const resources = new Set<ResourceType>();
  let pips = 0;

  for (const tileId of boardTopology(state).vertexTileIds[vertexKey]!) {
    const production = tileProduction(state, tileId);

    if (production) {
      pips += production.pips;
      resources.add(production.resource);
    }
  }

  return pips * 10 + (difficulty === "hard" ? resources.size * 3 : 0);
}

function compareKeys(first: string, second: string) {
  return first < second ? -1 : first > second ? 1 : 0;
}

function highestScoringKey(keys: readonly string[], score: (key: string) => number) {
  return [...keys].sort(
    (first, second) => score(second) - score(first) || compareKeys(first, second),
  )[0];
}

function chooseSettlement(
  state: GameState,
  vertexKeys: readonly string[],
  difficulty: StrategicBotDifficulty,
) {
  return highestScoringKey(vertexKeys, (vertexKey) =>
    vertexProductionScore(state, vertexKey, difficulty),
  );
}

function chooseRoad(
  state: GameState,
  playerId: PlayerId,
  edgeKeys: readonly string[],
  difficulty: StrategicBotDifficulty,
) {
  const topology = boardTopology(state);
  const openSettlementVertices = new Set(getSettlementVertexKeys(state, playerId, false));

  return highestScoringKey(edgeKeys, (edgeKey) =>
    topology.edgeVertices[edgeKey]!.reduce(
      (score, vertexKey) =>
        score +
        vertexProductionScore(state, vertexKey, difficulty) +
        (openSettlementVertices.has(vertexKey) ? 1_000 : 0),
      0,
    ),
  );
}

function createDiscard(resources: ResourceInventory, count: number) {
  const discarded = emptyInventory();
  let remaining = count;
  const resourceOrder = [...RESOURCE_ORDER].sort(
    (first, second) =>
      resources[second] - resources[first] ||
      RESOURCE_ORDER.indexOf(first) - RESOURCE_ORDER.indexOf(second),
  );

  for (const resource of resourceOrder) {
    const amount = Math.min(resources[resource], remaining);
    discarded[resource] = amount;
    remaining -= amount;

    if (remaining === 0) {
      break;
    }
  }

  return discarded;
}

function robberTileScore(state: GameState, playerId: PlayerId, tileId: string) {
  const vertices = new Set(boardTopology(state).tileById[tileId]!.vertexKeys);
  const numberScore = tileProduction(state, tileId)?.pips ?? 0;

  return state.board.buildings.reduce((score, building) => {
    if (!vertices.has(building.vertexKey)) {
      return score;
    }

    const weight = building.kind === "city" ? 2 : 1;

    if (building.playerId === playerId) {
      return score - numberScore * weight * 10;
    }

    // Hand sizes are public; only the total is read.
    const handSize = totalResources(requirePlayer(state, building.playerId).resources);
    return score + numberScore * weight * 10 + handSize;
  }, 0);
}

function chooseRobberTile(
  state: GameState,
  playerId: PlayerId,
  tileIds: readonly string[],
  difficulty: BotDifficulty,
) {
  let candidates = tileIds;

  if (difficulty === "hard") {
    const scoredTiles = tileIds.map((tileId) => ({
      score: robberTileScore(state, playerId, tileId),
      tileId,
    }));
    const highestScore = Math.max(...scoredTiles.map(({ score }) => score));
    candidates = scoredTiles
      .filter(({ score }) => score === highestScore)
      .map(({ tileId }) => tileId);
  }

  const draw = deterministicInteger(
    `${state.seed}:bot-robber:${playerId}`,
    state.actionNumber,
    candidates.length,
  );
  return candidates[draw.value]!;
}

function costDeficit(resources: ResourceInventory, cost: Readonly<ResourceInventory> | null) {
  return cost
    ? RESOURCE_TYPES.reduce(
        (total, resource) => total + Math.max(0, cost[resource] - resources[resource]),
        0,
      )
    : 0;
}

function chooseTradeTowardCost(
  resources: ResourceInventory,
  trades: readonly BankTradeOption[],
  cost: Readonly<ResourceInventory>,
) {
  const deficits = RESOURCE_ORDER.filter((resource) => resources[resource] < cost[resource]).sort(
    (first, second) =>
      cost[second] - resources[second] - (cost[first] - resources[first]) ||
      RESOURCE_ORDER.indexOf(first) - RESOURCE_ORDER.indexOf(second),
  );

  for (const receive of deficits) {
    const trade = trades
      .filter(
        (option) =>
          option.receive === receive && resources[option.give] - cost[option.give] >= option.ratio,
      )
      .sort(
        (first, second) =>
          first.ratio - second.ratio ||
          resources[second.give] - cost[second.give] - (resources[first.give] - cost[first.give]) ||
          RESOURCE_ORDER.indexOf(first.give) - RESOURCE_ORDER.indexOf(second.give),
      )[0];

    if (trade) {
      return trade;
    }
  }

  return undefined;
}

/** The next thing worth saving for, whether or not it is affordable yet. */
function chooseTargetBuildCost(state: GameState, player: PlayerState) {
  if (player.piecesRemaining.cities > 0 && getCityVertexKeys(state, player.id).length > 0) {
    return BUILD_COSTS.city;
  }
  if (
    player.piecesRemaining.settlements > 0 &&
    getSettlementVertexKeys(state, player.id, true).length > 0
  ) {
    return BUILD_COSTS.settlement;
  }
  if (state.developmentDeck.length > 0) {
    return DEVELOPMENT_CARD_COST;
  }
  if (player.piecesRemaining.roads > 0 && getRoadEdgeKeys(state, player.id).length > 0) {
    return BUILD_COSTS.road;
  }
  return null;
}

function chooseBuildCommand(
  state: GameState,
  player: PlayerState,
  legal: LegalActions,
  difficulty: StrategicBotDifficulty,
): GameCommand {
  const cityVertex = chooseSettlement(state, legal.cityVertexKeys, difficulty);
  if (cityVertex) {
    return { kind: "build_city", vertexKey: cityVertex };
  }

  const settlementVertex = chooseSettlement(state, legal.settlementVertexKeys, difficulty);
  if (settlementVertex) {
    return { kind: "place_settlement", vertexKey: settlementVertex };
  }

  if (legal.canBuyDevelopmentCard) {
    return { kind: "buy_development_card" };
  }

  const targetCost = chooseTargetBuildCost(state, player);
  const trade = targetCost
    ? chooseTradeTowardCost(player.resources, legal.bankTrades, targetCost)
    : undefined;
  if (trade) {
    return { give: trade.give, kind: "trade_bank", receive: trade.receive };
  }

  const roadEdge = chooseRoad(state, player.id, legal.roadEdgeKeys, difficulty);
  return roadEdge ? { edgeKey: roadEdge, kind: "place_road" } : { kind: "end_turn" };
}

function acceptsTrade(state: GameState, bot: PlayerState, offer: TradeOffer) {
  const proposer = requirePlayer(state, offer.proposerPlayerId);

  if (
    !hasResources(bot.resources, offer.want) ||
    proposer.victoryPoints >= state.settings.victoryPoints - TRADE_REFUSAL_VICTORY_POINT_MARGIN
  ) {
    return false;
  }

  const target = chooseTargetBuildCost(state, bot);
  const after = addResources(subtractResources(bot.resources, offer.want), offer.give);
  const deficitBefore = costDeficit(bot.resources, target);
  const deficitAfter = costDeficit(after, target);

  return (
    deficitAfter < deficitBefore ||
    (deficitAfter === deficitBefore && totalResources(offer.give) > totalResources(offer.want))
  );
}

/**
 * Estimates each opponent's hand from public information only: their hand size split in
 * proportion to what their buildings produce.
 */
function estimateOpponentResources(state: GameState, playerId: PlayerId) {
  const topology = boardTopology(state);
  const estimate = emptyInventory();

  for (const opponent of state.players) {
    if (opponent.id === playerId) {
      continue;
    }

    const production = emptyInventory();
    for (const building of state.board.buildings) {
      if (building.playerId !== opponent.id) {
        continue;
      }
      for (const tileId of topology.vertexTileIds[building.vertexKey]!) {
        const tileOutput = tileProduction(state, tileId);
        if (tileOutput && tileId !== state.board.robberTileId) {
          production[tileOutput.resource] += tileOutput.pips * (building.kind === "city" ? 2 : 1);
        }
      }
    }

    const totalProduction = totalResources(production);
    const handSize = totalResources(opponent.resources);
    for (const resource of RESOURCE_TYPES) {
      if (totalProduction > 0) {
        estimate[resource] += (handSize * production[resource]) / totalProduction;
      }
    }
  }

  return estimate;
}

function chooseMonopolyResource(state: GameState, playerId: PlayerId): ResourceType {
  const estimate = estimateOpponentResources(state, playerId);
  return [...RESOURCE_ORDER].sort((first, second) => estimate[second] - estimate[first])[0]!;
}

function chooseYearOfPlentyResources(state: GameState, player: PlayerState): ResourceInventory {
  const target = chooseTargetBuildCost(state, player);
  const picked = emptyInventory();

  for (let count = 0; count < 2; count += 1) {
    const need = (resource: ResourceType) =>
      (target?.[resource] ?? 0) - player.resources[resource] - picked[resource];
    const resource = RESOURCE_ORDER.filter(
      (candidate) => state.bank[candidate] > picked[candidate],
    ).sort((first, second) => need(second) - need(first))[0]!;
    picked[resource] += 1;
  }

  return picked;
}

function chooseDevelopmentCardCommand(
  state: GameState,
  player: PlayerState,
  legal: LegalActions,
): GameCommand | null {
  const playableCards = legal.playableDevelopmentCards;

  if (playableCards.includes("knight")) {
    return { kind: "play_knight" };
  }
  if (playableCards.includes("monopoly")) {
    return { kind: "play_monopoly", resource: chooseMonopolyResource(state, player.id) };
  }
  if (playableCards.includes("road-building")) {
    return { kind: "play_road_building" };
  }
  if (playableCards.includes("year-of-plenty")) {
    return { kind: "play_year_of_plenty", resources: chooseYearOfPlentyResources(state, player) };
  }
  return null;
}

function chooseFirstLegalCommand(
  state: GameState,
  player: PlayerState,
  legal: LegalActions,
): GameCommand {
  switch (state.phase.kind) {
    case "setup_settlement": {
      const vertexKey = legal.settlementVertexKeys[0];
      if (!vertexKey) throw new Error("Automated player has no legal setup settlement");
      return { kind: "place_settlement", vertexKey };
    }
    case "setup_road": {
      const edgeKey = legal.roadEdgeKeys[0];
      if (!edgeKey) throw new Error("Automated player has no legal setup road");
      return { edgeKey, kind: "place_road" };
    }
    case "roll":
      return chooseDevelopmentCardCommand(state, player, legal) ?? { kind: "roll" };
    case "discard":
      if (legal.discardCount === null) throw new Error("Automated player cannot discard");
      return { kind: "discard", resources: createDiscard(player.resources, legal.discardCount) };
    case "move_robber":
      return {
        kind: "move_robber",
        tileId: chooseRobberTile(state, player.id, legal.robberTileIds, "easy"),
      };
    case "steal": {
      const victimPlayerId = legal.victimPlayerIds[0];
      if (!victimPlayerId) throw new Error("Automated player has no eligible victim");
      return { kind: "steal", victimPlayerId };
    }
    case "road_building": {
      const edgeKey = legal.roadEdgeKeys[0];
      if (!edgeKey) throw new Error("Automated player has no legal Road Building placement");
      return { edgeKey, kind: "place_road" };
    }
    case "build_and_trade": {
      const developmentCardCommand = chooseDevelopmentCardCommand(state, player, legal);
      if (developmentCardCommand) return developmentCardCommand;
      const cityVertex = legal.cityVertexKeys[0];
      if (cityVertex) return { kind: "build_city", vertexKey: cityVertex };
      const settlementVertex = legal.settlementVertexKeys[0];
      if (settlementVertex) return { kind: "place_settlement", vertexKey: settlementVertex };
      if (legal.canBuyDevelopmentCard) return { kind: "buy_development_card" };
      const roadEdge = legal.roadEdgeKeys[0];
      if (roadEdge) return { edgeKey: roadEdge, kind: "place_road" };
      const targetCost = chooseTargetBuildCost(state, player);
      const trade = targetCost
        ? chooseTradeTowardCost(player.resources, legal.bankTrades, targetCost)
        : undefined;
      if (trade) {
        return { give: trade.give, kind: "trade_bank", receive: trade.receive };
      }
      return { kind: "end_turn" };
    }
    case "finished":
      throw new Error("Finished game does not require an automated command");
  }
}

function chooseStrategicCommand(
  state: GameState,
  player: PlayerState,
  legal: LegalActions,
  difficulty: StrategicBotDifficulty,
): GameCommand {
  switch (state.phase.kind) {
    case "setup_settlement": {
      const vertexKey = chooseSettlement(state, legal.settlementVertexKeys, difficulty);
      if (!vertexKey) throw new Error("Bot has no legal setup settlement");
      return { kind: "place_settlement", vertexKey };
    }
    case "setup_road":
    case "road_building": {
      const edgeKey = chooseRoad(state, player.id, legal.roadEdgeKeys, difficulty);
      if (!edgeKey) throw new Error("Bot has no legal road placement");
      return { edgeKey, kind: "place_road" };
    }
    case "roll":
      return chooseDevelopmentCardCommand(state, player, legal) ?? { kind: "roll" };
    case "discard":
      if (legal.discardCount === null) throw new Error("Bot has no discard requirement");
      return { kind: "discard", resources: createDiscard(player.resources, legal.discardCount) };
    case "move_robber":
      return {
        kind: "move_robber",
        tileId: chooseRobberTile(state, player.id, legal.robberTileIds, difficulty),
      };
    case "steal": {
      const handSize = (playerId: PlayerId) =>
        totalResources(requirePlayer(state, playerId).resources);
      const victimPlayerId =
        difficulty === "hard"
          ? [...legal.victimPlayerIds].sort(
              (first, second) =>
                handSize(second) - handSize(first) ||
                requirePlayer(state, first).seatIndex - requirePlayer(state, second).seatIndex,
            )[0]
          : legal.victimPlayerIds[0];
      if (!victimPlayerId) throw new Error("Bot has no eligible victim");
      return { kind: "steal", victimPlayerId };
    }
    case "build_and_trade":
      return (
        chooseDevelopmentCardCommand(state, player, legal) ??
        chooseBuildCommand(state, player, legal, difficulty)
      );
    case "finished":
      throw new Error("Finished game does not require a bot command");
  }
}

function requiredActionOnly(state: GameState, legal: LegalActions): GameCommand | null {
  const offer = state.tradeOffer;

  if (offer && legal.canRespondToTrade) {
    return { accept: false, kind: "respond_trade", offerActionNumber: offer.offerActionNumber };
  }
  if (state.phase.kind === "roll") {
    return { kind: "roll" };
  }
  if (state.phase.kind === "build_and_trade") {
    return { kind: "end_turn" };
  }
  return null;
}

export function chooseAutomatedCommand(state: GameState, playerId: PlayerId): GameCommand {
  const player = requirePlayer(state, playerId);
  const legal = getLegalActions(state, playerId);
  const offer = state.tradeOffer;

  if (!player.isBot) {
    // A timed-out human only takes the required actions, never optional plays or builds.
    return requiredActionOnly(state, legal) ?? chooseStrategicCommand(state, player, legal, "hard");
  }

  if (offer && legal.canRespondToTrade) {
    return {
      accept: acceptsTrade(state, player, offer),
      kind: "respond_trade",
      offerActionNumber: offer.offerActionNumber,
    };
  }

  return player.botDifficulty === "easy"
    ? chooseFirstLegalCommand(state, player, legal)
    : chooseStrategicCommand(state, player, legal, player.botDifficulty);
}

/**
 * The simplest legal move for any required player: required actions only, first legal choice.
 * Automation can fall back to it when a strategy fails.
 */
export function chooseFallbackCommand(state: GameState, playerId: PlayerId): GameCommand {
  const legal = getLegalActions(state, playerId);
  return (
    requiredActionOnly(state, legal) ??
    chooseFirstLegalCommand(state, requirePlayer(state, playerId), legal)
  );
}
