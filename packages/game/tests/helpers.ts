import { expect } from "bun:test";

import { INITIAL_PIECES } from "../src/constants";
import {
  applyCommand,
  chooseAutomatedCommand,
  createDefaultGame,
  emptyInventory,
  type BaseGameSettings,
  type GamePlayerInput,
  type GameState,
  type ResourceInventory,
} from "../src/index";
import { reconcileLargestArmyAward } from "../src/largest-army";
import { reconcileLongestRoadAward } from "../src/longest-road";
import { addResources, subtractResources } from "../src/resources";
import type { BoardTopology } from "../src/topology";
import type {
  BuildingState,
  DevelopmentCardType,
  DiceRoll,
  GameRuleErrorCode,
  PlayerId,
} from "../src/types";

export function ruleError(code: GameRuleErrorCode) {
  return expect.objectContaining({ code });
}

export function makePlayers(count: number): GamePlayerInput[] {
  return Array.from({ length: count }, (_, index) => ({
    botDifficulty: "hard",
    displayName: `Player ${index + 1}`,
    id: `player-${index + 1}`,
    isBot: true,
  }));
}

export function createGame(
  seed: string,
  settings: Partial<BaseGameSettings> = {},
  players: readonly GamePlayerInput[] = makePlayers(4),
): GameState {
  return createDefaultGame(players, seed, { turnTimerSeconds: 0, ...settings });
}

export function playThroughSetup(state: GameState): GameState {
  let next = state;
  while (next.phase.kind === "setup_settlement" || next.phase.kind === "setup_road") {
    next = applyCommand(
      next,
      next.activePlayerId,
      chooseAutomatedCommand(next, next.activePlayerId),
    );
  }
  return next;
}

/** A game after opening setup, part way into the first player's turn. */
export function createPlayedGame(
  seed: string,
  settings: Partial<BaseGameSettings> = {},
  players?: readonly GamePlayerInput[],
): GameState {
  return {
    ...playThroughSetup(createGame(seed, settings, players)),
    phase: { kind: "build_and_trade" },
  };
}

export function playerById(state: GameState, playerId: PlayerId) {
  return state.players.find((player) => player.id === playerId)!;
}

export function opponentsOf(state: GameState, playerId: PlayerId): PlayerId[] {
  return state.turnOrder.filter((candidate) => candidate !== playerId);
}

/** Swaps cards with the bank so the player holds exactly `hand`, keeping the supply conserved. */
export function withHand(
  state: GameState,
  playerId: PlayerId,
  hand: Partial<ResourceInventory>,
): GameState {
  const resources = { ...emptyInventory(), ...hand };
  return {
    ...state,
    bank: subtractResources(
      addResources(state.bank, playerById(state, playerId).resources),
      resources,
    ),
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, resources } : player,
    ),
  };
}

/** Moves extra cards from the bank into the player's hand. */
export function withCardsFromBank(
  state: GameState,
  playerId: PlayerId,
  cards: Partial<ResourceInventory>,
): GameState {
  return withHand(
    state,
    playerId,
    addResources(playerById(state, playerId).resources, { ...emptyInventory(), ...cards }),
  );
}

export function withDevelopmentCard(
  state: GameState,
  playerId: PlayerId,
  card: DevelopmentCardType,
): GameState {
  const cardIndex = state.developmentDeck.indexOf(card);
  if (cardIndex < 0) throw new Error(`Development deck needs a ${card} card`);

  return {
    ...state,
    developmentDeck: state.developmentDeck.toSpliced(cardIndex, 1),
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, developmentCards: [...player.developmentCards, card] }
        : player,
    ),
  };
}

/** Stacks the balanced dice so the next roll totals `sum`. */
export function withNextRoll(state: GameState, sum: number): GameState {
  const rolls: DiceRoll[] = Array.from({ length: 36 }, (_, index) => {
    const first = Math.floor(index / 6) + 1;
    const second = (index % 6) + 1;
    return { first, second, sum: first + second };
  });
  const next = rolls.find((roll) => roll.sum === sum)!;

  return {
    ...state,
    balancedDiceBag: [next, ...rolls.filter((roll) => roll !== next)],
    phase: { kind: "roll" },
    settings: { ...state.settings, balancedDice: true },
  };
}

