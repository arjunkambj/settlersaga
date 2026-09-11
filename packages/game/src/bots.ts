import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  NUMBER_TOKEN_PIPS,
  RESOURCE_ORDER,
  TERRAIN_RESOURCE,
} from "./constants";
import {
  getCityVertexKeys,
  getLegalActions,
  getRoadEdgeKeys,
  getSettlementVertexKeys,
} from "./rules";
import { emptyInventory, hasResources, totalResources } from "./resources";
import { deterministicInteger } from "./random";
import { getBoardTopology } from "./topology";
import type {
  BankTradeOption,
  BotDifficulty,
  GameCommand,
  GameState,
  PlayerId,
  ResourceInventory,
} from "./types";

type StrategicBotDifficulty = "hard" | "medium";

function boardTopology(state: GameState) {
  return getBoardTopology(state.board.tiles);
}

function requirePlayer(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Unknown automated player: ${playerId}`);
  }

  return player;
}

function vertexProductionScore(
  state: GameState,
  vertexKey: string,
  difficulty: StrategicBotDifficulty,
) {
  const resources = new Set<string>();
  let pips = 0;

  for (const tileId of boardTopology(state).vertexTileIds[vertexKey] ?? []) {
    const tile = state.board.tiles.find((candidate) => candidate.id === tileId);
    const resource = tile ? TERRAIN_RESOURCE[tile.terrain] : null;

    if (tile?.numberToken && resource) {
      pips += NUMBER_TOKEN_PIPS[tile.numberToken] ?? 0;
      resources.add(resource);
    }
  }

  return pips * 10 + (difficulty === "hard" ? resources.size * 3 : 0);
}

function highestScoringKey(keys: readonly string[], score: (key: string) => number) {
  return [...keys].sort(
    (first, second) => score(second) - score(first) || compareKeys(first, second),
  )[0];
}

function compareKeys(first: string, second: string) {
  return first < second ? -1 : first > second ? 1 : 0;
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
  const openSettlementVertices = new Set(getSettlementVertexKeys(state, playerId, false));

  return highestScoringKey(edgeKeys, (edgeKey) => {
    const endpoints = boardTopology(state).edgeVertices[edgeKey] ?? [];
    return endpoints.reduce((score, vertexKey) => {
      const isOpenDestination = openSettlementVertices.has(vertexKey);
      return (
        score +
        vertexProductionScore(state, vertexKey, difficulty) +
        (isOpenDestination ? 1_000 : 0)
      );
    }, 0);
  });
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
  const vertices = new Set(boardTopology(state).tileById[tileId]?.vertexKeys ?? []);
  const tile = state.board.tiles.find((candidate) => candidate.id === tileId);
  const numberScore = tile?.numberToken ? (NUMBER_TOKEN_PIPS[tile.numberToken] ?? 0) : 0;

  return state.board.buildings.reduce((score, building) => {
    if (!vertices.has(building.vertexKey)) {
      return score;
    }

    const owner = state.players.find((player) => player.id === building.playerId);
    const weight = building.kind === "city" ? 2 : 1;

    if (building.playerId === playerId) {
      return score - numberScore * weight * 10;
    }

    return score + numberScore * weight * 10 + totalResources(owner?.resources ?? emptyInventory());
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

  if (candidates.length === 0) {
    return undefined;
  }

  const draw = deterministicInteger(
    `${state.seed}:bot-robber:${playerId}`,
    state.actionNumber,
    candidates.length,
  );
  return candidates[draw.value];
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

function chooseTargetBuildCost(state: GameState, playerId: PlayerId) {
  const player = requirePlayer(state, playerId);
  const cityLocations = player.piecesRemaining.cities > 0 ? getCityVertexKeys(state, playerId) : [];
  const settlementLocations =
    player.piecesRemaining.settlements > 0 ? getSettlementVertexKeys(state, playerId, true) : [];
  const roadLocations = player.piecesRemaining.roads > 0 ? getRoadEdgeKeys(state, playerId) : [];

  return cityLocations.length > 0
    ? BUILD_COSTS.city
    : settlementLocations.length > 0
      ? BUILD_COSTS.settlement
      : state.developmentDeck.length > 0
        ? DEVELOPMENT_CARD_COST
        : roadLocations.length > 0
          ? BUILD_COSTS.road
          : null;
}

function chooseBuildCommand(
  state: GameState,
  playerId: PlayerId,
  difficulty: StrategicBotDifficulty,
): GameCommand {
  const player = requirePlayer(state, playerId);
  const legal = getLegalActions(state, playerId);
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

  const targetCost = chooseTargetBuildCost(state, playerId);
  const trade = targetCost
    ? chooseTradeTowardCost(player.resources, legal.bankTrades, targetCost)
    : undefined;

  if (trade) {
    return {
      give: trade.give,
      kind: "trade_bank",
      receive: trade.receive,
    };
  }

  const roadEdge = chooseRoad(state, playerId, legal.roadEdgeKeys, difficulty);

  return roadEdge ? { edgeKey: roadEdge, kind: "place_road" } : { kind: "end_turn" };
}

function tradeResponseCommand(
  state: GameState,
  playerId: PlayerId,
): Extract<GameCommand, { kind: "respond_trade" }> | null {
  const offer = state.tradeOffer;
  const player = requirePlayer(state, playerId);
  const legal = getLegalActions(state, playerId);

  if (!offer || !legal.canRespondToTrade) {
    return null;
  }

  const proposer = requirePlayer(state, offer.proposerPlayerId);
  const affordable =
    hasResources(proposer.resources, offer.give) && hasResources(player.resources, offer.want);
  const fair = totalResources(offer.give) >= totalResources(offer.want);
  return {
    accept: affordable && fair,
    kind: "respond_trade",
    offerActionNumber: offer.offerActionNumber,
  };
}

function chooseDevelopmentCardCommand(state: GameState, playerId: PlayerId): GameCommand | null {
  const playableCards = getLegalActions(state, playerId).playableDevelopmentCards;
  if (playableCards.includes("knight")) {
    return { kind: "play_knight" };
  }
  if (playableCards.includes("monopoly")) {
    const resource = [...RESOURCE_ORDER].sort(
      (first, second) =>
        state.players.reduce(
          (total, player) => total + (player.id === playerId ? 0 : player.resources[second]),
          0,
        ) -
          state.players.reduce(
            (total, player) => total + (player.id === playerId ? 0 : player.resources[first]),
            0,
          ) || RESOURCE_ORDER.indexOf(first) - RESOURCE_ORDER.indexOf(second),
    )[0];
    if (resource) {
      return { kind: "play_monopoly", resource };
    }
  }
  if (playableCards.includes("road-building")) {
    return { kind: "play_road_building" };
  }
  if (playableCards.includes("year-of-plenty")) {
    const resources = emptyInventory();
    let remaining = 2;
    for (const resource of RESOURCE_ORDER) {
      const amount = Math.min(state.bank[resource], remaining);
      resources[resource] = amount;
      remaining -= amount;
      if (remaining === 0) {
        return { kind: "play_year_of_plenty", resources };
      }
    }
  }
  return null;
}

function chooseFirstLegalCommand(state: GameState, playerId: PlayerId): GameCommand {
  const player = requirePlayer(state, playerId);
  const legal = getLegalActions(state, playerId);

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
      return chooseDevelopmentCardCommand(state, playerId) ?? { kind: "roll" };
    case "discard": {
      if (legal.discardCount === null) throw new Error("Automated player cannot discard");
      return {
        kind: "discard",
        resources: createDiscard(player.resources, legal.discardCount),
      };
    }
    case "move_robber": {
      const tileId = chooseRobberTile(state, playerId, legal.robberTileIds, "easy");
      if (!tileId) throw new Error("Automated player has no robber destination");
      return { kind: "move_robber", tileId };
    }
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
      const developmentCardCommand = chooseDevelopmentCardCommand(state, playerId);
      if (developmentCardCommand) return developmentCardCommand;
      const cityVertex = legal.cityVertexKeys[0];
      if (cityVertex) return { kind: "build_city", vertexKey: cityVertex };
      const settlementVertex = legal.settlementVertexKeys[0];
      if (settlementVertex) return { kind: "place_settlement", vertexKey: settlementVertex };
      if (legal.canBuyDevelopmentCard) return { kind: "buy_development_card" };
      const roadEdge = legal.roadEdgeKeys[0];
      if (roadEdge) return { edgeKey: roadEdge, kind: "place_road" };
      const targetCost = chooseTargetBuildCost(state, playerId);
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
  playerId: PlayerId,
  difficulty: StrategicBotDifficulty,
): GameCommand {
  const player = requirePlayer(state, playerId);
  const legal = getLegalActions(state, playerId);

  switch (state.phase.kind) {
    case "setup_settlement": {
      const vertexKey = chooseSettlement(state, legal.settlementVertexKeys, difficulty);

      if (!vertexKey) {
        throw new Error("Bot has no legal setup settlement");
      }

      return { kind: "place_settlement", vertexKey };
    }
    case "setup_road": {
      const edgeKey = chooseRoad(state, playerId, legal.roadEdgeKeys, difficulty);

      if (!edgeKey) {
        throw new Error("Bot has no legal setup road");
      }

      return { edgeKey, kind: "place_road" };
    }
    case "roll":
      return chooseDevelopmentCardCommand(state, playerId) ?? { kind: "roll" };
    case "discard": {
      const count = legal.discardCount;

      if (count === null) {
        throw new Error("Bot has no discard requirement");
      }

      return { kind: "discard", resources: createDiscard(player.resources, count) };
    }
    case "move_robber": {
      const tileId = chooseRobberTile(state, playerId, legal.robberTileIds, difficulty);

      if (!tileId) {
        throw new Error("Bot has no legal robber destination");
      }

      return { kind: "move_robber", tileId };
    }
    case "steal": {
      const victimPlayerId =
        difficulty === "hard"
          ? [...legal.victimPlayerIds].sort((first, second) => {
              const firstPlayer = state.players.find((candidate) => candidate.id === first);
              const secondPlayer = state.players.find((candidate) => candidate.id === second);
              return (
                totalResources(secondPlayer?.resources ?? emptyInventory()) -
                  totalResources(firstPlayer?.resources ?? emptyInventory()) ||
                (firstPlayer?.seatIndex ?? 0) - (secondPlayer?.seatIndex ?? 0)
              );
            })[0]
          : legal.victimPlayerIds[0];

      if (!victimPlayerId) {
        throw new Error("Bot has no eligible victim");
      }

      return { kind: "steal", victimPlayerId };
    }
    case "road_building": {
      const edgeKey = chooseRoad(state, playerId, legal.roadEdgeKeys, difficulty);
      if (!edgeKey) {
        throw new Error("Bot has no legal Road Building placement");
      }
      return { edgeKey, kind: "place_road" };
    }
    case "build_and_trade": {
      const developmentCardCommand = chooseDevelopmentCardCommand(state, playerId);
      if (developmentCardCommand) return developmentCardCommand;
      return chooseBuildCommand(state, playerId, difficulty);
    }
    case "finished":
      throw new Error("Finished game does not require a bot command");
  }
}

export function chooseAutomatedCommand(state: GameState, playerId: PlayerId): GameCommand {
  if (state.status === "completed") {
    throw new Error("Finished game does not require an automated command");
  }

  const player = requirePlayer(state, playerId);
  const tradeResponse = tradeResponseCommand(state, playerId);
  if (tradeResponse) {
    return player.isBot ? tradeResponse : { ...tradeResponse, accept: false };
  }

  if (!player.isBot) {
    // Timed-out humans only take required actions; optional dev-card plays are
    // never spent on their behalf, so the roll phase simply rolls.
    if (state.phase.kind === "roll") return { kind: "roll" };
    return state.phase.kind === "build_and_trade"
      ? { kind: "end_turn" }
      : chooseFirstLegalCommand(state, playerId);
  }

  if (player.botDifficulty === "easy") {
    return chooseFirstLegalCommand(state, playerId);
  }

  return chooseStrategicCommand(
    state,
    playerId,
    player.botDifficulty === "hard" ? "hard" : "medium",
  );
}
