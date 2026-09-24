import { createBoard } from "./board";
import { INITIAL_PIECES } from "./constants";
import { getGameMapDefinition } from "./maps";
import { deterministicShuffle } from "./random";
import { emptyInventory, filledInventory } from "./resources";
import { DEFAULT_BASE_GAME_SETTINGS, getGameSettingsProblem } from "./settings";
import { DEVELOPMENT_CARD_TYPES, GameRuleError, PLAYER_COUNTS } from "./types";
import type { BaseGameSettings, GamePlayerInput, GameState } from "./types";

function createSettings(
  playerCount: number,
  overrides: Partial<BaseGameSettings>,
): BaseGameSettings {
  const maxPlayers = overrides.maxPlayers ?? PLAYER_COUNTS.find((count) => count === playerCount);

  if (maxPlayers !== playerCount) {
    throw new GameRuleError(
      "INVALID_SETTINGS",
      `Expected ${maxPlayers ?? "a supported number of"} players, received ${playerCount}`,
    );
  }

  const settings: BaseGameSettings = {
    balancedDice: overrides.balancedDice ?? DEFAULT_BASE_GAME_SETTINGS.balancedDice,
    discardLimit: overrides.discardLimit ?? DEFAULT_BASE_GAME_SETTINGS.discardLimit,
    friendlyRobber: overrides.friendlyRobber ?? DEFAULT_BASE_GAME_SETTINGS.friendlyRobber,
    hideBankCards: overrides.hideBankCards ?? DEFAULT_BASE_GAME_SETTINGS.hideBankCards,
    map: overrides.map ?? DEFAULT_BASE_GAME_SETTINGS.map,
    maxPlayers,
    turnTimerSeconds: overrides.turnTimerSeconds ?? DEFAULT_BASE_GAME_SETTINGS.turnTimerSeconds,
    victoryPoints: overrides.victoryPoints ?? DEFAULT_BASE_GAME_SETTINGS.victoryPoints,
  };
  const problem = getGameSettingsProblem(settings);

  if (problem) {
    throw new GameRuleError("INVALID_SETTINGS", problem);
  }

  return settings;
}

function playerIdentity(player: GamePlayerInput): GamePlayerInput {
  return player.isBot
    ? {
        botDifficulty: player.botDifficulty,
        displayName: player.displayName,
        id: player.id,
        isBot: true,
      }
    : { displayName: player.displayName, id: player.id, isBot: false };
}

export function createDefaultGame(
  players: readonly GamePlayerInput[],
  seed: string,
  settingsInput: Partial<BaseGameSettings> = {},
): GameState {
  const settings = createSettings(players.length, settingsInput);

  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new GameRuleError("INVALID_COMMAND", "Player IDs must be unique");
  }

  if (!seed) {
    throw new GameRuleError("INVALID_COMMAND", "A game seed is required");
  }

  const map = getGameMapDefinition(settings.map);
  const developmentCards = DEVELOPMENT_CARD_TYPES.flatMap((card) =>
    Array.from({ length: map.developmentCardCounts[card] }, () => card),
  );
  // Seats keep their colours; only the order of play is drawn.
  const turnOrder = deterministicShuffle(
    players.map((player) => player.id),
    `${seed}:turn-order`,
  );

  return {
    actionNumber: 0,
    activePlayerId: turnOrder[0]!,
    balancedDiceBag: [],
    bank: filledInventory(map.bankResourceCount),
    board: createBoard(settings.map, seed),
    developmentCardPlayedThisTurn: false,
    developmentCardsBoughtThisTurn: 0,
    developmentDeck: deterministicShuffle(developmentCards, `${seed}:development-deck`),
    lastDiceRoll: null,
    largestArmyPlayerId: null,
    longestRoadPlayerId: null,
    phase: { kind: "setup_settlement", setupIndex: 0 },
    players: players.map((player, seatIndex) => ({
      ...playerIdentity(player),
      developmentCards: [],
      piecesRemaining: { ...INITIAL_PIECES },
      playedDevelopmentCards: [],
      resources: emptyInventory(),
      seatIndex,
      victoryPoints: 0,
    })),
    randomIndex: 0,
    seed,
    settings,
    tradeOffer: null,
    turnNumber: 0,
    turnOrder,
    winnerPlayerId: null,
  };
}