interface PlayerPieces {
  cities?: readonly string[];
  roads?: readonly string[];
  settlements?: readonly string[];
}

export function boardPieces(state: GameState): Record<PlayerId, Required<PlayerPieces>> {
  return Object.fromEntries(
    state.players.map((player) => {
      const buildings = state.board.buildings.filter((building) => building.playerId === player.id);
      const vertexKeys = (kind: BuildingState["kind"]) =>
        buildings.filter((building) => building.kind === kind).map(({ vertexKey }) => vertexKey);
      return [
        player.id,
        {
          cities: vertexKeys("city"),
          roads: state.board.roads
            .filter((road) => road.playerId === player.id)
            .map(({ edgeKey }) => edgeKey),
          settlements: vertexKeys("settlement"),
        },
      ];
    }),
  );
}

/** Replaces the board's pieces and recomputes remaining pieces, scores and awards to match. */
export function withBoardPieces(
  state: GameState,
  pieces: Readonly<Record<PlayerId, PlayerPieces>>,
): GameState {
  const owned = (playerId: PlayerId) => pieces[playerId] ?? {};

  return reconcileLargestArmyAward(
    reconcileLongestRoadAward({
      ...state,
      board: {
        ...state.board,
        buildings: state.players.flatMap((player): BuildingState[] => [
          ...(owned(player.id).settlements ?? []).map((vertexKey): BuildingState => ({
            kind: "settlement",
            playerId: player.id,
            vertexKey,
          })),
          ...(owned(player.id).cities ?? []).map((vertexKey): BuildingState => ({
            kind: "city",
            playerId: player.id,
            vertexKey,
          })),
        ]),
        roads: state.players.flatMap((player) =>
          (owned(player.id).roads ?? []).map((edgeKey) => ({ edgeKey, playerId: player.id })),
        ),
      },
      largestArmyPlayerId: null,
      longestRoadPlayerId: null,
      players: state.players.map((player) => {
        const { cities = [], roads = [], settlements = [] } = owned(player.id);
        return {
          ...player,
          piecesRemaining: {
            cities: INITIAL_PIECES.cities - cities.length,
            roads: INITIAL_PIECES.roads - roads.length,
            settlements: INITIAL_PIECES.settlements - settlements.length,
          },
          victoryPoints: settlements.length + cities.length * 2,
        };
      }),
    }),
  );
}

export interface RoadPath {
  edgeKeys: string[];
  vertexKeys: string[];
}

/** Finds a simple road path whose vertices avoid `blocked` and satisfy `accept`. */
export function findRoadPath(
  topology: BoardTopology,
  length: number,
  blocked: ReadonlySet<string> = new Set(),
  accept: (path: RoadPath) => boolean = () => true,
): RoadPath {
  const extend = (path: RoadPath): RoadPath | null => {
    if (path.edgeKeys.length === length) {
      return accept(path) ? path : null;
    }

    const last = path.vertexKeys.at(-1)!;
    for (const edgeKey of topology.vertexEdges[last]!) {
      const next = topology.edgeVertices[edgeKey]!.find((vertexKey) => vertexKey !== last)!;
      if (blocked.has(next) || path.vertexKeys.includes(next)) continue;

      const found = extend({
        edgeKeys: [...path.edgeKeys, edgeKey],
        vertexKeys: [...path.vertexKeys, next],
      });
      if (found) return found;
    }
    return null;
  };

  for (const start of topology.vertexKeys) {
    if (blocked.has(start)) continue;
    const found = extend({ edgeKeys: [], vertexKeys: [start] });
    if (found) return found;
  }

  throw new Error(`Board has no free ${length}-road path`);
}

/** The given vertices plus every vertex next to them. */
export function surroundings(topology: BoardTopology, vertexKeys: readonly string[]): Set<string> {
  return new Set(
    vertexKeys.flatMap((vertexKey) => [vertexKey, ...topology.vertexNeighbors[vertexKey]!]),
  );
}
